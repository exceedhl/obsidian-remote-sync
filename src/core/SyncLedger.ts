import { FileSystemAdapter, normalizeVaultPath } from './fs';

export interface LedgerData {
    syncedKeys: { [key: string]: string }; // Key -> ETag
}

export class SyncLedger {
    private data: LedgerData = { syncedKeys: {} };
    private readonly ledgerPath: string;

    constructor(
        private readonly fs: FileSystemAdapter,
        ledgerPath: string
    ) {
        this.ledgerPath = normalizeVaultPath(ledgerPath);
    }

    async load(): Promise<void> {
        if (!(await this.fs.exists(this.ledgerPath))) {
            this.data = { syncedKeys: {} };
            return;
        }

        const content = await this.fs.read(this.ledgerPath);
        try {
            const parsed = JSON.parse(content);
            this.data = {
                syncedKeys: parsed && typeof parsed.syncedKeys === 'object' && parsed.syncedKeys
                    ? parsed.syncedKeys
                    : {}
            };
        } catch (e: any) {
            console.error('Failed to parse ledger:', e);
            this.data = { syncedKeys: {} };
        }
    }

    /**
     * Atomic save: write `<path>.tmp` then rename over the target.
     */
    async save(): Promise<void> {
        const tmpPath = `${this.ledgerPath}.tmp`;
        const payload = JSON.stringify(this.data, null, 2);
        await this.fs.write(tmpPath, payload);
        await this.fs.rename(tmpPath, this.ledgerPath);
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
