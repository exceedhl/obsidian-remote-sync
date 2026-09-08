import { Plugin } from 'obsidian';
import { ObsidianVaultAdapter } from './adapters/ObsidianVaultAdapter';
import { SyncLedger as CoreSyncLedger, LedgerData } from './core/SyncLedger';

export type { LedgerData };

export class SyncLedger {
    private readonly core: CoreSyncLedger;

    constructor(plugin: Plugin) {
        this.core = new CoreSyncLedger(
            new ObsidianVaultAdapter(plugin.app),
            `${plugin.manifest.dir}/ledger.json`
        );
    }

    getCore(): CoreSyncLedger {
        return this.core;
    }

    async load(): Promise<void> {
        return this.core.load();
    }

    async save(): Promise<void> {
        return this.core.save();
    }

    isSynced(key: string, etag?: string): boolean {
        return this.core.isSynced(key, etag);
    }

    record(key: string, etag: string): void {
        this.core.record(key, etag);
    }

    clear(): void {
        this.core.clear();
    }
}
