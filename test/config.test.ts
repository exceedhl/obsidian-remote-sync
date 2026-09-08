import { describe, it, expect } from 'vitest';
import { missingCredentialFields, resolveConfig } from '../src/core/config';
import { obfuscateSecret } from '../src/core/secrets';
import { parseArgs } from '../src/cli/parseArgs';
import { resolvePluginDir } from '../src/cli/pluginDir';
import { ConfigError } from '../src/core/errors';

describe('resolveConfig priority', () => {
    const xorData = {
        endpoint: 'https://data.example',
        region: 'data-region',
        bucket: 'data-bucket',
        s3Prefix: 'data-prefix/',
        localBasePath: 'DataInbox',
        secrets: {
            'access-key-id': obfuscateSecret('data-ak'),
            'secret-access-key': obfuscateSecret('data-sk'),
        },
    };

    const env = {
        S3_ENDPOINT: 'https://s3.example',
        S3_REGION: 's3-region',
        S3_BUCKET: 's3-bucket',
        S3_ACCESS_KEY_ID: 's3-ak',
        S3_SECRET_ACCESS_KEY: 's3-sk',
        AWS_ENDPOINT_URL: 'https://aws-endpoint.example',
        AWS_REGION: 'aws-region',
        AWS_ACCESS_KEY_ID: 'aws-ak',
        AWS_SECRET_ACCESS_KEY: 'aws-sk',
    };

    it('prefers CLI flags over env and data.json', () => {
        const config = resolveConfig({
            flags: {
                endpoint: 'https://flag.example',
                region: 'flag-region',
                bucket: 'flag-bucket',
                prefix: 'flag/',
                accessKey: 'flag-ak',
                secretKey: 'flag-sk',
                localBasePath: 'FlagInbox',
            },
            env,
            data: xorData,
        });

        expect(config).toEqual({
            endpoint: 'https://flag.example',
            region: 'flag-region',
            bucket: 'flag-bucket',
            prefix: 'flag/',
            localBasePath: 'FlagInbox',
            accessKeyId: 'flag-ak',
            secretAccessKey: 'flag-sk',
        });
    });

    it('uses S3_* env over AWS_* aliases and data.json', () => {
        const config = resolveConfig({
            flags: {},
            env,
            data: xorData,
        });

        expect(config.endpoint).toBe('https://s3.example');
        expect(config.region).toBe('s3-region');
        expect(config.bucket).toBe('s3-bucket');
        expect(config.accessKeyId).toBe('s3-ak');
        expect(config.secretAccessKey).toBe('s3-sk');
        expect(config.prefix).toBe('data-prefix/');
        expect(config.localBasePath).toBe('DataInbox');
    });

    it('falls back to AWS_* aliases when S3_* is absent', () => {
        const config = resolveConfig({
            flags: {},
            env: {
                AWS_ENDPOINT_URL: 'https://aws-endpoint.example',
                AWS_REGION: 'aws-region',
                AWS_ACCESS_KEY_ID: 'aws-ak',
                AWS_SECRET_ACCESS_KEY: 'aws-sk',
            },
            data: xorData,
        });

        expect(config.endpoint).toBe('https://aws-endpoint.example');
        expect(config.region).toBe('aws-region');
        expect(config.accessKeyId).toBe('aws-ak');
        expect(config.secretAccessKey).toBe('aws-sk');
        expect(config.bucket).toBe('data-bucket');
    });

    it('decrypts data.json XOR secrets only when secrets field exists', () => {
        const withSecrets = resolveConfig({ flags: {}, env: {}, data: xorData });
        expect(withSecrets.accessKeyId).toBe('data-ak');
        expect(withSecrets.secretAccessKey).toBe('data-sk');
        expect(withSecrets.endpoint).toBe('https://data.example');

        const noSecrets = resolveConfig({
            flags: {},
            env: {},
            data: { bucket: 'only-bucket' },
        });
        expect(noSecrets.accessKeyId).toBe('');
        expect(noSecrets.secretAccessKey).toBe('');
        expect(noSecrets.bucket).toBe('only-bucket');
        expect(noSecrets.region).toBe('auto');
        expect(noSecrets.localBasePath).toBe('S3-Sync');
    });

    it('reports missing credentials', () => {
        expect(missingCredentialFields(resolveConfig({ flags: {}, env: {}, data: null }))).toEqual([
            'bucket',
            'accessKeyId',
            'secretAccessKey',
        ]);
    });
});

describe('parseArgs', () => {
    it('defaults to run and parses flags', () => {
        const args = parseArgs([
            '--vault', '/tmp/vault',
            '--dry-run',
            '--force',
            '--json',
            '--access-key=AKI',
        ]);
        expect(args.command).toBe('run');
        expect(args.vault).toBe('/tmp/vault');
        expect(args.dryRun).toBe(true);
        expect(args.force).toBe(true);
        expect(args.json).toBe(true);
        expect(args.accessKey).toBe('AKI');
    });

    it('accepts status and test commands', () => {
        expect(parseArgs(['status', '--vault', '/v']).command).toBe('status');
        expect(parseArgs(['test']).command).toBe('test');
    });
});

describe('resolvePluginDir', () => {
    const vault = '/vault';
    const market = '/vault/.obsidian/plugins/obsidian-s3-remote-sync';
    const dev = '/vault/.obsidian/plugins/remote-sync';

    it('uses --plugin-dir first (relative to vault)', async () => {
        const dir = await resolvePluginDir(vault, 'custom/plugin', async (p) => p === '/vault/custom/plugin');
        expect(dir).toBe('/vault/custom/plugin');
    });

    it('rejects a missing explicit plugin directory', async () => {
        await expect(resolvePluginDir(vault, 'missing', async () => false)).rejects.toBeInstanceOf(ConfigError);
    });

    it('prefers market directory over dev directory', async () => {
        const dir = await resolvePluginDir(vault, undefined, async (p) => p === market || p === dev);
        expect(dir).toBe(market);
    });

    it('falls back to the development directory', async () => {
        const dir = await resolvePluginDir(vault, undefined, async (p) => p === dev);
        expect(dir).toBe(dev);
    });

    it('throws ConfigError when neither directory exists', async () => {
        await expect(resolvePluginDir(vault, undefined, async () => false)).rejects.toBeInstanceOf(ConfigError);
    });
});
