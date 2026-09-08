import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { obfuscateSecret } from '../src/core/secrets';
import { runCli } from '../src/cli/index';

const s3Mocks = vi.hoisted(() => ({
    listObjects: vi.fn(),
    getObject: vi.fn(),
    testConnection: vi.fn(),
}));

vi.mock('../src/S3Manager', () => ({
    S3Manager: class {
        listObjects = s3Mocks.listObjects;
        getObject = s3Mocks.getObject;
        testConnection = s3Mocks.testConnection;
        prefix = '';
    },
    createS3Manager: (config: { prefix?: string }) => ({
        listObjects: s3Mocks.listObjects,
        getObject: s3Mocks.getObject,
        testConnection: s3Mocks.testConnection,
        prefix: config.prefix ?? '',
    }),
}));

describe('runCli', () => {
    let vault: string;
    const logs: string[] = [];
    const errors: string[] = [];
    const io = {
        log: (m: string) => { logs.push(m); },
        error: (m: string) => { errors.push(m); },
    };

    beforeEach(async () => {
        logs.length = 0;
        errors.length = 0;
        s3Mocks.listObjects.mockReset();
        s3Mocks.getObject.mockReset();
        s3Mocks.testConnection.mockReset();
        vault = await mkdtemp(path.join(tmpdir(), 's3-cli-vault-'));
    });

    afterEach(async () => {
        await rm(vault, { recursive: true, force: true });
    });

    async function writePluginData(pluginId: string, extra: Record<string, unknown> = {}) {
        const dir = path.join(vault, '.obsidian', 'plugins', pluginId);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'data.json'), JSON.stringify({
            endpoint: 'https://s3.example',
            region: 'auto',
            bucket: 'notes',
            s3Prefix: 'notes/',
            localBasePath: 'Inbox',
            secrets: {
                'access-key-id': obfuscateSecret('ak'),
                'secret-access-key': obfuscateSecret('sk'),
            },
            ...extra,
        }), 'utf8');
    }

    it('returns 1 when the plugin directory cannot be found', async () => {
        const code = await runCli(['--vault', vault], {}, io);
        expect(code).toBe(1);
        expect(errors[0]).toMatch(/Plugin directory not found/);
    });

    it('returns 1 when credentials are missing', async () => {
        const dir = path.join(vault, '.obsidian', 'plugins', 'remote-sync');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'data.json'), JSON.stringify({ endpoint: 'https://x' }), 'utf8');

        const code = await runCli(['--vault', vault], {}, io);
        expect(code).toBe(1);
        expect(errors[0]).toMatch(/Missing required configuration/);
    });

    it('run --json --dry-run uses the development plugin dir and XOR secrets', async () => {
        await writePluginData('remote-sync');
        s3Mocks.listObjects.mockResolvedValue([{ key: 'notes/a.md', etag: 't1' }]);

        const code = await runCli(['run', '--vault', vault, '--dry-run', '--json'], {}, io);
        expect(code).toBe(0);
        expect(JSON.parse(logs[0])).toEqual({
            downloaded: ['Inbox/a.md'],
            skippedCount: 0,
            failed: [],
            success: true,
            dryRun: true,
        });
        expect(s3Mocks.getObject).not.toHaveBeenCalled();
    });

    it('run --force downloads a ledgered key and returns 0', async () => {
        await writePluginData('obsidian-s3-remote-sync');
        const ledgerPath = path.join(vault, '.obsidian', 'plugins', 'obsidian-s3-remote-sync', 'ledger.json');
        await writeFile(ledgerPath, JSON.stringify({ syncedKeys: { 'notes/a.md': 't1' } }), 'utf8');
        s3Mocks.listObjects.mockResolvedValue([{ key: 'notes/a.md', etag: 't1' }]);
        s3Mocks.getObject.mockResolvedValue('body');

        const code = await runCli(['--vault', vault, '--force'], {}, io);
        expect(code).toBe(0);
        expect(s3Mocks.getObject).toHaveBeenCalledWith('notes/a.md');
    });

    it('returns 2 when S3 listing fails', async () => {
        await writePluginData('remote-sync');
        s3Mocks.listObjects.mockRejectedValue(new Error('AccessDenied'));

        const code = await runCli(['--vault', vault], {}, io);
        expect(code).toBe(2);
    });

    it('test returns 0 after a successful connection', async () => {
        await writePluginData('remote-sync');
        s3Mocks.testConnection.mockResolvedValue(undefined);

        const code = await runCli(['test', '--vault', vault], {}, io);
        expect(code).toBe(0);
        expect(logs[0]).toMatch(/successful/);
    });

    it('test can run from flags without a plugin directory', async () => {
        s3Mocks.testConnection.mockResolvedValue(undefined);
        const code = await runCli([
            'test',
            '--vault', vault,
            '--endpoint', 'https://s3.example',
            '--bucket', 'notes',
            '--access-key', 'ak',
            '--secret-key', 'sk',
        ], {}, io);
        expect(code).toBe(0);
        expect(s3Mocks.testConnection).toHaveBeenCalled();
    });

    it('returns 1 when an explicit plugin dir is missing', async () => {
        const code = await runCli(['test', '--vault', vault, '--plugin-dir', 'missing'], {}, io);
        expect(code).toBe(1);
        expect(errors[0]).toMatch(/Plugin directory not found/);
    });

    it('status lists pending keys and ignores prefix placeholders', async () => {
        await writePluginData('remote-sync');
        s3Mocks.listObjects.mockResolvedValue([
            { key: 'notes/', etag: 'd41' },
            { key: 'notes/a.md', etag: 't1' },
        ]);

        const code = await runCli(['status', '--vault', vault], {}, io);
        expect(code).toBe(0);
        expect(logs.join('\n')).toMatch(/Pending: 1/);
        expect(logs.join('\n')).toMatch(/notes\/a.md/);
        expect(logs.join('\n')).not.toMatch(/notes\/ \(/);
    });

    it('returns 3 when a local path exists but is not a folder', async () => {
        await writePluginData('remote-sync');
        await writeFile(path.join(vault, 'Inbox'), 'not-a-folder');
        s3Mocks.listObjects.mockResolvedValue([{ key: 'notes/a.md', etag: 't1' }]);
        s3Mocks.getObject.mockResolvedValue('body');

        const code = await runCli(['--vault', vault], {}, io);
        expect(code).toBe(3);
    });

    it('returns 3 when ledger.json is corrupt', async () => {
        await writePluginData('remote-sync');
        await writeFile(
            path.join(vault, '.obsidian', 'plugins', 'remote-sync', 'ledger.json'),
            '{not-json',
            'utf8'
        );

        const code = await runCli(['--vault', vault], {}, io);
        expect(code).toBe(3);
        expect(errors[0]).toMatch(/Failed to parse ledger/);
    });

    it('returns 1 when a fresh sync lock exists', async () => {
        await writePluginData('remote-sync');
        await writeFile(
            path.join(vault, '.obsidian', 'plugins', 'remote-sync', 'ledger.json.lock'),
            JSON.stringify({ updatedAt: Date.now() }),
            'utf8'
        );
        s3Mocks.listObjects.mockResolvedValue([{ key: 'notes/a.md', etag: 't1' }]);

        const code = await runCli(['--vault', vault], {}, io);
        expect(code).toBe(1);
        expect(errors[0]).toMatch(/already in progress/);
        expect(s3Mocks.getObject).not.toHaveBeenCalled();
    });
});
