import { FileSystemSyncError } from './errors';
import { SyncFsAdapter, normalizeVaultPath } from './fs';

export interface LedgerData {
    syncedKeys: { [key: string]: string };
}

type LoadState = 'empty' | 'loaded' | 'corrupt';

export class SyncLedger {
    private data: LedgerData = { syncedKeys: {} };
    private readonly ledgerPath: string;
    private loadState: LoadState = 'empty';

    constructor(
        private readonly fs: SyncFsAdapter,
        ledgerPath: string
    ) {
        this.ledgerPath = normalizeVaultPath(ledgerPath);
    }

    async load(): Promise<void> {
        if (!(await this.fs.exists(this.ledgerPath))) {
            this.data = { syncedKeys: {} };
            this.loadState = 'empty';
            return;
        }

        const content = await this.fs.read(this.ledgerPath);
        try {
            const parsed = JSON.parse(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('root must be an object');
            }
            const keys = parsed.syncedKeys;
            if (keys != null && (typeof keys !== 'object' || Array.isArray(keys))) {
                throw new Error('syncedKeys must be an object');
            }
            this.data = { syncedKeys: keys && typeof keys === 'object' ? keys : {} };
            this.loadState = 'loaded';
        } catch (error: unknown) {
            this.loadState = 'corrupt';
            const detail = error instanceof Error ? error.message : String(error);
            throw new FileSystemSyncError(`Failed to parse ledger at ${this.ledgerPath}: ${detail}`);
        }
    }

    /**
     * Atomic save: write `<path>.tmp` then rename over the target.
     */
    async save(): Promise<void> {
        if (this.loadState === 'corrupt') {
            throw new FileSystemSyncError(`Refusing to overwrite a corrupt ledger at ${this.ledgerPath}`);
        }
        const tmpPath = `${this.ledgerPath}.tmp`;
        const payload = JSON.stringify(this.data, null, 2);
        await this.fs.write(tmpPath, payload);
        await this.fs.rename(tmpPath, this.ledgerPath);
        this.loadState = 'loaded';
    }

    isSynced(key: string, etag?: string): boolean {
        if (!this.data.syncedKeys[key]) return false;
        if (etag && this.data.syncedKeys[key] !== etag) return false;
        return true;
    }

    record(key: string, etag: string): void {
        this.data.syncedKeys[key] = etag;
    }

    clear(): void {
        this.data.syncedKeys = {};
    }

    count(): number {
        return Object.keys(this.data.syncedKeys).length;
    }

    getSyncedKeys(): { [key: string]: string } {
        return { ...this.data.syncedKeys };
    }

    getPath(): string {
        return this.ledgerPath;
    }
}
