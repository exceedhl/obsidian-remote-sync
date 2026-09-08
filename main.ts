import { Plugin, Notice } from 'obsidian';
import { S3RemoteSyncSettingTab } from './src/SettingsTab';
import { SyncEngine } from './src/SyncEngine';
import { createS3Manager } from './src/S3Manager';
import { SyncLedger } from './src/SyncLedger';
import { SecretManager } from './src/SecretManager';

interface RemoteSyncSettings {
    endpoint: string;
    region: string;
    bucket: string;
    s3Prefix: string;
    localBasePath: string;
    syncInterval: number;
    forceReDownload: boolean;
}

const DEFAULT_SETTINGS: RemoteSyncSettings = {
    endpoint: '',
    region: 'auto',
    bucket: '',
    s3Prefix: '',
    localBasePath: 'S3-Sync',
    syncInterval: 30,
    forceReDownload: false
};

export default class S3RemoteSync extends Plugin {
    settings!: RemoteSyncSettings;
    ledger!: SyncLedger;
    secretManager!: SecretManager;
    syncIntervalReference: number | null = null;
    private syncInFlight = false;
    private ledgerReady = false;

    async onload() {
        console.log('S3 Remote Sync plugin loading...');
        await this.loadSettings();

        this.ledger = new SyncLedger(this);
        try {
            await this.ledger.load();
            this.ledgerReady = true;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('S3 Sync: Failed to load ledger.json:', e);
            new Notice(`S3 Sync: Failed to load ledger.json: ${message}`);
        }

        this.secretManager = new SecretManager(this.app, this);

        // Add settings tab
        this.addSettingTab(new S3RemoteSyncSettingTab(this.app, this));

        // Add command to trigger sync
        this.addCommand({
            id: 'start-s3-fetch-sync',
            name: 'Start Sync',
            callback: () => this.runSync(),
        });

        // Setup auto-sync scheduler
        this.setupScheduler();

        console.log('S3 Remote Sync plugin loaded');
    }

    onunload() {
        this.clearScheduler();
        console.log('S3 Remote Sync plugin unloaded');
    }

    /**
     * Main sync execution logic
     */
    async runSync() {
        if (this.syncInFlight) return;
        if (!this.ledgerReady) {
            new Notice('S3 Sync: ledger.json is unusable; fix or restore it before syncing.');
            return;
        }

        this.syncInFlight = true;
        try {
            const ak = await this.secretManager.loadSecret('access-key-id');
            const sk = await this.secretManager.loadSecret('secret-access-key');

            if (!ak || !sk || !this.settings.bucket) {
                new Notice('S3 Sync: Credentials or bucket not configured.');
                return;
            }

            const s3 = createS3Manager({
                endpoint: this.settings.endpoint,
                region: this.settings.region,
                bucket: this.settings.bucket,
                accessKeyId: ak,
                secretAccessKey: sk,
                prefix: this.settings.s3Prefix
            });

            const engine = new SyncEngine(this.app, s3, this.ledger, {
                localBasePath: this.settings.localBasePath,
                prefix: this.settings.s3Prefix,
                force: this.settings.forceReDownload
            });

            new Notice('S3 Sync: Starting...');
            await engine.run();
        } catch (e: unknown) {
            console.error('S3 Sync Error:', e);
        } finally {
            this.syncInFlight = false;
        }
    }

    /**
     * Setup background auto-sync
     */
    setupScheduler() {
        this.clearScheduler();
        if (this.settings.syncInterval > 0) {
            this.syncIntervalReference = window.setInterval(
                () => this.runSync(),
                this.settings.syncInterval * 60 * 1000
            );
            this.registerInterval(this.syncIntervalReference);
        }
    }

    clearScheduler() {
        if (this.syncIntervalReference !== null) {
            window.clearInterval(this.syncIntervalReference);
            this.syncIntervalReference = null;
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
