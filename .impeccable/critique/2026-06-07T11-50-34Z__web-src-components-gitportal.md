---
target: web/src/components/GitPortal
total_score: 20
p0_count: 6
p1_count: 9
timestamp: 2026-06-07T11-50-34Z
slug: web-src-components-gitportal
---
# Git Portal Deep Review

## Verdict

Gate FAIL. The File Manager Git Portal is not production-ready. It has a useful UI and RPC skeleton, but core clone flow, security boundaries, cancellation, progress routing, target directory semantics, integration, accessibility, and test coverage do not meet the design goals.

## Design Health Score

20/40. Usable skeleton, but not trustworthy enough for a production developer tool. The largest UX failures are: success flow closes or never reaches result state, error state lacks recovery, focus/touch handling is incomplete, and old/new clone experiences coexist.

## GSD Coverage

- Code framework coverage: about 70%.
- ROADMAP success criteria coverage: about 55-60%.
- Production acceptance coverage: about 45-50%.

## Security Red Lines

1. RPC registration is not bound to authenticated machine/session scope, so a malicious CLI socket can register another machine/session method and receive clone auth payloads.
2. ASKPASS temp file path uses unvalidated cloneId, allowing path traversal style write/unlink risks.
3. SSRF protection is incomplete: SSH/git@ and DNS-resolved private IPs are not protected, and URL userinfo is not fully rejected.
4. MachineGitClone uses common handler workingDirectory rather than machine workspaceRoots, breaking the file-manager path safety model.

## P0 Release Blockers

1. Progress/SSE chain is broken. GitPortal relies on optional onProgressEvent, FileManager does not pass it, App global SSE ignores clone-progress, and REST success has no done fallback. Clone can succeed while UI stays connecting.
2. targetDir semantics are wrong. Frontend treats targetDir as parent directory/currentPath, while CLI passes it as git clone final destination. Default clone into currentPath can fail or display the wrong clonedPath.
3. Cancel is local-only. The UI reset does not terminate git clone on the CLI, so network/disk work continues.
4. Rate limit, per-machine concurrency lock/queue, and disk precheck are missing despite being design requirements.
5. ASKPASS implementation ignores username prompts and is not robust for private HTTPS clones.
6. No direct GitPortal/git-clone tests exist, so the core flow has no regression protection.

## P1 Major Issues

- Result actions are not wired: Start AI session is an empty function, and Open directory reuses onCloneComplete incorrectly.
- FileManager closes GitPortal immediately on completion instead of letting users use the result page.
- New Session “Import from Git” entry is missing.
- Old GitCloneDialog remains in the session Git page.
- Error state does not display error text or retry/switch-auth recovery.
- Auth can remain in memory across close or URL scheme changes.
- localStorage parsing trusts malformed data.
- Touch targets, focus trap, focus return, and keyboard access are incomplete.
- Explicit any remains in GitPortal and related clone/RPC surfaces.

## Positive Findings

- FileManager desktop and mobile Git Portal entries exist.
- Session and machine git clone REST routes exist.
- MachineGitClone RPC method and web API client method exist.
- CLI uses spawn rather than shell string construction and supports --branch, --depth, LANG/LC_ALL=C.
- GitPortal has a clear phase model and history/favorites direction.
- en/zh-CN gitPortal locale key parity is 108/108.
- typecheck and web build passed in the parent run; brand check passed.

## Required Remediation Order

1. Fix backend security and clone contract first: RPC scope binding, cloneId UUID/temp dir, workspaceRoots, SSRF/DNS/userinfo, target directory contract, cancel RPC, rate/concurrency/disk gates.
2. Fix progress and state closure: top-level clone-progress scoping, actual GitPortal subscription, REST success fallback, idempotent done/error handling.
3. Fix integration: result actions, New Session entry, old GitCloneDialog replacement, no auto-close result page.
4. Harden UI: error recovery, auth cleanup, localStorage schema validation, touch targets, focus trap, reduced motion, i18n placeholders.
5. Add tests and E2E before any release.

## Verification Summary

Parent run:

- Passed: typecheck:web, typecheck:hub, typecheck:cli, brand-check, build:web, test:shared.
- Failed/unstable: test:web had 2 timeout failures; test:hub had 1 migration timeout; test:cli had 1 difftastic timeout.
- Detector: one bounce-easing warning in web/src/styles/git-portal.css:78.
- Direct GitPortal tests: none found.

## Production Definition of Done

Release only after:

- bun run typecheck passes.
- bun run test passes without timeouts.
- bun run build passes.
- scripts/brand-check.sh passes.
- GitPortal unit/integration tests cover storage, API, state machine, FileManager integration, SSE routing, route schemas, RPC gateway, CLI clone handler, shared clone schema.
- E2E covers public clone, branch clone, shallow clone, cancel clone, mobile FileManager clone, and clone then start AI session.
- Mobile UAT covers 375px, 390px, 768px, iOS safe-area/PWA, reduced motion, keyboard navigation, and focus trap.
