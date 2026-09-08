export class CliError extends Error {
    readonly exitCode: number;

    constructor(message: string, exitCode: number) {
        super(message);
        this.name = 'CliError';
        this.exitCode = exitCode;
    }
}

export class ConfigError extends CliError {
    constructor(message: string) {
        super(message, 1);
        this.name = 'ConfigError';
    }
}

export class SyncInProgressError extends ConfigError {
    constructor(message = 'A sync is already in progress') {
        super(message);
        this.name = 'SyncInProgressError';
    }
}

export class S3SyncError extends CliError {
    constructor(message: string) {
        super(message, 2);
        this.name = 'S3SyncError';
    }
}

export class FileSystemSyncError extends CliError {
    constructor(message: string) {
        super(message, 3);
        this.name = 'FileSystemSyncError';
    }
}

export function exitCodeOf(error: unknown): number {
    if (error instanceof CliError) return error.exitCode;
    return 1;
}

export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
