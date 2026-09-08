import { S3Manager } from '../S3Manager';
import { SyncLedger } from './SyncLedger';
import { FileSystemAdapter, normalizeVaultPath } from './fs';
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
        private readonly fs: FileSystemAdapter,
        private readonly s3: S3Manager,
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
        };

        let objects: { key: string; etag: string }[];
        try {
            objects = await this.s3.listObjects();
        } catch (error: unknown) {
            throw new S3SyncError(errorMessage(error));
        }

        const stopOnError = this.options.stopOnError !== false;

        for (const obj of objects) {
            let relativePath = obj.key;
            if (this.options.prefix && relativePath.startsWith(this.options.prefix)) {
                relativePath = relativePath.slice(this.options.prefix.length);
            }
            if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);

            if (!this.options.force && this.ledger.isSynced(obj.key, obj.etag)) {
                result.skippedCount++;
                this.onProgress?.({ type: 'skip', key: obj.key });
                continue;
            }

            const localPath = normalizeVaultPath(`${this.options.localBasePath}/${relativePath}`);

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
                const failure = {
                    key: obj.key,
                    error: errorMessage(error),
                    exitCode: error instanceof CliError ? error.exitCode : 3,
                };
                result.failed.push(failure);
                result.success = false;
                this.onProgress?.({ type: 'fail', key: obj.key, message: failure.error });
                if (stopOnError) {
                    throw error instanceof S3SyncError || error instanceof FileSystemSyncError
                        ? error
                        : new FileSystemSyncError(failure.error);
                }
            }
        }

        if (!this.options.dryRun) {
            try {
                await this.ledger.save();
            } catch (error: unknown) {
                throw new FileSystemSyncError(errorMessage(error));
            }
        }

        this.onProgress?.({
            type: 'done',
            downloadedCount: result.downloaded.length,
            skippedCount: result.skippedCount,
        });

        return result;
    }

    private async getObject(key: string): Promise<string> {
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
