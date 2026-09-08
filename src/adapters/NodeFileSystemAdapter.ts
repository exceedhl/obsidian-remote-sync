import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { FileContent, SyncFsAdapter, WriteOptions } from '../core/fs';

export class NodeFileSystemAdapter implements SyncFsAdapter {
    constructor(private readonly root: string) {}

    private resolve(p: string): string {
        if (path.isAbsolute(p)) return p;
        return path.join(this.root, p);
    }

    async exists(p: string): Promise<boolean> {
        try {
            await fs.access(this.resolve(p));
            return true;
        } catch {
            return false;
        }
    }

    async read(p: string): Promise<string> {
        return fs.readFile(this.resolve(p), 'utf8');
    }

    async write(p: string, content: FileContent, options?: WriteOptions): Promise<void> {
        await fs.writeFile(
            this.resolve(p),
            content,
            options?.exclusive ? { flag: 'wx' } : undefined
        );
    }

    async mkdir(p: string): Promise<void> {
        await fs.mkdir(this.resolve(p));
    }

    async rename(from: string, to: string): Promise<void> {
        await fs.rename(this.resolve(from), this.resolve(to));
    }

    async isDirectory(p: string): Promise<boolean> {
        try {
            const stat = await fs.stat(this.resolve(p));
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    async remove(p: string): Promise<void> {
        await fs.unlink(this.resolve(p));
    }
}
