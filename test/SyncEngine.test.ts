import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SyncEngine } from '../src/SyncEngine';
import { S3Manager } from '../src/S3Manager';
import { SyncLedger } from '../src/SyncLedger';
import { TFolder as ObsidianTFolder } from 'obsidian';

// Mock S3Manager
vi.mock('../src/S3Manager');

describe('SyncEngine', () => {
    let mockApp: any;
    let mockS3: any;
    let ledger: SyncLedger;
    let syncEngine: SyncEngine;
    let mockConfig: any;
    let mockPlugin: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock Obsidian App and Vault
        mockApp = {
            vault: {
                adapter: {
                    write: vi.fn().mockResolvedValue(undefined),
                    writeBinary: vi.fn().mockResolvedValue(undefined),
                    read: vi.fn(),
                    exists: vi.fn().mockResolvedValue(false),
                    rename: vi.fn().mockResolvedValue(undefined),
                    remove: vi.fn().mockResolvedValue(undefined),
                },
                getAbstractFileByPath: vi.fn(),
                createFolder: vi.fn().mockResolvedValue(undefined),
            },
            loadData: vi.fn().mockResolvedValue({}),
        };

        mockPlugin = {
            app: mockApp,
            manifest: { dir: '.obsidian/plugins/remote-sync' },
            loadData: vi.fn().mockResolvedValue({}),
        };

        // Real SyncLedger instance
        ledger = new SyncLedger(mockPlugin);

        // Mock S3Manager instances
        mockS3 = new S3Manager({} as any) as any;

        mockConfig = {
            localBasePath: 'Inbox',
            prefix: 'notes/',
            force: false
        };

        syncEngine = new SyncEngine(mockApp as any, mockS3 as any, ledger, mockConfig);
    });

    it('should successfully sync new files (Happy Path)', async () => {
        // Setup S3 mocks
        mockS3.listObjects.mockResolvedValue([
            { key: 'notes/test1.md', etag: 'tag1' },
            { key: 'notes/folder/test2.md', etag: 'tag2' }
        ]);
        mockS3.getObject.mockResolvedValue('content');

        // Mock folder check
        mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

        await syncEngine.run();

        // Verify calls
        expect(mockS3.listObjects).toHaveBeenCalled();
        expect(mockS3.getObject).toHaveBeenCalledWith('notes/test1.md');

        // Check file writes
        expect(mockApp.vault.adapter.write).toHaveBeenCalledWith('Inbox/test1.md', 'content');

        // Verify ledger recorded it (using real logic)
        expect(ledger.isSynced('notes/test1.md', 'tag1')).toBe(true);
        expect(mockApp.vault.adapter.write).toHaveBeenCalledWith('.obsidian/plugins/remote-sync/ledger.json.tmp', expect.any(String));
        expect(mockApp.vault.adapter.rename).toHaveBeenCalledWith(
            '.obsidian/plugins/remote-sync/ledger.json.tmp',
            '.obsidian/plugins/remote-sync/ledger.json'
        );
    });

    it('should skip already synced files using real ledger logic', async () => {
        // Pre-populate ledger
        ledger.record('notes/exists.md', 'tag-same');

        mockS3.listObjects.mockResolvedValue([
            { key: 'notes/exists.md', etag: 'tag-same' }
        ]);

        await syncEngine.run();

        expect(mockS3.getObject).not.toHaveBeenCalled();
        expect(mockApp.vault.adapter.write).not.toHaveBeenCalledWith('Inbox/exists.md', expect.any(String));
    });

    it('should re-download if etag changes', async () => {
        ledger.record('notes/changed.md', 'old-tag');

        mockS3.listObjects.mockResolvedValue([
            { key: 'notes/changed.md', etag: 'new-tag' }
        ]);
        mockS3.getObject.mockResolvedValue('new content');
        mockApp.vault.getAbstractFileByPath.mockImplementation((p: string) => {
            if (p === 'Inbox' || p.startsWith('Inbox/')) return new ObsidianTFolder();
            return null;
        });

        await syncEngine.run();

        expect(mockS3.getObject).toHaveBeenCalledWith('notes/changed.md');
        expect(mockApp.vault.adapter.write).toHaveBeenCalledWith('Inbox/changed.md', 'new content');
        expect(ledger.isSynced('notes/changed.md', 'new-tag')).toBe(true);
    });

    it('should handle S3 network errors (Sad Path)', async () => {
        mockS3.listObjects.mockRejectedValue(new Error('Network error'));

        await expect(syncEngine.run()).rejects.toThrow('Network error');
    });

    it('should throw error if path exists but is not a folder', async () => {
        mockS3.listObjects.mockResolvedValue([{ key: 'notes/conflict.md', etag: 'tag' }]);

        // Mock that a file exists where a folder should be
        mockApp.vault.getAbstractFileByPath.mockImplementation((p: string) => {
            if (p === 'Inbox') return {};
            return null;
        });

        await expect(syncEngine.run()).rejects.toThrow('exists but is not a folder');
    });
});
