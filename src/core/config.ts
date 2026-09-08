import { deobfuscateSecret, SECRET_ACCESS_KEY_ID, SECRET_SECRET_ACCESS_KEY } from './secrets';
import { ConfigError } from './errors';

export const DEFAULT_REGION = 'auto';
export const DEFAULT_LOCAL_BASE_PATH = 'S3-Sync';

export interface PluginDataJson {
    endpoint?: string;
    region?: string;
    bucket?: string;
    s3Prefix?: string;
    localBasePath?: string;
    secrets?: Record<string, string>;
}

export interface ConfigFlags {
    endpoint?: string;
    region?: string;
    bucket?: string;
    prefix?: string;
    accessKey?: string;
    secretKey?: string;
    localBasePath?: string;
}

export interface ConfigSources {
    flags: ConfigFlags;
    env: NodeJS.Dict<string>;
    data?: PluginDataJson | null;
}

export interface ResolvedSyncConfig {
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    localBasePath: string;
    accessKeyId: string;
    secretAccessKey: string;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return '';
}

function secretFromData(data: PluginDataJson | null | undefined, key: string): string {
    if (!data || !data.secrets || !data.secrets[key]) return '';
    return deobfuscateSecret(data.secrets[key]) ?? '';
}

export function resolveConfig(sources: ConfigSources): ResolvedSyncConfig {
    const { flags, env, data } = sources;

    return {
        endpoint: firstNonEmpty(flags.endpoint, env.S3_ENDPOINT, env.AWS_ENDPOINT_URL, data?.endpoint),
        region: firstNonEmpty(flags.region, env.S3_REGION, env.AWS_REGION, data?.region) || DEFAULT_REGION,
        bucket: firstNonEmpty(flags.bucket, env.S3_BUCKET, data?.bucket),
        prefix: firstNonEmpty(flags.prefix, data?.s3Prefix),
        localBasePath: firstNonEmpty(flags.localBasePath, data?.localBasePath) || DEFAULT_LOCAL_BASE_PATH,
        accessKeyId: firstNonEmpty(
            flags.accessKey,
            env.S3_ACCESS_KEY_ID,
            env.AWS_ACCESS_KEY_ID,
            secretFromData(data, SECRET_ACCESS_KEY_ID)
        ),
        secretAccessKey: firstNonEmpty(
            flags.secretKey,
            env.S3_SECRET_ACCESS_KEY,
            env.AWS_SECRET_ACCESS_KEY,
            secretFromData(data, SECRET_SECRET_ACCESS_KEY)
        ),
    };
}

export function missingCredentialFields(config: ResolvedSyncConfig): string[] {
    const missing: string[] = [];
    if (!config.bucket) missing.push('bucket');
    if (!config.accessKeyId) missing.push('accessKeyId');
    if (!config.secretAccessKey) missing.push('secretAccessKey');
    return missing;
}

export function assertCredentials(config: ResolvedSyncConfig): void {
    const missing = missingCredentialFields(config);
    if (missing.length > 0) {
        throw new ConfigError(
            `Missing required configuration: ${missing.join(', ')}. ` +
            'Provide CLI flags, S3_/AWS_ environment variables, or data.json XOR secrets.'
        );
    }
}
