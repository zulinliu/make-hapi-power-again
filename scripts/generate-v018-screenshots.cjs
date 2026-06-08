const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const webDir = path.join(rootDir, 'web');
const assetsDir = path.join(rootDir, 'docs', 'assets');
const screenshotPort = process.env.V018_SCREENSHOT_PORT || '53180';
const baseUrl = process.env.V018_SCREENSHOT_BASE_URL || `http://127.0.0.1:${screenshotPort}`;
const sessionId = 'session-v018-demo';
const now = Date.UTC(2026, 5, 9, 9, 30, 0);
const authToken = 'demo.jwt.token';
const accessTokenKey = `hapi_access_token::${baseUrl}`;

const outputs = {
    modelNexus: path.join(assetsDir, 'screenshot-model-nexus.png'),
    guideBeam: path.join(assetsDir, 'screenshot-guide-beam.png'),
    contextPulse: path.join(assetsDir, 'screenshot-context-pulse.png'),
    gitAtlas: path.join(assetsDir, 'screenshot-git-atlas.png'),
    sessionLoom: path.join(assetsDir, 'screenshot-session-loom.png'),
};

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveBrowserExecutable() {
    if (process.env.CHROME_PATH) {
        return process.env.CHROME_PATH;
    }
    if (process.platform !== 'win32') {
        return undefined;
    }
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
}

const provider = {
    id: '11111111-1111-4111-8111-111111111111',
    namespace: 'default',
    name: 'GLM Bridge',
    baseUrl: 'https://api.example.com/v1',
    apiKeyMasked: '****abcd',
    protocol: 'openai',
    defaultModel: 'glm-5.1',
    health: {
        status: 'online',
        latencyMs: 128,
        checkedAt: now,
        errorCode: null,
        errorMessage: null,
        protocolDetected: 'openai',
        capabilities: {
            modelsEndpoint: true,
            messagesEndpoint: true,
            streaming: true,
            tokenUsage: true,
            contextWindow: 128000,
            toolUse: true,
            imageInput: false,
        },
    },
    modelCache: [
        { id: 'glm-5.1', name: 'glm-5.1', ownedBy: 'example' },
        { id: 'glm-5.1-air', name: 'glm-5.1-air', ownedBy: 'example' },
    ],
    modelCacheUpdatedAt: now,
    notes: 'default route',
    createdAt: now,
    updatedAt: now,
    assignments: [
        {
            namespace: 'default',
            providerId: '11111111-1111-4111-8111-111111111111',
            agentFlavor: 'codex',
            isDefault: true,
            model: 'glm-5.1',
        },
        {
            namespace: 'default',
            providerId: '11111111-1111-4111-8111-111111111111',
            agentFlavor: 'claude',
            isDefault: true,
            model: 'glm-5.1-air',
        },
    ],
};

const session = {
    id: sessionId,
    namespace: 'default',
    seq: 18,
    createdAt: now - 3600_000,
    updatedAt: now,
    active: true,
    activeAt: now,
    metadata: {
        path: '/home/tester/project',
        host: 'git.internal.example.com',
        name: 'v0.18 feature workbench',
        flavor: 'codex',
        machineId: 'machine-demo',
        capabilities: {
            terminal: true,
            guideInterrupt: {
                supported: true,
                preservesQueue: true,
                isolatedDelivery: true,
            },
        },
    },
    metadataVersion: 4,
    agentState: null,
    agentStateVersion: 1,
    thinking: true,
    thinkingAt: now - 60_000,
    backgroundTaskCount: 1,
    todos: [],
    model: 'glm-5.1',
    modelReasoningEffort: 'medium',
    effort: 'medium',
    permissionMode: 'acceptEdits',
    collaborationMode: 'plan',
};

const sessions = {
    sessions: [
        {
            id: session.id,
            name: 'v0.18 feature workbench',
            active: true,
            thinking: true,
            updatedAt: session.updatedAt,
            createdAt: session.createdAt,
            pendingRequestsCount: 0,
            futureScheduledMessageCount: 0,
            backgroundTaskCount: 1,
            metadata: {
                path: '/home/tester/project',
                host: 'git.internal.example.com',
                flavor: 'codex',
                machineId: 'machine-demo',
            },
            model: 'glm-5.1',
            effort: 'medium',
        },
    ],
};

const messages = [
    {
        id: 'msg-1',
        seq: 1,
        localId: null,
        createdAt: now - 150_000,
        invokedAt: now - 149_000,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text: '请按五节点顺序完成 v0.18.0：接入、驾驶、观测、追踪、沉淀。',
            },
        },
    },
    {
        id: 'msg-2',
        seq: 2,
        localId: null,
        createdAt: now - 120_000,
        invokedAt: now - 119_000,
        content: {
            role: 'agent',
            content: {
                type: 'codex',
                data: {
                    type: 'message',
                    message: '我会先接入模型星桥，然后验证 Guide Beam、Context Pulse、Git Atlas 和 Session Loom。',
                },
            },
        },
    },
    {
        id: 'msg-usage',
        seq: 3,
        localId: null,
        createdAt: now - 90_000,
        invokedAt: now - 89_000,
        content: {
            role: 'agent',
            content: {
                type: 'codex',
                data: {
                    type: 'token_count',
                    info: {
                        total: {
                            inputTokens: 50_000,
                            outputTokens: 1_200,
                            cachedInputTokens: 4_096,
                        },
                        contextTokens: 51_200,
                        modelContextWindow: 128_000,
                    },
                },
            },
        },
    },
    {
        id: 'queued-guide-server',
        seq: 4,
        localId: 'queued-guide-local',
        createdAt: now - 30_000,
        invokedAt: null,
        scheduledAt: null,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text: '立即改用安全审计路径，但保留普通队列。',
            },
            meta: {
                deliveryMode: 'guide',
                guide: {
                    requestedAt: now - 30_000,
                    status: 'requested',
                },
            },
        },
    },
    {
        id: 'queued-normal-server',
        seq: 5,
        localId: 'queued-normal-local',
        createdAt: now - 20_000,
        invokedAt: null,
        scheduledAt: null,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text: '普通队列：整理 README 和截图引用。',
            },
            meta: {
                deliveryMode: 'queue',
            },
        },
    },
];

const dashboard = {
    success: true,
    repo: {
        isRepo: true,
        root: '/home/tester/project',
        branch: 'feat/v0.18.0',
        upstream: 'origin/feat/v0.18.0',
        detached: false,
        ahead: 2,
        behind: 1,
        hasConflicts: true,
    },
    summary: {
        totalChanges: 4,
        staged: 1,
        unstaged: 2,
        untracked: 1,
        conflicted: 1,
        linesAdded: 118,
        linesRemoved: 25,
    },
    recommendation: {
        kind: 'push',
        label: 'Push local commits',
        description: 'Local commits are ahead of the remote branch.',
    },
    changes: [
        {
            path: 'web/src/components/ProviderSettings.tsx',
            status: 'modified',
            stage: 'unstaged',
            linesAdded: 42,
            linesRemoved: 8,
            binary: false,
            selectable: true,
        },
        {
            path: 'web/src/routes/sessions/git.tsx',
            status: 'added',
            stage: 'staged',
            linesAdded: 56,
            linesRemoved: 0,
            binary: false,
            selectable: true,
        },
        {
            path: 'docs/assets/screenshot-git-atlas.png',
            status: 'untracked',
            stage: 'unstaged',
            linesAdded: 0,
            linesRemoved: 0,
            binary: true,
            selectable: true,
        },
        {
            path: 'shared/src/protocol-contract.ts',
            status: 'conflicted',
            stage: 'mixed',
            linesAdded: 20,
            linesRemoved: 17,
            binary: false,
            selectable: false,
        },
    ],
    remotes: [{ name: 'origin', url: 'https://example.com/repo.git' }],
    recentCommits: [],
    sync: {
        remote: 'origin',
        branch: 'feat/v0.18.0',
        ahead: 2,
        behind: 1,
        canPull: true,
        canPush: true,
        requiresRemote: false,
        inFlight: false,
    },
};

const outline = {
    success: true,
    sessionId,
    title: 'v0.18 feature workbench',
    generatedAt: now,
    items: [
        {
            id: 'session-loom:decision:1',
            targetMessageId: 'msg-1',
            kind: 'decision',
            label: 'Decision: 接入 → 驾驶 → 观测 → 追踪 → 沉淀',
            createdAt: now - 150_000,
            depth: 1,
        },
        {
            id: 'session-loom:user:2',
            targetMessageId: 'msg-usage',
            kind: 'user',
            label: 'Context Pulse keeps reported usage visible at 40%.',
            createdAt: now - 90_000,
            depth: 1,
        },
    ],
    stats: {
        totalMessages: 5,
        outlineItems: 2,
        firstMessageAt: now - 150_000,
        lastMessageAt: now - 20_000,
    },
};

const exportPreview = {
    success: true,
    sessionId,
    generatedAt: now,
    markdown: [
        '# Session Loom',
        '',
        '## 大纲',
        '- 2026-06-09T09:27:30.000Z · decision · Decision: 接入 → 驾驶 → 观测 → 追踪 → 沉淀',
        '',
        '## 导出摘要',
        '默认脱敏已启用，/home/tester/project 已替换为 [REDACTED_PATH]。',
        'API token=[REDACTED]，工具细节默认过滤。',
    ].join('\n'),
    title: 'v0.18 feature workbench',
    stats: {
        messageCount: 5,
        outlineCount: 2,
        userMessages: 3,
        assistantMessages: 2,
        systemEvents: 0,
        redactions: 2,
        filteredToolDetails: 1,
    },
    filters: {
        redactSecrets: true,
        includeSystemEvents: false,
        includeToolDetails: false,
    },
    warnings: [],
};

function jsonResponse(data, status = 200) {
    return {
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
    };
}

function textResponse(text, status = 200) {
    return {
        status,
        contentType: 'text/plain; charset=utf-8',
        body: text,
    };
}

async function installMockRoutes(page) {
    await page.route(new RegExp(`^${escapeRegExp(baseUrl)}/api/`), async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const pathname = url.pathname;
        const method = request.method();

        if (pathname === '/api/events' && method === 'GET') {
            await route.fulfill({
                status: 200,
                headers: {
                    'content-type': 'text/event-stream',
                    'cache-control': 'no-cache',
                    connection: 'keep-alive',
                },
                body: 'data: {"type":"heartbeat"}\n\n',
            });
            return;
        }
        if (pathname === '/api/auth' && method === 'POST') {
            await route.fulfill(jsonResponse({
                token: authToken,
                user: { id: 1, username: 'test-user', firstName: 'Test' },
            }));
            return;
        }
        if (pathname === '/api/sessions' && method === 'GET') {
            await route.fulfill(jsonResponse(sessions));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}` && method === 'GET') {
            await route.fulfill(jsonResponse({ session }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/messages` && method === 'GET') {
            await route.fulfill(jsonResponse({
                messages,
                page: {
                    limit: 50,
                    nextBeforeSeq: null,
                    nextBeforeAt: null,
                    hasMore: false,
                },
            }));
            return;
        }
        if (pathname === '/api/machines' && method === 'GET') {
            await route.fulfill(jsonResponse({
                machines: [
                    {
                        id: 'machine-demo',
                        active: true,
                        activeAt: now,
                        updatedAt: now,
                        metadata: {
                            host: 'git.internal.example.com',
                            platform: 'linux',
                            hapiPowerCliVersion: '0.18.0',
                            displayName: 'Demo Workstation',
                            workspaceRoots: ['/home/tester/project'],
                        },
                        state: null,
                    },
                ],
            }));
            return;
        }
        if (pathname === '/api/providers/overview' && method === 'GET') {
            await route.fulfill(jsonResponse({
                providers: [provider],
                summary: {
                    total: 1,
                    online: 1,
                    degraded: 0,
                    offline: 0,
                    blocked: 0,
                    unknown: 0,
                    assignedAgents: 2,
                },
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-dashboard` && method === 'GET') {
            await route.fulfill(jsonResponse(dashboard));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-diff` && method === 'GET') {
            await route.fulfill(jsonResponse({
                success: true,
                path: url.searchParams.get('path') || 'web/src/components/ProviderSettings.tsx',
                staged: url.searchParams.get('staged') === 'true',
                binary: false,
                truncated: false,
                diff: [
                    'diff --git a/web/src/components/ProviderSettings.tsx b/web/src/components/ProviderSettings.tsx',
                    '+export const modelNexusReady = true',
                    '+export const providerNamespace = "default"',
                    '-export const oldProviderTable = true',
                ].join('\n'),
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-log` && method === 'GET') {
            await route.fulfill(jsonResponse({
                success: true,
                stdout: 'abc1234 (HEAD -> feat/v0.18.0) docs: 补齐视觉验收证据\nbcd2345 feat: 完成 Git 脉络',
                stderr: '',
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-branches` && method === 'GET') {
            await route.fulfill(jsonResponse({
                success: true,
                stdout: '* feat/v0.18.0\n  main\n  remotes/origin/feat/v0.18.0',
                stderr: '',
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-remotes` && method === 'GET') {
            await route.fulfill(jsonResponse({
                success: true,
                stdout: 'origin\thttps://example.com/repo.git (fetch)\norigin\thttps://example.com/repo.git (push)',
                stderr: '',
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-commit-basket` && method === 'POST') {
            const body = JSON.parse(request.postData() || '{}');
            await route.fulfill(jsonResponse({
                success: true,
                stdout: `committed ${Array.isArray(body.paths) ? body.paths.length : 0} selected paths`,
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/git-sync` && method === 'POST') {
            await route.fulfill(jsonResponse({ success: true, stdout: 'sync complete' }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/conversation-outline` && method === 'GET') {
            await route.fulfill(jsonResponse(outline));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/exports/preview` && method === 'POST') {
            await route.fulfill(jsonResponse(exportPreview));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/exports` && method === 'GET') {
            await route.fulfill(jsonResponse({
                success: true,
                assets: [
                    {
                        exportId: 'export-v018',
                        sessionId,
                        title: 'v0.18 feature workbench',
                        fileName: 'v0.18-feature-workbench.md',
                        format: 'markdown',
                        template: 'raw',
                        createdAt: now,
                        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
                        sizeBytes: 5200,
                        checksum: '0123456789abcdef0123456789abcdef',
                        stats: exportPreview.stats,
                    },
                ],
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/exports` && method === 'POST') {
            await route.fulfill(jsonResponse({
                success: true,
                asset: {
                    exportId: 'export-v018',
                    sessionId,
                    title: 'v0.18 feature workbench',
                    fileName: 'v0.18-feature-workbench.md',
                    format: 'markdown',
                    template: 'raw',
                    createdAt: now,
                    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
                    sizeBytes: exportPreview.markdown.length,
                    checksum: '0123456789abcdef0123456789abcdef',
                    stats: exportPreview.stats,
                },
                markdown: exportPreview.markdown,
            }));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/exports/export-v018/download` && method === 'GET') {
            await route.fulfill(textResponse(exportPreview.markdown));
            return;
        }
        if (pathname === `/api/sessions/${sessionId}/synthesis` && method === 'POST') {
            await route.fulfill(jsonResponse({
                success: true,
                sessionId,
                generatedAt: now,
                markdown: '## 本地提炼\n- 模型星桥和 Git 脉络已进入发布验收。\n- 外部模型提炼默认关闭。',
                warnings: [],
            }));
            return;
        }
        if (pathname.includes('/slash-commands')) {
            await route.fulfill(jsonResponse({ success: true, commands: [] }));
            return;
        }
        if (pathname.includes('/skills')) {
            await route.fulfill(jsonResponse({ success: true, skills: [] }));
            return;
        }
        if (pathname.endsWith('/codex-models') || pathname.endsWith('/cursor-models') || pathname.endsWith('/opencode-models')) {
            await route.fulfill(jsonResponse({ success: true, models: [] }));
            return;
        }
        if (pathname === '/api/visibility' || pathname.startsWith('/api/push')) {
            await route.fulfill(jsonResponse({ success: true, publicKey: 'BExamplePublicKey' }));
            return;
        }

        await route.fulfill(jsonResponse({ success: true, error: `unmocked ${method} ${pathname}` }, 404));
    });
}

function waitForServer(url, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(async () => {
            try {
                const response = await fetch(url);
                if (response.ok || response.status < 500) {
                    clearInterval(timer);
                    resolve();
                    return;
                }
            } catch {
            }
            if (Date.now() - started > timeoutMs) {
                clearInterval(timer);
                reject(new Error(`Timed out waiting for ${url}`));
            }
        }, 500);
    });
}

async function withServer(fn) {
    if (process.env.V018_SCREENSHOT_BASE_URL) {
        await waitForServer(baseUrl);
        return await fn();
    }

    const bunCommand = process.platform === 'win32' ? 'bun.exe' : 'bun';
    const server = spawn(bunCommand, ['run', 'dev', '--host', '127.0.0.1', '--port', screenshotPort, '--strictPort'], {
        cwd: webDir,
        env: { ...process.env, BROWSER: 'none' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk) => {
        output += chunk.toString();
    };
    server.stdout.on('data', collect);
    server.stderr.on('data', collect);

    try {
        await waitForServer(baseUrl);
        return await fn();
    } catch (error) {
        error.message = `${error.message}\n\nDev server output:\n${output}`;
        throw error;
    } finally {
        if (process.platform === 'win32') {
            spawn('taskkill.exe', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
        } else {
            server.kill('SIGTERM');
        }
    }
}

async function createPage(browser, viewport, options = {}) {
    const context = await browser.newContext({
        viewport,
        isMobile: options.isMobile || false,
        hasTouch: options.isMobile || false,
        deviceScaleFactor: options.deviceScaleFactor || 1,
        userAgent: options.isMobile
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            : undefined,
        reducedMotion: options.reducedMotion || 'no-preference',
    });
    await context.addInitScript(({ accessTokenKey: key, authToken: token }) => {
        window.localStorage.setItem(key, token);
        window.localStorage.setItem('hapi-power-lang', 'zh-CN');
        window.localStorage.setItem('hapi-power-appearance', 'light');
        window.localStorage.setItem('pwa_install_dismissed', 'true');
    }, { accessTokenKey, authToken });
    const page = await context.newPage();
    page.on('requestfailed', (request) => {
        console.log(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            console.log(`[browser:${message.type()}] ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => {
        console.log(`[pageerror] ${error.message}`);
    });
    await installMockRoutes(page);
    return { page, context };
}

async function gotoAndWait(page, targetPath, visibleText) {
    await page.goto(`${baseUrl}${targetPath}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    try {
        await page.getByText(visibleText, { exact: false }).first().waitFor({ timeout: 20_000 });
    } catch (error) {
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const html = await page.content().catch(() => '');
        const debugPath = path.join(assetsDir, 'debug-v018-failure.png');
        await page.screenshot({ path: debugPath, fullPage: false }).catch(() => {});
        console.error(`Failed waiting for "${visibleText}". Current URL: ${page.url()}`);
        console.error(bodyText.slice(0, 1200));
        console.error(html.slice(0, 1200));
        console.error(`Debug screenshot: ${debugPath}`);
        throw error;
    }
    await page.waitForTimeout(500);
}

async function expectVisible(page, text) {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10_000 });
}

async function openContextPulse(page) {
    const pulse = page.getByText('上下文：40%', { exact: true }).first();
    await pulse.waitFor({ timeout: 10_000 });
    await pulse.click();
    await expectVisible(page, 'Context Pulse');
    await expectVisible(page, '51k');
    await expectVisible(page, '128k');
}

async function assertContextThresholds(page) {
    const thresholds = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
            hasPulse: bodyText.includes('上下文：40%'),
            detailsOpen: bodyText.includes('Context Pulse') && bodyText.includes('128k'),
        };
    });
    if (!thresholds.hasPulse || !thresholds.detailsOpen) {
        throw new Error(`Context Pulse visible check failed: ${JSON.stringify(thresholds)}`);
    }

    const expected = [
        [59, 'success'],
        [60, 'warning'],
        [80, 'warning'],
        [81, 'danger'],
    ];
    const statusBarSource = fs.readFileSync(path.join(rootDir, 'web', 'src', 'components', 'AssistantChat', 'StatusBar.tsx'), 'utf8');
    const hasExpectedLogic = statusBarSource.includes('percent < 60')
        && statusBarSource.includes('percent <= 80')
        && statusBarSource.includes("warning: 'text-(--hp-warning)'")
        && statusBarSource.includes("danger: 'text-(--hp-danger)'");
    if (!hasExpectedLogic) {
        throw new Error('Context Pulse threshold source logic changed; inspect 59/60/80/81 expectations.');
    }
    console.log(`Context Pulse threshold source check: ${expected.map(([value, tone]) => `${value}%=${tone}`).join(', ')}`);
}

async function assertTouchTargets(page, selector, label) {
    const boxes = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
            width: rect.width,
            height: rect.height,
            text: node.getAttribute('aria-label') || node.textContent || '',
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        };
    }));
    const visibleBoxes = boxes.filter((box) => box.visible);
    if (visibleBoxes.length === 0) {
        throw new Error(`${label} did not match any visible controls.`);
    }
    const undersized = visibleBoxes.filter((box) => box.width < 44 || box.height < 44);
    if (undersized.length > 0) {
        throw new Error(`${label} has undersized touch targets: ${JSON.stringify(undersized)}`);
    }
}

async function captureModelNexus(browser) {
    const { page, context } = await createPage(browser, { width: 1440, height: 1000 });
    await gotoAndWait(page, '/settings', '模型星桥');
    await expectVisible(page, 'GLM Bridge');
    await expectVisible(page, '用量指标');
    await expectVisible(page, '128K 上下文');
    await expectVisible(page, 'Agent 分配矩阵');
    await page.screenshot({ path: outputs.modelNexus, fullPage: false });
    await context.close();
}

async function captureGuideBeam(browser) {
    const { page, context } = await createPage(browser, { width: 390, height: 844 }, { isMobile: true, reducedMotion: 'reduce' });
    await gotoAndWait(page, `/sessions/${sessionId}`, '上下文：40%');
    await expectVisible(page, '待发送队列');
    await expectVisible(page, '引导中');
    await expectVisible(page, '立即引导');
    await assertTouchTargets(page, '[role="radio"], [aria-label="添加文件"], [aria-label="设置"], [aria-label="终端"], [aria-label="停止"], [aria-label="定时发送"], [aria-label="发送"], [aria-label="编辑排队消息"], [aria-label="取消排队消息"]', 'Guide Beam mobile controls');
    await page.locator('textarea').first().fill('请优先检查 SSRF 和导出脱敏。');
    await page.getByRole('radio', { name: '立即引导' }).click();
    await page.screenshot({ path: outputs.guideBeam, fullPage: false });
    await context.close();
}

async function captureContextPulse(browser) {
    const { page, context } = await createPage(browser, { width: 1280, height: 900 });
    await gotoAndWait(page, `/sessions/${sessionId}`, '上下文：40%');
    await openContextPulse(page);
    await assertContextThresholds(page);
    await page.screenshot({ path: outputs.contextPulse, fullPage: false });
    await context.close();
}

async function captureGitAtlas(browser) {
    const { page, context } = await createPage(browser, { width: 1440, height: 1100 });
    await gotoAndWait(page, `/sessions/${sessionId}/git`, 'Git 脉络');
    await expectVisible(page, 'feat/v0.18.0');
    await expectVisible(page, '推送本地提交');
    await expectVisible(page, '变更地图');
    await expectVisible(page, 'Diff 预览');
    await expectVisible(page, '提交篮');
    await expectVisible(page, '同步中心');
    await page.screenshot({ path: outputs.gitAtlas, fullPage: false });
    await context.close();
}

async function captureSessionLoom(browser) {
    const { page, context } = await createPage(browser, { width: 430, height: 932 }, { isMobile: true, reducedMotion: 'reduce' });
    await gotoAndWait(page, `/sessions/${sessionId}`, '上下文：40%');
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByText('会话大纲', { exact: true }).click();
    await expectVisible(page, '会话织锦');
    await expectVisible(page, '大纲');
    await page.getByRole('tab', { name: '导出' }).click();
    await page.getByRole('button', { name: '预览导出' }).click();
    await expectVisible(page, '导出预览已生成。');
    await expectVisible(page, '[REDACTED_PATH]');
    await expectVisible(page, '脱敏');
    await assertTouchTargets(page, '[role="tab"], aside button, aside select, aside label', 'Session Loom mobile panel controls');
    const reducedMotion = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!reducedMotion) {
        throw new Error('Reduced motion media query was not active in mobile PWA simulation.');
    }
    await page.screenshot({ path: outputs.sessionLoom, fullPage: false });
    await context.close();
}

async function verifyOutputs() {
    for (const [name, filePath] of Object.entries(outputs)) {
        const stat = fs.statSync(filePath);
        if (stat.size < 10_000) {
            throw new Error(`${name} screenshot looks too small: ${stat.size} bytes`);
        }
        console.log(`${name}: ${path.relative(rootDir, filePath)} (${Math.round(stat.size / 1024)} KB)`);
    }
}

(async () => {
    fs.mkdirSync(assetsDir, { recursive: true });
    await withServer(async () => {
        const browser = await chromium.launch({
            headless: true,
            executablePath: resolveBrowserExecutable(),
        });
        try {
            await captureModelNexus(browser);
            await captureGuideBeam(browser);
            await captureContextPulse(browser);
            await captureGitAtlas(browser);
            await captureSessionLoom(browser);
        } finally {
            await browser.close();
        }
    });
    await verifyOutputs();
    console.log('v0.18.0 screenshots generated and browser-level PWA checks passed.');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
