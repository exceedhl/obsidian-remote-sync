import { App, TFolder } from 'obsidian';
import { FileSystemAdapter } from '../core/fs';

export class ObsidianVaultAdapter implements FileSystemAdapter {
    constructor(private readonly app: App) {}

    async exists(path: string): Promise<boolean> {
        if (this.app.vault.getAbstractFileByPath(path)) return true;
        return this.app.vault.adapter.exists(path);
    }

    async read(path: string): Promise<string> {
        return this.app.vault.adapter.read(path);
    }

    async write(path: string, content: string): Promise<void> {
        await this.app.vault.adapter.write(path, content);
    }

    async mkdir(path: string): Promise<void> {
        await this.app.vault.createFolder(path);
    }

    async rename(from: string, to: string): Promise<void> {
        await this.app.vault.adapter.rename(from, to);
    }

    async isDirectory(path: string): Promise<boolean> {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) return file instanceof TFolder;
        return false;
    }
}
