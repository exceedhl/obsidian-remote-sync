import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../src/core/SyncEngine';
import { SyncLedger } from '../src/core/SyncLedger';
import { MemoryFs } from './helpers/MemoryFs';
import { FileSystemSyncError, S3SyncError } from '../src/core/errors';

describe('SyncEngine (core, fake fs)', () => {
    let fs: MemoryFs;
    let ledger: SyncLedger;
    let s3: {
        listObjects: ReturnType<typeof vi.fn>;
        getObject: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        fs = new MemoryFs();
        ledger = new SyncLedger(fs, '.obsidian/plugins/remote-sync/ledger.json');
        s3 = {
            listObjects: vi.fn(),
            getObject: vi.fn(),
        };
    });

    function engine(opts: { force?: boolean; dryRun?: boolean; stopOnError?: boolean } = {}) {
        return new SyncEngine(fs, s3 as any, ledger, {
            localBasePath: 'Inbox',
            prefix: 'notes/',
            force: !!opts.force,
            dryRun: !!opts.dryRun,
            stopOnError: opts.stopOnError,
        });
    }

    it('downloads new files through the injected adapter and records the ledger', async () => {
        s3.listObjects.mockResolvedValue([
            { key: 'notes/test1.md', etag: 'tag1' },
            { key: 'notes/folder/test2.md', etag: 'tag2' },
        ]);
        s3.getObject.mockResolvedValue('content');

        const result = await engine().run();

        expect(result.success).toBe(true);
        expect(result.downloaded).toEqual(['Inbox/test1.md', 'Inbox/folder/test2.md']);
        expect(result.skippedCount).toBe(0);
        expect(fs.files.get('Inbox/test1.md')).toBe('content');
        expect(fs.files.get('Inbox/folder/test2.md')).toBe('content');
        expect(fs.dirs.has('Inbox')).toBe(true);
        expect(fs.dirs.has('Inbox/folder')).toBe(true);
        expect(ledger.isSynced('notes/test1.md', 'tag1')).toBe(true);
        expect(fs.files.has('.obsidian/plugins/remote-sync/ledger.json')).toBe(true);
        expect(fs.files.has('.obsidian/plugins/remote-sync/ledger.json.tmp')).toBe(false);
    });

    it('skips keys already in the ledger', async () => {
        ledger.record('notes/exists.md', 'tag-same');
        s3.listObjects.mockResolvedValue([{ key: 'notes/exists.md', etag: 'tag-same' }]);

        const result = await engine().run();

        expect(s3.getObject).not.toHaveBeenCalled();
        expect(result.downloaded).toEqual([]);
        expect(result.skippedCount).toBe(1);
        expect(fs.files.has('Inbox/exists.md')).toBe(false);
    });

    it('dry-run lists pending downloads without writing files or updating the ledger', async () => {
        s3.listObjects.mockResolvedValue([{ key: 'notes/new.md', etag: 't1' }]);
        s3.getObject.mockResolvedValue('should-not-fetch');

        const result = await engine({ dryRun: true }).run();

        expect(result.downloaded).toEqual(['Inbox/new.md']);
        expect(s3.getObject).not.toHaveBeenCalled();
        expect(fs.files.has('Inbox/new.md')).toBe(false);
        expect(fs.files.has('.obsidian/plugins/remote-sync/ledger.json')).toBe(false);
        expect(ledger.isSynced('notes/new.md', 't1')).toBe(false);
    });

    it('force re-downloads even when the ledger already has the key', async () => {
        ledger.record('notes/exists.md', 'tag-same');
        s3.listObjects.mockResolvedValue([{ key: 'notes/exists.md', etag: 'tag-same' }]);
        s3.getObject.mockResolvedValue('forced');

        const result = await engine({ force: true }).run();

        expect(s3.getObject).toHaveBeenCalledWith('notes/exists.md');
        expect(result.downloaded).toEqual(['Inbox/exists.md']);
        expect(result.skippedCount).toBe(0);
        expect(fs.files.get('Inbox/exists.md')).toBe('forced');
    });

    it('wraps listObjects failures as S3SyncError', async () => {
        s3.listObjects.mockRejectedValue(new Error('Network error'));
        await expect(engine().run()).rejects.toBeInstanceOf(S3SyncError);
        await expect(engine().run()).rejects.toThrow('Network error');
    });

    it('throws FileSystemSyncError when a path exists but is not a folder', async () => {
        s3.listObjects.mockResolvedValue([{ key: 'notes/conflict.md', etag: 'tag' }]);
        fs.files.set('Inbox', 'i-am-a-file');

        await expect(engine().run()).rejects.toBeInstanceOf(FileSystemSyncError);
        await expect(engine().run()).rejects.toThrow('exists but is not a folder');
    });

    it('collects per-file failures when stopOnError is false', async () => {
        s3.listObjects.mockResolvedValue([
            { key: 'notes/ok.md', etag: 't1' },
            { key: 'notes/bad.md', etag: 't2' },
        ]);
        s3.getObject.mockImplementation(async (key: string) => {
            if (key === 'notes/bad.md') throw new Error('AccessDenied');
            return 'ok';
        });

        const result = await engine({ stopOnError: false }).run();
        expect(result.success).toBe(false);
        expect(result.downloaded).toEqual(['Inbox/ok.md']);
        expect(result.failed).toEqual([
            { key: 'notes/bad.md', error: 'AccessDenied', exitCode: 2 },
        ]);
        expect(fs.files.get('Inbox/ok.md')).toBe('ok');
    });
});
