import { ObjectStore } from './objectStore';
import { SyncLedger } from './SyncLedger';
import { safeDownloadPath, stripS3Prefix, SyncFsAdapter } from './fs';
import { acquireSyncLock, lockPathForLedger } from './lock';
import { CliError, errorMessage, FileSystemSyncError, S3SyncError } from './errors';

export interface SyncEngineOptions {
    localBasePath: string;
    prefix: string;
    force: boolean;
    dryRun?: boolean;
    /** Plugin keeps historical fail-fast behavior. CLI collects per-file errors. */
    stopOnError?: boolean;
}

export interface SyncFailure {
    key: string;
    error: string;
    exitCode: number;
}

export interface SyncResult {
    downloaded: string[];
    skippedCount: number;
    failed: SyncFailure[];
    success: boolean;
    dryRun?: boolean;
}

export interface SyncProgress {
    type: 'skip' | 'download' | 'fail' | 'done';
    key?: string;
    localPath?: string;
    downloadedCount?: number;
    skippedCount?: number;
    message?: string;
}

export type SyncProgressHandler = (event: SyncProgress) => void;

export class SyncEngine {
    constructor(
        private readonly fs: SyncFsAdapter,
        private readonly s3: ObjectStore,
        private readonly ledger: SyncLedger,
        private readonly options: SyncEngineOptions,
        private readonly onProgress?: SyncProgressHandler
    ) {}

    async run(): Promise<SyncResult> {
        const result: SyncResult = {
            downloaded: [],
            skippedCount: 0,
            failed: [],
            success: true,
            dryRun: !!this.options.dryRun,
        };

        const releaseLock = this.options.dryRun
            ? async () => { /* dry-run does not take a lock */ }
            : await acquireSyncLock(this.fs, lockPathForLedger(this.ledger.getPath()));

        try {
            return await this.runLocked(result);
        } finally {
            await releaseLock();
        }
    }

    private async runLocked(result: SyncResult): Promise<SyncResult> {
        let objects: { key: string; etag: string }[];
        try {
            objects = await this.s3.listObjects();
        } catch (error: unknown) {
            throw new S3SyncError(errorMessage(error));
        }

        const stopOnError = this.options.stopOnError !== false;

        for (const obj of objects) {
            const relativePath = stripS3Prefix(obj.key, this.options.prefix);
            if (relativePath === null || relativePath === '' || relativePath.endsWith('/')) {
                continue;
            }

            if (!this.options.force && this.ledger.isSynced(obj.key, obj.etag)) {
                result.skippedCount++;
                this.onProgress?.({ type: 'skip', key: obj.key });
                continue;
            }

            let localPath: string | null;
            try {
                localPath = safeDownloadPath(this.options.localBasePath, relativePath);
            } catch (error: unknown) {
                const failure = this.recordFailure(result, obj.key, error);
                this.onProgress?.({ type: 'fail', key: obj.key, message: failure.error });
                if (stopOnError) {
                    await this.persistLedger();
                    throw new FileSystemSyncError(failure.error);
                }
                continue;
            }

            if (localPath === null) continue;

            if (this.options.dryRun) {
                result.downloaded.push(localPath);
                this.onProgress?.({ type: 'download', key: obj.key, localPath });
                continue;
            }

            try {
                await this.ensureDirectory(localPath);
                const content = await this.getObject(obj.key);
                try {
                    await this.fs.write(localPath, content);
                } catch (error: unknown) {
                    throw new FileSystemSyncError(errorMessage(error));
                }
                this.ledger.record(obj.key, obj.etag);
                result.downloaded.push(localPath);
                this.onProgress?.({ type: 'download', key: obj.key, localPath });
            } catch (error: unknown) {
                const failure = this.recordFailure(result, obj.key, error);
                this.onProgress?.({ type: 'fail', key: obj.key, message: failure.error });
                if (stopOnError) {
                    await this.persistLedger();
                    throw error instanceof S3SyncError || error instanceof FileSystemSyncError
                        ? error
                        : new FileSystemSyncError(failure.error);
                }
            }
        }

        if (!this.options.dryRun) {
            await this.persistLedger();
        }

        this.onProgress?.({
            type: 'done',
            downloadedCount: result.downloaded.length,
            skippedCount: result.skippedCount,
        });

        return result;
    }

    private recordFailure(result: SyncResult, key: string, error: unknown): SyncFailure {
        const failure = {
            key,
            error: errorMessage(error),
            exitCode: error instanceof CliError ? error.exitCode : 3,
        };
        result.failed.push(failure);
        result.success = false;
        return failure;
    }

    private async persistLedger(): Promise<void> {
        try {
            await this.ledger.save();
        } catch (error: unknown) {
            throw new FileSystemSyncError(errorMessage(error));
        }
    }

    private async getObject(key: string): Promise<string | Uint8Array> {
        try {
            return await this.s3.getObject(key);
        } catch (error: unknown) {
            throw new S3SyncError(errorMessage(error));
        }
    }

    private async ensureDirectory(fullPath: string): Promise<void> {
        const parts = fullPath.split('/');
        parts.pop();

        let currentPath = '';
        for (const part of parts) {
            if (!part) continue;
            currentPath = currentPath === '' ? part : `${currentPath}/${part}`;
            const exists = await this.fs.exists(currentPath);
            if (!exists) {
                try {
                    await this.fs.mkdir(currentPath);
                } catch (error: unknown) {
                    throw new FileSystemSyncError(errorMessage(error));
                }
            } else if (!(await this.fs.isDirectory(currentPath))) {
                throw new FileSystemSyncError(`Path ${currentPath} exists but is not a folder`);
            }
        }
    }
}
