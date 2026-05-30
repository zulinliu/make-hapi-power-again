import { resolve, sep, normalize } from 'path';
import { existsSync, realpathSync } from 'node:fs';

export interface PathValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Sanitize a path input before validation.
 * Fixes: double URL encoding, null bytes, multi-dot traversal
 */
export function sanitizePath(input: string): string {
    let path = input;

    // Step 1: Iteratively URL-decode until stable (handles %252e → %2e → .)
    let prev = ''
    let iterations = 0
    while (prev !== path && iterations < 5) {
        prev = path
        try {
            path = decodeURIComponent(path)
        } catch {
            break
        }
        iterations++
    }

    // Step 2: Remove null bytes
    path = path.replace(/\0/g, '')

    // Step 3: NFC normalize for Unicode attacks
    path = path.normalize('NFC')

    return path
}

/**
 * Validates that a path is within the allowed working directory.
 * Enhanced with: URL decode loop, null byte removal, symlink resolution
 *
 * @param targetPath - The path to validate (can be relative or absolute)
 * @param workingDirectory - The session's working directory (must be absolute)
 * @returns Validation result
 */
export function validatePath(targetPath: string, workingDirectory: string): PathValidationResult {
    // Pre-sanitize the input
    const sanitized = sanitizePath(targetPath)

    // Resolve both paths to absolute paths
    const resolvedTarget = resolve(workingDirectory, sanitized);
    const resolvedWorkingDir = resolve(workingDirectory);

    // Resolve symlinks if the target exists
    let finalTarget = resolvedTarget;
    if (existsSync(resolvedTarget)) {
        try {
            finalTarget = realpathSync(resolvedTarget);
        } catch {
            // If realpathSync fails, use the resolved path as-is
        }
    }

    // Normalize for comparison
    const normalizedTarget = process.platform === 'win32' ? finalTarget.toLowerCase() : finalTarget
    const normalizedWorkingDir = process.platform === 'win32' ? resolvedWorkingDir.toLowerCase() : resolvedWorkingDir
    const workingDirPrefix = normalizedWorkingDir.endsWith(sep) ? normalizedWorkingDir : normalizedWorkingDir + sep

    if (normalizedTarget !== normalizedWorkingDir && !normalizedTarget.startsWith(workingDirPrefix)) {
        return {
            valid: false,
            error: `Access denied: Path '${targetPath}' is outside the working directory`
        };
    }

    return { valid: true };
}
