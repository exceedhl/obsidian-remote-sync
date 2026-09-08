import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import S3RemoteSync from '../main';
import { S3Manager } from './S3Manager';
import { SecretManager } from './SecretManager';

export class S3RemoteSyncSettingTab extends PluginSettingTab {
    plugin: S3RemoteSync;
    secretManager: SecretManager;

    constructor(app: App, plugin: S3RemoteSync) {
        super(app, plugin);
        this.plugin = plugin;
        this.secretManager = new SecretManager(app, this.plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'S3 Remote Sync Settings' });

        // --- S3 Connection Section ---
        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('S3 compatible endpoint (e.g., https://s3.amazonaws.com)')
            .addText((text) => text
                .setPlaceholder('https://...')
                .setValue(this.plugin.settings.endpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.endpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Region')
            .setDesc('S3 region (e.g., us-east-1)')
            .addText((text) => text
                .setPlaceholder('auto')
                .setValue(this.plugin.settings.region)
                .onChange(async (value: string) => {
                    this.plugin.settings.region = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Bucket')
            .setDesc('S3 bucket name')
            .addText((text) => text
                .setPlaceholder('my-notes-bucket')
                .setValue(this.plugin.settings.bucket)
                .onChange(async (value: string) => {
                    this.plugin.settings.bucket = value;
                    await this.plugin.saveSettings();
                }));

        // Access Key (Secret)
        let accessKeyInput: HTMLInputElement;
        new Setting(containerEl)
            .setName('Access Key ID')
            .setDesc('S3 Access Key ID (Stored in System Keychain)')
            .addText((text) => {
                accessKeyInput = text.inputEl;
                text.inputEl.type = 'password';
                text.setPlaceholder('AKIA...')
                    .onChange(async (value: string) => {
                        if (value) {
                            await this.secretManager.saveSecret('access-key-id', value);
                        }
                    });
                // Load existing value
                this.secretManager.loadSecret('access-key-id').then((val: string | null) => {
                    if (val) text.setValue(val);
                });
            })
            .addExtraButton((btn) => {
                btn.setIcon('eye-off')
                    .setTooltip('Reveal/Hide')
                    .onClick(() => {
                        const isPassword = accessKeyInput.type === 'password';
                        accessKeyInput.type = isPassword ? 'text' : 'password';
                        btn.setIcon(isPassword ? 'eye' : 'eye-off');
                    });
            });

        // Secret Key (Secret)
        let secretKeyInput: HTMLInputElement;
        new Setting(containerEl)
            .setName('Secret Access Key')
            .setDesc('S3 Secret Access Key (Stored in System Keychain)')
            .addText((text) => {
                secretKeyInput = text.inputEl;
                text.inputEl.type = 'password';
                text.setPlaceholder('wJalr...')
                    .onChange(async (value: string) => {
                        if (value) {
                            await this.secretManager.saveSecret('secret-access-key', value);
                        }
                    });
                // Load existing value
                this.secretManager.loadSecret('secret-access-key').then((val: string | null) => {
                    if (val) text.setValue(val);
                });
            })
            .addExtraButton((btn) => {
                btn.setIcon('eye-off')
                    .setTooltip('Reveal/Hide')
                    .onClick(() => {
                        const isPassword = secretKeyInput.type === 'password';
                        secretKeyInput.type = isPassword ? 'text' : 'password';
                        btn.setIcon(isPassword ? 'eye' : 'eye-off');
                    });
            });

        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Verify your S3 credentials')
            .addButton((btn) => btn
                .setButtonText('Test')
                .onClick(async () => {
                    try {
                        const ak = await this.secretManager.loadSecret('access-key-id');
                        const sk = await this.secretManager.loadSecret('secret-access-key');
                        if (!ak || !sk) throw new Error('Missing AK/SK');

                        const s3 = new S3Manager({
                            ...this.plugin.settings,
                            accessKeyId: ak,
                            secretAccessKey: sk,
                            prefix: this.plugin.settings.s3Prefix
                        });
                        await s3.testConnection();
                        new Notice('S3 Connection successful!');
                    } catch (e: any) {
                        new Notice(`Connection failed: ${e.message}`);
                    }
                }));

        // --- Sync Path Section ---
        containerEl.createEl('h3', { text: 'Path Configuration' });

        new Setting(containerEl)
            .setName('S3 Prefix')
            .setDesc('Folder in S3 to sync from (e.g., notes/)')
            .addText((text) => text
                .setPlaceholder('notes/')
                .setValue(this.plugin.settings.s3Prefix)
                .onChange(async (value: string) => {
                    this.plugin.settings.s3Prefix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Local Base Path')
            .setDesc('Local folder in your vault to save notes (e.g., Inbox)')
            .addText((text) => text
                .setPlaceholder('Inbox')
                .setValue(this.plugin.settings.localBasePath)
                .onChange(async (value: string) => {
                    this.plugin.settings.localBasePath = value;
                    await this.plugin.saveSettings();
                }));

        // --- Automation Section ---
        containerEl.createEl('h3', { text: 'Automation' });

        new Setting(containerEl)
            .setName('Sync Interval (Minutes)')
            .setDesc('How often to check for updates (0 to disable auto-sync)')
            .addText((text) => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.syncInterval))
                .onChange(async (value: string) => {
                    const val = parseInt(value);
                    if (!isNaN(val)) {
                        this.plugin.settings.syncInterval = val;
                        await this.plugin.saveSettings();
                        this.plugin.setupScheduler();
                    }
                }));

        new Setting(containerEl)
            .setName('Force Re-download')
            .setDesc('Ignore ledger and download all files (Caution: will overwrite local changes)')
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.forceReDownload)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.forceReDownload = value;
                    await this.plugin.saveSettings();
                }));
    }
}
