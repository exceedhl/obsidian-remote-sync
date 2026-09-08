import { SyncInProgressError } from './errors';
import { SyncFsAdapter } from './fs';

const STALE_MS = 30 * 60 * 1000;

export function lockPathForLedger(ledgerPath: string): string {
    return `${ledgerPath}.lock`;
}

export async function acquireSyncLock(
    fs: SyncFsAdapter,
    lockPath: string,
    now: number = Date.now()
): Promise<() => Promise<void>> {
    if (await fs.exists(lockPath)) {
        let stale = true;
        try {
            const parsed = JSON.parse(await fs.read(lockPath)) as { updatedAt?: number };
            if (typeof parsed.updatedAt === 'number' && now - parsed.updatedAt < STALE_MS) {
                stale = false;
            }
        } catch {
            stale = true;
        }
        if (!stale) {
            throw new SyncInProgressError(`A sync is already in progress (lock: ${lockPath})`);
        }
        await fs.remove(lockPath);
    }

    try {
        await fs.write(
            lockPath,
            JSON.stringify({ updatedAt: now, pid: typeof process !== 'undefined' ? process.pid : 0 }),
            { exclusive: true }
        );
    } catch {
        throw new SyncInProgressError(`A sync is already in progress (lock: ${lockPath})`);
    }

    return async () => {
        try {
            await fs.remove(lockPath);
        } catch {
            // ignore missing lock on release
        }
    };
}
