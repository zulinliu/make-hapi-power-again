/**
 * Minimal persistence functions for Hapi Power CLI
 * 
 * Handles settings, encryption key, and runner state storage in ~/.hapi-power/ (or HAPI_POWER_HOME override)
 */

import { FileHandle } from 'node:fs/promises'
import { readFile, writeFile, open, unlink, rename, stat } from 'node:fs/promises'
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { configuration } from '@/configuration'
import { isProcessAlive } from '@/utils/process';
import { chmodPrivateFile, chmodPrivateFileSync, ensurePrivateDir, ensurePrivateDirSync } from '@/utils/privateFiles'

interface Settings {
  // This ID is used as the actual database ID on the server
  // All machine operations use this ID
  machineId?: string
  machineIdConfirmedByServer?: boolean
  runnerAutoStartWhenRunningHappy?: boolean
  cliApiToken?: string
  // API URL for server connections (priority: env HAPI_POWER_API_URL > this > default)
  apiUrl?: string
  // Legacy field name (for migration, read-only)
  serverUrl?: string
}

const defaultSettings: Settings = {}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error
    && 'code' in error
    && (error as { code?: unknown }).code === code
}

/**
 * Runner state persisted locally (different from API RunnerState)
 * This is written to disk by the runner to track its local process state
 */
export interface RunnerLocallyPersistedState {
  pid: number;
  httpPort: number;
  startTime: string;
  startedWithCliVersion: string;
  startedWithCliMtimeMs?: number;
  startedWithApiUrl?: string;
  startedWithMachineId?: string;
  startedWithCliApiTokenHash?: string;
  lastHeartbeat?: string;
  runnerLogPath?: string;
}

export async function readSettings(): Promise<Settings> {
  if (!existsSync(configuration.settingsFile)) {
    return { ...defaultSettings }
  }

  try {
    const content = await readFile(configuration.settingsFile, 'utf8')
    return JSON.parse(content)
  } catch {
    return { ...defaultSettings }
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  await ensurePrivateDir(configuration.hapiPowerHomeDir)

  await writeFile(configuration.settingsFile, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 })
  await chmodPrivateFile(configuration.settingsFile)
}

/**
 * Atomically update settings with multi-process safety via file locking
 * @param updater Function that takes current settings and returns updated settings
 * @returns The updated settings
 */
export async function updateSettings(
  updater: (current: Settings) => Settings | Promise<Settings>
): Promise<Settings> {
  // Timing constants
  const LOCK_RETRY_INTERVAL_MS = 100;  // How long to wait between lock attempts
  const MAX_LOCK_ATTEMPTS = 50;        // Maximum number of attempts (5 seconds total)
  const STALE_LOCK_TIMEOUT_MS = 10000; // Consider lock stale after 10 seconds

  await ensurePrivateDir(configuration.hapiPowerHomeDir)

  const lockFile = configuration.settingsFile + '.lock';
  const tmpFile = configuration.settingsFile + '.tmp';
  let fileHandle;
  let attempts = 0;

  // Acquire exclusive lock with retries
  while (attempts < MAX_LOCK_ATTEMPTS) {
    try {
      // 'wx' = create exclusively, fail if exists (cross-platform compatible)
      fileHandle = await open(lockFile, 'wx', 0o600);
      break;
    } catch (err: unknown) {
      if (isNodeErrorCode(err, 'EEXIST')) {
        // Lock file exists, wait and retry
        attempts++;
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));

        // Check for stale lock
        try {
          const stats = await stat(lockFile);
          if (Date.now() - stats.mtimeMs > STALE_LOCK_TIMEOUT_MS) {
            await unlink(lockFile).catch(() => { });
          }
        } catch { }
      } else {
        throw err;
      }
    }
  }

  if (!fileHandle) {
    throw new Error(`Failed to acquire settings lock after ${MAX_LOCK_ATTEMPTS * LOCK_RETRY_INTERVAL_MS / 1000} seconds`);
  }

  try {
    // Read current settings with defaults
    const current = await readSettings() || { ...defaultSettings };

    // Apply update
    const updated = await updater(current);

    // Write atomically using rename
    await writeFile(tmpFile, JSON.stringify(updated, null, 2), { encoding: 'utf8', mode: 0o600 });
    await chmodPrivateFile(tmpFile);
    await rename(tmpFile, configuration.settingsFile); // Atomic on POSIX
    await chmodPrivateFile(configuration.settingsFile);

    return updated;
  } finally {
    // Release lock
    await fileHandle.close();
    await unlink(lockFile).catch(() => { }); // Remove lock file
  }
}

//
// Authentication
//

export async function writeCredentialsDataKey(credentials: { publicKey: Uint8Array, machineKey: Uint8Array, token: string }): Promise<void> {
  await ensurePrivateDir(configuration.hapiPowerHomeDir)
  await writeFile(configuration.privateKeyFile, JSON.stringify({
    encryption: { publicKey: Buffer.from(credentials.publicKey).toString('base64'), machineKey: Buffer.from(credentials.machineKey).toString('base64') },
    token: credentials.token
  }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await chmodPrivateFile(configuration.privateKeyFile);
}

export async function clearCredentials(): Promise<void> {
  if (existsSync(configuration.privateKeyFile)) {
    await unlink(configuration.privateKeyFile);
  }
}

export async function clearMachineId(): Promise<void> {
  await updateSettings(settings => ({
    ...settings,
    machineId: undefined
  }));
}

/**
 * Read runner state from local file
 */
export async function readRunnerState(): Promise<RunnerLocallyPersistedState | null> {
  try {
    if (!existsSync(configuration.runnerStateFile)) {
      return null;
    }
    const content = await readFile(configuration.runnerStateFile, 'utf-8');
    return JSON.parse(content) as RunnerLocallyPersistedState;
  } catch (error) {
    // State corrupted somehow :(
    console.error(`[PERSISTENCE] Runner state file corrupted: ${configuration.runnerStateFile}`, error);
    return null;
  }
}

/**
 * Write runner state to local file (synchronously for atomic operation)
 */
export function writeRunnerState(state: RunnerLocallyPersistedState): void {
  ensurePrivateDirSync(configuration.hapiPowerHomeDir);
  writeFileSync(configuration.runnerStateFile, JSON.stringify(state, null, 2), { encoding: 'utf-8', mode: 0o600 });
  chmodPrivateFileSync(configuration.runnerStateFile);
}

/**
 * Clean up runner state file and lock file
 */
export async function clearRunnerState(): Promise<void> {
  if (existsSync(configuration.runnerStateFile)) {
    await unlink(configuration.runnerStateFile);
  }
  // Also clean up lock file if it exists (for stale cleanup)
  if (existsSync(configuration.runnerLockFile)) {
    try {
      await unlink(configuration.runnerLockFile);
    } catch {
      // Lock file might be held by running runner, ignore error
    }
  }
}

/**
 * Acquire an exclusive lock file for the runner.
 * The lock file proves the runner is running and prevents multiple instances.
 * Returns the file handle to hold for the runner's lifetime, or null if locked.
 */
export async function acquireRunnerLock(
  maxAttempts: number = 5,
  delayIncrementMs: number = 200
): Promise<FileHandle | null> {
  await ensurePrivateDir(configuration.hapiPowerHomeDir)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 'wx' ensures we only create if it doesn't exist (atomic lock acquisition)
      const fileHandle = await open(configuration.runnerLockFile, 'wx', 0o600);
      // Write PID to lock file for debugging
      await fileHandle.writeFile(String(process.pid));
      return fileHandle;
    } catch (error: unknown) {
      if (isNodeErrorCode(error, 'EEXIST')) {
        // Lock file exists, check if process is still running
        try {
          const lockPid = readFileSync(configuration.runnerLockFile, 'utf-8').trim();
          if (lockPid && !isNaN(Number(lockPid))) {
            if (!isProcessAlive(Number(lockPid))) {
              // Process doesn't exist, remove stale lock
              unlinkSync(configuration.runnerLockFile);
              continue; // Retry acquisition
            }
          }
        } catch {
          // Can't read lock file, might be corrupted
        }
      }

      if (attempt === maxAttempts) {
        return null;
      }
      const delayMs = attempt * delayIncrementMs;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/**
 * Release runner lock by closing handle and deleting lock file
 */
export async function releaseRunnerLock(lockHandle: FileHandle): Promise<void> {
  try {
    await lockHandle.close();
  } catch { }

  try {
    if (existsSync(configuration.runnerLockFile)) {
      unlinkSync(configuration.runnerLockFile);
    }
  } catch { }
}
