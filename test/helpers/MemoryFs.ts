import { FileSystemAdapter } from '../../src/core/fs';

export class MemoryFs implements FileSystemAdapter {
    files = new Map<string, string>();
    dirs = new Set<string>();

    async exists(p: string): Promise<boolean> {
        return this.files.has(p) || this.dirs.has(p);
    }

    async read(p: string): Promise<string> {
        const value = this.files.get(p);
        if (value === undefined) throw new Error(`ENOENT: ${p}`);
        return value;
    }

    async write(p: string, content: string): Promise<void> {
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
}
