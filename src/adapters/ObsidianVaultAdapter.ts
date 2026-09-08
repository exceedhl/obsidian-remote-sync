import { App, TFolder } from 'obsidian';
import { FileContent, SyncFsAdapter, WriteOptions } from '../core/fs';

export class ObsidianVaultAdapter implements SyncFsAdapter {
    constructor(private readonly app: App) {}

    async exists(path: string): Promise<boolean> {
        if (this.app.vault.getAbstractFileByPath(path)) return true;
        return this.app.vault.adapter.exists(path);
    }

    async read(path: string): Promise<string> {
        return this.app.vault.adapter.read(path);
    }

    async write(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
        if (options?.exclusive && await this.exists(path)) {
            throw new Error(`EEXIST: ${path}`);
        }
        if (typeof content === 'string') {
            await this.app.vault.adapter.write(path, content);
            return;
        }
        const buffer = content.buffer.slice(
            content.byteOffset,
            content.byteOffset + content.byteLength
        ) as ArrayBuffer;
        await this.app.vault.adapter.writeBinary(path, buffer);
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

    async remove(path: string): Promise<void> {
        await this.app.vault.adapter.remove(path);
    }
}
