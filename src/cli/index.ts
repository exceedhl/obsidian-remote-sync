import * as path from 'node:path';
import { createS3Manager, S3Manager } from '../S3Manager';
import { NodeFileSystemAdapter } from '../adapters/NodeFileSystemAdapter';
import { assertCredentials, PluginDataJson, resolveConfig, ResolvedSyncConfig } from '../core/config';
import { ConfigError, errorMessage, exitCodeOf, S3SyncError } from '../core/errors';
import { stripS3Prefix } from '../core/fs';
import { SyncEngine, SyncResult } from '../core/SyncEngine';
import { SyncLedger } from '../core/SyncLedger';
import { CliArgs, formatHelp, parseArgs } from './parseArgs';
import { resolvePluginDir, toVaultRelative } from './pluginDir';

export interface CliIo {
    log: (message: string) => void;
    error: (message: string) => void;
}

const defaultIo: CliIo = {
    log: (message) => console.log(message),
    error: (message) => console.error(message),
};

export async function runCli(
    argv: string[],
    env: NodeJS.Dict<string> = process.env,
    io: CliIo = defaultIo
): Promise<number> {
    let args: CliArgs;
    try {
        args = parseArgs(argv);
    } catch (error: unknown) {
        io.error(errorMessage(error));
        return 1;
    }

    if (args.help) {
        io.log(formatHelp());
        return 0;
    }

    try {
        const vaultPath = path.resolve(args.vault ?? process.cwd());
        const fs = new NodeFileSystemAdapter(vaultPath);

        let pluginDir: string | null = null;
        let data: PluginDataJson | null = null;
        try {
            pluginDir = await resolvePluginDir(vaultPath, args.pluginDir, (p) => fs.exists(p));
            data = await loadPluginData(fs, path.join(pluginDir, 'data.json'));
        } catch (error: unknown) {
            if (args.command !== 'test' || args.pluginDir) {
                throw error;
            }
        }

        const config = resolveConfig({ flags: args, env, data });

        if (args.command === 'test') {
            return await runTest(config, io, args.json);
        }

        if (!pluginDir) {
            throw new ConfigError('Plugin directory not found.');
        }

        assertCredentials(config);

        const ledgerRel = toVaultRelative(vaultPath, path.join(pluginDir, 'ledger.json'));
        const ledger = new SyncLedger(fs, ledgerRel);
        await ledger.load();

        const s3 = createS3Manager(config);

        if (args.command === 'status') {
            return await runStatus(s3, ledger, io, args.json);
        }

        return await runSync(s3, ledger, fs, config, args, io);
    } catch (error: unknown) {
        const code = exitCodeOf(error);
        io.error(errorMessage(error));
        return code;
    }
}

async function loadPluginData(fs: NodeFileSystemAdapter, dataPath: string): Promise<PluginDataJson | null> {
    if (!(await fs.exists(dataPath))) return null;
    try {
        return JSON.parse(await fs.read(dataPath)) as PluginDataJson;
    } catch {
        throw new ConfigError(`Failed to parse plugin data at ${dataPath}`);
    }
}

async function runSync(
    s3: S3Manager,
    ledger: SyncLedger,
    fs: NodeFileSystemAdapter,
    config: ResolvedSyncConfig,
    args: CliArgs,
    io: CliIo
): Promise<number> {
    const engine = new SyncEngine(
        fs,
        s3,
        ledger,
        {
            localBasePath: config.localBasePath,
            prefix: config.prefix,
            force: args.force,
            dryRun: args.dryRun,
            stopOnError: false,
        }
    );

    let result: SyncResult;
    try {
        result = await engine.run();
    } catch (error: unknown) {
        if (args.json) {
            io.log(JSON.stringify({
                downloaded: [],
                skippedCount: 0,
                failed: [],
                success: false,
                dryRun: args.dryRun,
                error: errorMessage(error),
            }));
        }
        throw error;
    }

    if (args.json) {
        io.log(JSON.stringify(result));
    } else if (args.dryRun) {
        io.log(`Dry run: ${result.downloaded.length} pending, skipped ${result.skippedCount}.`);
        for (const file of result.downloaded) io.log(`  ${file}`);
    } else if (result.downloaded.length > 0) {
        io.log(`Downloaded ${result.downloaded.length} files, skipped ${result.skippedCount}.`);
    } else {
        io.log(`No new files. Skipped ${result.skippedCount}.`);
    }

    if (result.failed.length > 0 && !args.json) {
        for (const fail of result.failed) {
            io.error(`Failed ${fail.key}: ${fail.error}`);
        }
    }

    if (result.failed.some(f => f.exitCode === 3)) return 3;
    if (result.failed.length > 0) return 2;
    return 0;
}

async function runStatus(
    s3: S3Manager,
    ledger: SyncLedger,
    io: CliIo,
    json: boolean
): Promise<number> {
    let objects: { key: string; etag: string }[];
    try {
        objects = await s3.listObjects();
    } catch (error: unknown) {
        throw new S3SyncError(errorMessage(error));
    }

    const pending = objects.filter(obj => {
        const relative = stripS3Prefix(obj.key, s3.prefix);
        if (relative === null || relative === '' || relative.endsWith('/')) return false;
        return !ledger.isSynced(obj.key, obj.etag);
    });

    if (json) {
        io.log(JSON.stringify({
            ledgerCount: ledger.count(),
            objectCount: objects.length,
            pending: pending.map(obj => ({
                key: obj.key,
                reason: ledger.getSyncedKeys()[obj.key] ? 'etag changed' : 'new',
            })),
        }));
        return 0;
    }

    io.log(`Ledger: ${ledger.count()} synced keys`);
    io.log(`S3 objects: ${objects.length}`);
    io.log(`Pending: ${pending.length}`);
    for (const obj of pending) {
        const reason = ledger.getSyncedKeys()[obj.key] ? 'etag changed' : 'new';
        io.log(`  ${obj.key} (${reason})`);
    }
    return 0;
}

async function runTest(
    config: ResolvedSyncConfig,
    io: CliIo,
    json: boolean
): Promise<number> {
    try {
        assertCredentials(config);
    } catch (error: unknown) {
        if (json) {
            io.log(JSON.stringify({ success: false, error: errorMessage(error) }));
        }
        throw error;
    }

    const s3 = createS3Manager(config);

    try {
        await s3.testConnection();
    } catch (error: unknown) {
        const wrapped = new S3SyncError(errorMessage(error));
        if (json) {
            io.log(JSON.stringify({ success: false, error: wrapped.message }));
        }
        throw wrapped;
    }

    if (json) {
        io.log(JSON.stringify({
            success: true,
            endpoint: config.endpoint,
            region: config.region,
            bucket: config.bucket,
            prefix: config.prefix,
        }));
    } else {
        io.log('S3 connection successful.');
    }
    return 0;
}
