import { describe, it, expect } from 'vitest';
import { resolveDotSegments, safeDownloadPath, stripS3Prefix } from '../src/core/fs';

describe('path helpers', () => {
    it('resolves dot segments and rejects escapes', () => {
        expect(resolveDotSegments('Inbox/a/./b')).toBe('Inbox/a/b');
        expect(resolveDotSegments('Inbox/../outside')).toBe('outside');
        expect(resolveDotSegments('../outside')).toBeNull();
        expect(resolveDotSegments('/abs')).toBeNull();
    });

    it('keeps downloads under localBasePath', () => {
        expect(safeDownloadPath('Inbox', 'a.md')).toBe('Inbox/a.md');
        expect(safeDownloadPath('Inbox', '')).toBeNull();
        expect(safeDownloadPath('Inbox', 'folder/')).toBeNull();
        expect(() => safeDownloadPath('Inbox', '../../etc/passwd')).toThrow(/Refusing to write outside/);
    });

    it('strips S3 prefix as a path', () => {
        expect(stripS3Prefix('notes/a.md', 'notes/')).toBe('a.md');
        expect(stripS3Prefix('notes/a.md', 'notes')).toBe('a.md');
        expect(stripS3Prefix('notes/', 'notes/')).toBe('');
        expect(stripS3Prefix('notes-other/x.md', 'notes')).toBeNull();
        expect(stripS3Prefix('other.md', 'notes/')).toBeNull();
    });
});
