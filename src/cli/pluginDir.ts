import * as path from 'node:path';
import { ConfigError } from '../core/errors';

export const MARKET_PLUGIN_ID = 'obsidian-s3-remote-sync';
export const DEV_PLUGIN_ID = 'remote-sync';

export type ExistsFn = (p: string) => Promise<boolean>;

export function pluginDirCandidates(vaultPath: string): { market: string; dev: string } {
    const pluginsRoot = path.join(vaultPath, '.obsidian', 'plugins');
    return {
        market: path.join(pluginsRoot, MARKET_PLUGIN_ID),
        dev: path.join(pluginsRoot, DEV_PLUGIN_ID),
    };
}

export async function resolvePluginDir(
    vaultPath: string,
    explicitPluginDir: string | undefined,
    exists: ExistsFn
): Promise<string> {
    if (explicitPluginDir) {
        const resolved = path.isAbsolute(explicitPluginDir)
            ? explicitPluginDir
            : path.resolve(vaultPath, explicitPluginDir);
        if (!(await exists(resolved))) {
            throw new ConfigError(`Plugin directory not found: ${resolved}`);
        }
        return resolved;
    }

    const { market, dev } = pluginDirCandidates(vaultPath);
    if (await exists(market)) return market;
    if (await exists(dev)) return dev;

    throw new ConfigError(
        `Plugin directory not found. Looked for ${market} and ${dev}. ` +
        'Pass --plugin-dir to specify one.'
    );
}

export function toVaultRelative(vaultPath: string, absolutePath: string): string {
    const rel = path.relative(vaultPath, absolutePath);
    return rel.split(path.sep).join('/');
}
