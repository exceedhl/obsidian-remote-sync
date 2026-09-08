import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { SyncLedger } from '../src/core/SyncLedger';
import { NodeFileSystemAdapter } from '../src/adapters/NodeFileSystemAdapter';
import { MemoryFs } from './helpers/MemoryFs';

describe('SyncLedger (core)', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), 's3-ledger-'));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('writes ledger atomically (tmp then rename) and reloads the same records', async () => {
        const fs = new NodeFileSystemAdapter(dir);
        const ledger = new SyncLedger(fs, 'ledger.json');
        ledger.record('notes/a.md', 'etag-1');
        await ledger.save();

        const ledgerPath = path.join(dir, 'ledger.json');
        const tmpPath = path.join(dir, 'ledger.json.tmp');

        await expect(stat(ledgerPath)).resolves.toBeTruthy();
        await expect(stat(tmpPath)).rejects.toThrow();

        const raw = await readFile(ledgerPath, 'utf8');
        expect(JSON.parse(raw)).toEqual({ syncedKeys: { 'notes/a.md': 'etag-1' } });

        const reloaded = new SyncLedger(fs, 'ledger.json');
        await reloaded.load();
        expect(reloaded.isSynced('notes/a.md', 'etag-1')).toBe(true);
        expect(reloaded.count()).toBe(1);
    });

    it('replaces an existing ledger file via rename', async () => {
        const fs = new NodeFileSystemAdapter(dir);
        await writeFile(path.join(dir, 'ledger.json'), JSON.stringify({ syncedKeys: { old: 'x' } }), 'utf8');

        const ledger = new SyncLedger(fs, 'ledger.json');
        await ledger.load();
        expect(ledger.isSynced('old', 'x')).toBe(true);

        ledger.record('notes/b.md', 'etag-2');
        await ledger.save();

        const reloaded = new SyncLedger(fs, 'ledger.json');
        await reloaded.load();
        expect(reloaded.isSynced('old', 'x')).toBe(true);
        expect(reloaded.isSynced('notes/b.md', 'etag-2')).toBe(true);
    });

    it('treats a missing file as an empty ledger', async () => {
        const mem = new MemoryFs();
        const missing = new SyncLedger(mem, 'plugin/ledger.json');
        await missing.load();
        expect(missing.count()).toBe(0);
    });

    it('refuses to load or overwrite a corrupt ledger', async () => {
        const mem = new MemoryFs();
        mem.files.set('plugin/ledger.json', '{not-json');
        const corrupt = new SyncLedger(mem, 'plugin/ledger.json');
        await expect(corrupt.load()).rejects.toThrow('Failed to parse ledger');
        await expect(corrupt.save()).rejects.toThrow('Refusing to overwrite a corrupt ledger');
        expect(mem.files.get('plugin/ledger.json')).toBe('{not-json');
    });
});
