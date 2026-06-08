---
phase: 36-v0.17.1-optimization
reviewed: 2026-06-07T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - cli/src/modules/common/handlers/git.ts
  - hub/src/web/routes/machines.ts
  - hub/src/web/routes/git.ts
  - hub/src/sync/rpcGateway.ts
  - web/src/lib/git-portal-storage.ts
  - web/src/lib/git-portal-api.ts
  - web/src/components/GitPortal/useGitClone.ts
findings:
  critical: 4
  warning: 7
  info: 4
  total: 15
status: resolved_after_remediation
---

# Git Portal Deep Security Audit Report

**Reviewed:** 2026-06-07
**Depth:** deep (cross-file analysis, command injection tracing, SSRF evasion testing)
**Files Reviewed:** 7
**Status:** resolved_after_remediation

## Summary

Deep security audit of the Git Portal feature across 7 files (CLI handler, Hub routes, RPC gateway, frontend storage/API/hook). The review traced user input from the browser through the API routes, RPC gateway, and into CLI-side `spawn`/`execFile` calls.

**Key findings:** 4 Critical issues identified:
1. SSRF bypass via octal-encoded IP addresses in `validateCloneUrl`
2. Argument injection via unvalidated `remote`/`branch` parameters in git push/pull/fetch
3. Argument injection via unvalidated `startPoint` parameter in branch creation
4. Argument injection via unvalidated `filePath` in git log

Additionally, 7 Warnings were found including missing input validation on hub-side push/pull/fetch routes, `GP_CLONE_PASSWORD` env var inheritance, TOCTOU in askpass script, and error message password leakage risk.

## Resolution Review — 2026-06-07T17:22:14Z

Post-remediation review status:

- P0：0
- P1：0
- P2：0 for backend security scope.

Closed findings:

- CR-01 closed: clone URL validation now rejects localhost/private/link-local/multicast, encoded IPv4/octal-style inputs, IPv4-mapped IPv6, and DNS answers resolving to blocked ranges. HTTPS clone pins resolved addresses with `http.curloptResolve` and disables redirect following.
- CR-02 closed: push/pull/fetch validate remote and branch names before invoking Git.
- CR-03 closed: branch create validates `startPoint` before invoking Git.
- CR-04 closed: git log validates file paths against the workspace before invoking Git.
- WR-01 closed: Hub git routes now use strict request validation for push/pull/fetch/remote add paths.
- WR-02 mitigated: network Git subprocesses no longer inherit arbitrary Git config/proxy/SSH environment; global/system Git config is disabled for clone/network commands.
- WR-03 closed: ASKPASS now uses a private `mkdtempSync` directory with fixed script name and cleanup.
- WR-04 closed: clone error/stdout/stderr responses are sanitized.
- WR-06 closed: remote add URL uses the clone SSRF guard.
- WR-07 closed: git and machine route RPC thrown errors are logged server-side and return generic client errors.

Additional stability hardening:

- Clone uses a process-group kill path so cancel and timeout cover `git-remote-https` child processes.
- Clone has an application-level no-output watchdog, default 120s, controlled by `HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS`.
- Failed/cancelled/stalled clone attempts clean incomplete target directories, preventing retry deadlocks caused by leftover `.git` directories.

Verification:

- `cli/src/modules/common/handlers/gitClone.test.ts`: 15 pass.
- Git Portal focused backend tests: 27 pass.
- `shared/src/gitCloneRequest.test.ts`: 11 pass.
- Full gates: `bun run typecheck`, `bun run test`, `bun run build`, `git diff --check`, `scripts/brand-check.sh` all pass.
- Real machine clone smoke: `https://github.com/octocat/Hello-World.git`, depth 1, HTTP 200, success true, elapsed 5s.

## Final Follow-up — 2026-06-07T17:49:34Z

User retest exposed an environment-specific production failure: this machine relies on URL-matched Git HTTP proxy config for GitHub access. The earlier hardening disabled global Git config entirely, which correctly blocked `insteadOf`, credential helpers, hooks, and hostile `GIT_CONFIG_*`, but also removed the proxy needed for real HTTPS clone traffic.

Minimal security-preserving follow-up:

- Global/system Git config remains disabled for the clone subprocess.
- Dangerous Git/SSH/proxy environment inheritance remains blocked.
- HTTPS clone now reads only `git config --global --get-urlmatch http.proxy <url>` before spawn.
- The matched proxy is passed as an explicit `-c http.proxy=<value>` only when it is a valid proxy URL.
- No `insteadOf`, credential helper, hook path, or arbitrary global config is inherited.
- Git `http.lowSpeedTime` and the application no-output watchdog were raised to 120s to reduce false failures on slow but valid networks.

Security review status after follow-up:

- P0：0
- P1：0
- P2：0 for backend clone security scope.

Additional verification:

- `cli/src/modules/common/handlers/gitClone.test.ts`: 15 pass, including URL-matched proxy inheritance while global config stays disabled.
- Focused Hub/Web/Shared Git Portal tests: pass.
- `bun run typecheck`: pass.
- `bun run test:cli`: 788 pass / 12 skipped.
- `bun run build`: pass.
- `git diff --check` and `scripts/brand-check.sh`: pass.
- Real machine clone smoke: `https://github.com/octocat/Hello-World.git`, depth 1, HTTP 200, success true, elapsed 5s, smoke directory cleaned.

---

## Critical Issues

### CR-01: SSRF Bypass via Octal-Encoded IP Addresses

**File:** `cli/src/modules/common/handlers/git.ts:191-194`
**Issue:** The `validateCloneUrl` function only blocks decimal-encoded IPs (8+ digits via `/^\d{8,}$/`) but does not block octal-encoded IP addresses. An attacker can bypass SSRF protections using octal notation:

- `https://0177.0.0.1/repo.git` resolves to 127.0.0.1 (localhost bypass)
- `https://0377.0.0.1/repo.git` resolves to 255.0.0.1
- `https://012.0.0.1/repo.git` resolves to 10.0.0.1 (RFC1918 private)

The `new URL()` parser and Node.js DNS resolver will happily resolve octal-encoded IPs, while the regex-based checks only look at decimal and string patterns.

**Attack scenario:** Attacker provides `https://0177.0.0.1/repo.git` which passes all SSRF checks. The git process then connects to localhost, potentially accessing internal services behind the firewall.

**Fix:**
```typescript
// Block octal-encoded IPs (0-prefixed digit sequences with dots)
if (/^0[0-7]*(\.[0-7]+){0,3}/.test(hostname)) {
    return 'Cannot clone from local addresses'
}

// More robust: resolve hostname via DNS and check the resolved IP
import { lookup } from 'dns/promises'
try {
    const { address } = await lookup(hostname)
    // Check address against private IP ranges
    if (isPrivateIP(address)) return 'Cannot clone from private addresses'
} catch {
    return 'Cannot resolve hostname'
}
```

### CR-02: Argument Injection via Unvalidated `remote` and `branch` in Git Push/Pull/Fetch

**File:** `cli/src/modules/common/handlers/git.ts:620-647`
**Issue:** The `remote` and `branch` parameters in `GitPush`, `GitPull`, and `GitFetch` handlers are passed directly as arguments to `git push/pull/fetch` without any validation. Unlike branch names in `GitBranchCreate` (which are validated against `/^[\w.\-\/]+$/`), these parameters accept any string value.

A remote name like `--upload-pack=evil-command` would be interpreted as a git flag rather than a remote name. Similarly, a branch name starting with `-` could inject arguments.

**Attack scenario:** Attacker sends `{"remote": "--exec=malicious", "branch": "main"}` to the git-push endpoint. Since `execFile` passes arguments as an array, shell metacharacters are not the risk -- but git flag injection is. The `--exec` flag for `git push` allows arbitrary command execution on the remote side.

**Fix:**
```typescript
// Validate remote and branch names in push/pull/fetch handlers
function validateGitRef(name: string): boolean {
    return /^[\w.\-\/]+$/.test(name)
}

// In GitPush handler:
if (data.remote && !validateGitRef(data.remote)) return rpcError('Invalid remote name')
if (data.branch && !validateGitRef(data.branch)) return rpcError('Invalid branch name')
```

### CR-03: Argument Injection via Unvalidated `startPoint` in Branch Creation

**File:** `cli/src/modules/common/handlers/git.ts:449-458`
**Issue:** The `startPoint` parameter in `GitBranchCreate` is passed directly as a git argument without validation. While `name` is validated against `/^[\w.\-\/]+$/`, `startPoint` accepts any string. This allows injection of arbitrary git flags.

**Attack scenario:** `{"name": "safe-branch", "startPoint": "--orphan=malicious"}` would result in `git checkout -b safe-branch --orphan=malicious`, which changes the behavior of the checkout command.

**Fix:**
```typescript
if (data.startPoint) {
    if (!/^[\w.\-\/]+$/.test(data.startPoint)) return rpcError('Invalid start point')
    args.push(data.startPoint)
}
```

### CR-04: Argument Injection via Unvalidated `filePath` in Git Log

**File:** `cli/src/modules/common/handlers/git.ts:429-438`
**Issue:** The `filePath` parameter in `GitLogRequest` is not validated against path traversal or argument injection. While a `--` separator is used (which prevents flag injection), there is no `validatePath` check on the file path, unlike `GitDiffFile` which calls `validateFilePath(data.filePath, workingDirectory)`. This means a user can pass `../../etc/passwd` or any path outside the working directory to the git log command, potentially leaking information about files outside the sandbox.

**Attack scenario:** Attacker sends `{"filePath": "../../../../etc/shadow"}` and reads git log metadata about system files.

**Fix:**
```typescript
if (data.filePath) {
    const fileError = validateFilePath(data.filePath, workingDirectory)
    if (fileError) return rpcError(fileError)
    args.push('--', data.filePath)
}
```

---

## Warnings

### WR-01: Hub Push/Pull/Fetch Routes Lack Input Validation

**File:** `hub/src/web/routes/git.ts:348-405`
**Issue:** The `git-push`, `git-pull`, and `git-fetch` endpoints parse the request body with `c.req.json()` and pass `body.remote`, `body.branch`, `body.force` directly to the engine without any schema validation (no `z.object().safeParse()`). This is inconsistent with all other endpoints in the same file that use Zod schemas.

While `body.force === true` is safe (only compares to boolean), `body.remote` and `body.branch` are passed through without type checking. If `body.remote` is an array or object, it will be serialized through RPC and may cause unexpected behavior on the CLI side.

**Fix:**
```typescript
const pushSchema = z.object({
    remote: z.string().regex(/^[\w.\-\/]+$/).optional(),
    branch: z.string().regex(/^[\w.\-\/]+$/).optional(),
    force: z.boolean().optional()
})
const parsed = pushSchema.safeParse(await c.req.json())
if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)
```

### WR-02: GP_CLONE_PASSWORD Environment Variable Inherited by Git Subprocesses

**File:** `cli/src/modules/common/handlers/git.ts:251-261`
**Issue:** The password is passed to the git clone process via `env.GP_CLONE_PASSWORD`. The environment is constructed as `{ ...process.env, ...overrides }`. If git spawns any subprocesses (e.g., via `.gitconfig` hooks, filters, or custom merge drivers), those subprocesses also inherit `GP_CLONE_PASSWORD` in their environment. Additionally, if the clone fails and a retry happens, the env var persists in the process.

The askpass script file at `/tmp/gp-askpass-{cloneId}.sh` is cleaned up on process close, but the environment variable remains visible in `/proc/{pid}/environ` for the lifetime of the clone operation.

**Fix:** Consider using a pipe-based approach instead of environment variables:
```typescript
// Alternative: use git credential helper via stdin/stdout pipe
// or pass password via a FIFO that is immediately consumed
```
At minimum, delete the env var from the child process after the script reads it:
```typescript
// After spawning, remove from parent env immediately
delete env.GP_CLONE_PASSWORD
```
Note: The env var is only on the child process, so this is a limited exposure. However, any git subcommands (LFS, hooks) spawned by the clone would inherit it.

### WR-03: TOCTOU Race Condition on Askpass Script

**File:** `cli/src/modules/common/handlers/git.ts:255-258`
**Issue:** There is a time-of-check-time-of-use gap between `writeFileSync(askpassScript, ...)` and when git reads the script. During this window, another local user could potentially replace the script on a shared `/tmp` directory. While `mode: 0o600` restricts permissions, on systems without `sticky bit` on `/tmp`, the script could be replaced before permissions are set.

Additionally, if the process crashes between creating the file and the `unlinkSync` in the `close`/`error` handlers, the askpass script remains on disk at `/tmp/gp-askpass-{cloneId}.sh`. While the script itself does not contain the password (it reads from env var), the existence of the script reveals the clone operation pattern.

**Fix:** Use `O_TMPFILE` or write to a directory only accessible to the process user:
```typescript
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
const tmpDir = mkdtempSync(join(tmpdir(), 'gp-askpass-'))
const askpassScript = join(tmpDir, 'askpass.sh')
// ... after cleanup, also rmdirSync(tmpDir)
```

### WR-04: Error Message May Leak Password-Containing URL

**File:** `cli/src/modules/common/handlers/git.ts:318-321`
**Issue:** When the spawn `error` event fires (line 314), `err.message` is returned in the response without being sanitized through `sanitizeGitUrl`. Line 318 sanitizes for the progress emission, but line 321 returns `err.message` raw. If git produces error messages containing the full URL (including any embedded credentials or auth tokens), this leaks them to the caller.

**Fix:**
```typescript
resolve({
    success: false,
    error: sanitizeGitUrl(err.message),
    stdout: sanitizeGitUrl(stdout),
    stderr: sanitizeGitUrl(stderr),
    exitCode: -1
})
```

### WR-05: Password Cleared from State but Remains in JavaScript Heap

**File:** `web/src/components/GitPortal/useGitClone.ts:139-141`
**Issue:** The `setAuth(null)` calls (lines 108, 213) clear the password from React state when the clone completes or errors. However, the password remains in the JavaScript heap until garbage collection runs. The `request` object on line 150 also captures `state.auth` which includes the password, and the closure in `startClone` retains a reference.

While this is an inherent limitation of browser-based password handling, it means the password is accessible via heap dumps or DevTools for the lifetime of the component. This is a LOW risk for a browser application, but worth noting for defense-in-depth.

**Fix:** After the API call completes, overwrite the password in the request object:
```typescript
// After the API call
if (request.auth?.password) {
    request.auth.password = '\0'.repeat(request.auth.password.length)
}
```
Note: This is a best-effort mitigation. True secure credential handling in browser JS is inherently limited.

### WR-06: Git Remote Add URL Not Validated for SSRF

**File:** `cli/src/modules/common/handlers/git.ts:603-608`
**Issue:** The `GitRemoteAdd` handler validates the remote name but does not call `validateCloneUrl` on the URL. An attacker can add a remote pointing to `file:///etc/passwd` or an internal SSRF target, then use `git fetch` from that remote to exfiltrate data.

**Fix:**
```typescript
const urlError = validateCloneUrl(data.url)
if (urlError) return rpcError(urlError)
```

### WR-07: Hub `runRpc` Error Messages May Leak Internal Details

**File:** `hub/src/web/routes/git.ts:69-75` (also `hub/src/web/routes/machines.ts:66-72`)
**Issue:** The `runRpc` helper catches all errors and returns `error.message` to the client. If the RPC layer throws errors containing internal path information, session IDs, or stack traces, these are exposed to the frontend. This is a mild information disclosure risk.

**Fix:** Sanitize error messages before returning to client:
```typescript
catch (error) {
    return { success: false, error: 'Internal error' }
}
```
Or log the full error server-side while returning a sanitized version.

---

## Info

### IN-01: LocalStorage Stores Unencrypted Clone URLs

**File:** `web/src/lib/git-portal-storage.ts:28-37`
**Issue:** Clone history entries are stored in localStorage as plaintext JSON, including the sanitized URL. While `sanitizeGitUrl` strips embedded credentials, the sanitized URL (with `***@`) is stored. On a shared device, another user of the same browser profile can read these entries. This is an inherent localStorage limitation.

**Fix:** Consider using `sessionStorage` for non-favorite entries, or encrypt sensitive fields with a session-derived key.

### IN-02: `parseRepoUrl` Regex Could Match Malicious URLs

**File:** `web/src/lib/git-portal-storage.ts:107-129`
**Issue:** The `parseRepoUrl` function uses regex to extract owner/repo from URLs. These values are displayed in the UI without HTML escaping. While React auto-escapes JSX expressions, if any downstream consumer uses `dangerouslySetInnerHTML` or inserts these values into DOM attributes, it could enable XSS. Currently safe due to React's built-in escaping, but the lack of explicit sanitization is a latent risk.

### IN-03: `cloneId` Not Validated on Hub-Side Routes

**File:** `hub/src/web/routes/machines.ts:518-529` and `hub/src/web/routes/git.ts:34-45`
**Issue:** The `cloneId` field is accepted as an optional string but not validated for format. It flows through to the CLI side where it is used in a file path: `/tmp/gp-askpass-${cloneId}.sh` (line 255). If `cloneId` contains path traversal characters like `../../../etc/crontab`, it could potentially be used to write the askpass script to an arbitrary location. The risk is partially mitigated because `randomUUID()` is used as fallback, but when `cloneId` is provided by the client, it is not sanitized.

**Fix:** Validate `cloneId` format:
```typescript
cloneId: z.string().regex(/^[0-9a-f-]{36}$/).optional()
```

### IN-04: `maxCount` and `skip` Values Injected via String Interpolation

**File:** `cli/src/modules/common/handlers/git.ts:433-434`
**Issue:** `data.maxCount` and `data.skip` are interpolated into git arguments via template literals: `--max-count=${data.maxCount}`. While `execFile` passes arguments as an array (preventing shell injection), the values are not validated as integers before string interpolation. If a non-integer value is passed (e.g., from a type-confused RPC call), git would receive an invalid argument and fail. This is a robustness issue rather than a security issue since `execFile` prevents shell interpretation.

**Fix:**
```typescript
if (data.maxCount && Number.isInteger(data.maxCount)) args.push(`--max-count=${data.maxCount}`)
if (data.skip && Number.isInteger(data.skip)) args.push(`--skip=${data.skip}`)
```

---

## Architectural Security Assessment

### Defense-in-Depth Layers Present

1. **Authentication:** JWT-based auth middleware validates all hub routes (auth.ts)
2. **Authorization:** `requireSession`/`requireMachine` guards enforce namespace-scoped access (guards.ts)
3. **Input validation:** Zod schemas on most hub routes
4. **Path security:** `validatePath` with symlink resolution, URL decode loop, null byte removal
5. **Command safety:** `execFile`/`spawn` (not `exec`) prevents shell injection
6. **URL sanitization:** `sanitizeGitUrl` strips credentials from progress/error messages
7. **ASKPASS design:** Password passed via env var instead of shell script content (good)

### Remaining Gaps

1. **SSRF protection** is incomplete (octal IPs, DNS rebinding not addressed)
2. **Argument injection** possible through several unvalidated git parameters
3. **Consistency** in validation -- some routes validate thoroughly, others skip validation entirely
4. **No rate limiting** on clone operations -- an attacker could trigger many simultaneous clones

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
