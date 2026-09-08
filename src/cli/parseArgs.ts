export type CliCommand = 'run' | 'status' | 'test';

export interface CliArgs {
    command: CliCommand;
    help: boolean;
    vault?: string;
    pluginDir?: string;
    endpoint?: string;
    region?: string;
    bucket?: string;
    prefix?: string;
    accessKey?: string;
    secretKey?: string;
    localBasePath?: string;
    dryRun: boolean;
    force: boolean;
    json: boolean;
}

const COMMANDS = new Set<string>(['run', 'status', 'test']);

const VALUE_FLAGS: Record<string, keyof Pick<CliArgs, 'vault' | 'pluginDir' | 'endpoint' | 'region' | 'bucket' | 'prefix' | 'accessKey' | 'secretKey' | 'localBasePath'>> = {
    '--vault': 'vault',
    '--plugin-dir': 'pluginDir',
    '--endpoint': 'endpoint',
    '--region': 'region',
    '--bucket': 'bucket',
    '--prefix': 'prefix',
    '--access-key': 'accessKey',
    '--secret-key': 'secretKey',
    '--local-base-path': 'localBasePath',
};

const BOOL_FLAGS: Record<string, keyof Pick<CliArgs, 'dryRun' | 'force' | 'json' | 'help'>> = {
    '--dry-run': 'dryRun',
    '--force': 'force',
    '--json': 'json',
    '--help': 'help',
    '-h': 'help',
};

export function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        command: 'run',
        help: false,
        dryRun: false,
        force: false,
        json: false,
    };

    let i = 0;
    if (argv[0] && !argv[0].startsWith('-')) {
        const maybeCommand = argv[0];
        if (COMMANDS.has(maybeCommand)) {
            args.command = maybeCommand as CliCommand;
            i = 1;
        } else {
            throw new Error(`Unknown command: ${maybeCommand}. Expected run, status, or test.`);
        }
    }

    while (i < argv.length) {
        const token = argv[i];
        const eq = token.indexOf('=');
        const flag = eq === -1 ? token : token.slice(0, eq);
        const inline = eq === -1 ? undefined : token.slice(eq + 1);

        const boolKey = BOOL_FLAGS[flag];
        if (boolKey) {
            args[boolKey] = true;
            i++;
            continue;
        }

        const valueKey = VALUE_FLAGS[flag];
        if (valueKey) {
            const value = inline !== undefined ? inline : argv[++i];
            if (value === undefined || value.startsWith('-')) {
                throw new Error(`Missing value for ${flag}`);
            }
            args[valueKey] = value;
            i++;
            continue;
        }

        throw new Error(`Unknown option: ${token}`);
    }

    return args;
}

export function formatHelp(): string {
    return `obsidian-s3-sync — trigger S3 Remote Sync without opening Obsidian

Usage:
  obsidian-s3-sync [run] [options]
  obsidian-s3-sync status [options]
  obsidian-s3-sync test [options]

Commands:
  run       Sync (default). --dry-run lists pending files; --force ignores ledger; --json prints a result object
  status    Ledger stats + S3 pending preview
  test      Config/credential check + S3 connectivity

Options:
  --vault <path>            Vault root (default: cwd)
  --plugin-dir <path>       Plugin directory (skips auto-detect)
  --endpoint <url>          S3 endpoint
  --region <region>         S3 region
  --bucket <name>           Bucket
  --prefix <prefix>         S3 key prefix
  --access-key <key>        Access key id
  --secret-key <key>        Secret access key
  --local-base-path <path>  Vault-relative download root
  --dry-run                 List pending downloads only
  --force                   Ignore ledger and re-download
  --json                    Structured output
  --help                    Show this help

Exit codes: 0 ok (including nothing new) | 1 missing config / lock | 2 S3 error | 3 local write error

Config priority: CLI flags > S3_*/AWS_* env > vault data.json XOR secrets
Plugin dir: --plugin-dir > .../obsidian-s3-remote-sync > .../remote-sync
`;
}
