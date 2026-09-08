import { App, Notice } from 'obsidian';
import { S3Manager } from './S3Manager';
import { SyncLedger } from './SyncLedger';
import { ObsidianVaultAdapter } from './adapters/ObsidianVaultAdapter';
import { SyncEngine as CoreSyncEngine, SyncProgress } from './core/SyncEngine';

export class SyncEngine {
    private readonly core: CoreSyncEngine;

    constructor(app: App, s3: S3Manager, ledger: SyncLedger, config: any) {
        this.core = new CoreSyncEngine(
            new ObsidianVaultAdapter(app),
            s3,
            ledger.getCore(),
            {
                localBasePath: config.localBasePath,
                prefix: config.prefix ?? '',
                force: !!config.force,
                stopOnError: true,
            },
            (event: SyncProgress) => {
                if (event.type === 'done') {
                    const downloadedCount = event.downloadedCount ?? 0;
                    const skippedCount = event.skippedCount ?? 0;
                    if (downloadedCount > 0) {
                        new Notice(`S3 Sync: Downloaded ${downloadedCount} files, skipped ${skippedCount}.`);
                    } else if (!config.force) {
                        console.log(`S3 Sync: No new files found. Skipped ${skippedCount}.`);
                    }
                }
            }
        );
    }

    async run(): Promise<void> {
        try {
            await this.core.run();
        } catch (error: any) {
            console.error('S3 Sync Error:', error);
            new Notice(`S3 Sync Failed: ${error.message}`);
            throw error;
        }
    }
}
