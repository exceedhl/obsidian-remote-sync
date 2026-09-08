export interface FileSystemAdapter {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    isDirectory(path: string): Promise<boolean>;
}

/**
 * Vault-style path normalize: forward slashes, collapse duplicates, drop trailing slash.
 */
export function normalizeVaultPath(input: string): string {
    const normalized = input.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (normalized.length > 1 && normalized.endsWith('/')) {
        return normalized.slice(0, -1);
    }
    return normalized;
}
