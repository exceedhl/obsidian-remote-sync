import { FileContent, SyncFsAdapter, WriteOptions } from '../../src/core/fs';

export class MemoryFs implements SyncFsAdapter {
    files = new Map<string, FileContent>();
    dirs = new Set<string>();

    async exists(p: string): Promise<boolean> {
        return this.files.has(p) || this.dirs.has(p);
    }

    async read(p: string): Promise<string> {
        const value = this.files.get(p);
        if (value === undefined) throw new Error(`ENOENT: ${p}`);
        return typeof value === 'string' ? value : new TextDecoder().decode(value);
    }

    async write(p: string, content: FileContent, options?: WriteOptions): Promise<void> {
        if (options?.exclusive && (this.files.has(p) || this.dirs.has(p))) {
            throw new Error(`EEXIST: ${p}`);
        }
        this.files.set(p, content);
    }

    async mkdir(p: string): Promise<void> {
        if (this.files.has(p)) throw new Error(`Path ${p} exists but is not a folder`);
        this.dirs.add(p);
    }

    async rename(from: string, to: string): Promise<void> {
        const value = this.files.get(from);
        if (value === undefined) throw new Error(`ENOENT: ${from}`);
        this.files.set(to, value);
        this.files.delete(from);
    }

    async isDirectory(p: string): Promise<boolean> {
        return this.dirs.has(p);
    }

    async remove(p: string): Promise<void> {
        if (!this.files.has(p) && !this.dirs.has(p)) throw new Error(`ENOENT: ${p}`);
        this.files.delete(p);
        this.dirs.delete(p);
    }
}
