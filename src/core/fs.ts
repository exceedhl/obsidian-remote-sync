export type FileContent = string | Uint8Array;

export interface WriteOptions {
    exclusive?: boolean;
}

/**
 * Filesystem used by the sync core. Named to avoid clashing with Obsidian's DataAdapter.
 */
export interface SyncFsAdapter {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
    mkdir(path: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    isDirectory(path: string): Promise<boolean>;
    remove(path: string): Promise<void>;
}

export function normalizeVaultPath(input: string): string {
    const normalized = input.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (normalized.length > 1 && normalized.endsWith('/')) {
        return normalized.slice(0, -1);
    }
    return normalized;
}

/**
 * Resolve `.` / `..`. Returns null if the path is absolute or climbs above the first segment.
 */
export function resolveDotSegments(input: string): string | null {
    const normalized = normalizeVaultPath(input);
    if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
        return null;
    }

    const parts: string[] = [];
    for (const part of normalized.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (parts.length === 0) return null;
            parts.pop();
            continue;
        }
        parts.push(part);
    }
    return parts.join('/');
}

/**
 * Strip an S3 prefix as a path (so `notes` does not match `notes-other/...`).
 * Empty string means the key is the prefix folder itself. null means not under prefix.
 */
export function stripS3Prefix(key: string, prefix: string): string | null {
    if (!prefix) return key;
    const p = prefix.replace(/\/+$/, '');
    if (!p) return key;
    if (key === p || key === `${p}/`) return '';
    if (key.startsWith(`${p}/`)) return key.slice(p.length + 1);
    return null;
}

/**
 * Join localBasePath + object relative path. Returns null to skip (folder placeholder).
 * Throws if the result would escape localBasePath.
 */
export function safeDownloadPath(localBasePath: string, relativePath: string): string | null {
    if (!relativePath || relativePath.endsWith('/')) return null;

    const resolved = resolveDotSegments(`${localBasePath}/${relativePath}`);
    const base = resolveDotSegments(localBasePath);
    if (resolved === null || base === null || !base) {
        throw new Error(`Refusing to write outside ${localBasePath}: ${relativePath}`);
    }
    if (resolved === base) return null;
    if (!resolved.startsWith(`${base}/`)) {
        throw new Error(`Refusing to write outside ${localBasePath}: ${relativePath}`);
    }
    return resolved;
}
