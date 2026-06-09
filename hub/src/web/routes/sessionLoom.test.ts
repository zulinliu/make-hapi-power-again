import { describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import type { DecryptedMessage, Session } from '@hapipower/protocol/types'
import type { Store } from '../../store'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import {
    buildSessionLoomExportPreview,
    buildSessionLoomOutline,
    createSessionLoomRoutes,
    redactSessionLoomText,
} from './sessionLoom'

function makeSession(overrides?: Partial<Session>): Session {
    const now = 1_800_000_000_000
    return {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: now,
        updatedAt: now,
        active: true,
        activeAt: now,
        metadata: {
            path: '/home/tester/project',
            host: 'test-host',
            name: 'Example Session',
            flavor: 'codex'
        },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: now,
        model: null,
        modelReasoningEffort: null,
        effort: null,
        ...overrides
    }
}

function makeMessage(params: {
    id: string
    seq: number
    role: string
    text: string
    createdAt?: number
}): DecryptedMessage {
    return {
        id: params.id,
        seq: params.seq,
        localId: null,
        createdAt: params.createdAt ?? 1_800_000_000_000 + params.seq,
        invokedAt: null,
        content: {
            role: params.role,
            content: {
                type: 'text',
                text: params.text
            }
        }
    }
}

function createTestStore(): Store {
    return {
        providers: {
            getDefaultForFlavor: () => null,
            getAssignmentsForFlavor: () => [],
        }
    } as unknown as Store
}

function createApp(
    engine: Partial<SyncEngine>,
    options?: Parameters<typeof createSessionLoomRoutes>[2]
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createSessionLoomRoutes(() => engine as SyncEngine, createTestStore(), options))
    return app
}

describe('Session Loom outline', () => {
    it('reads every paginated message instead of stopping at the first 200', async () => {
        const session = makeSession()
        const messages = Array.from({ length: 250 }, (_, index) => makeMessage({
            id: `m-${index + 1}`,
            seq: index + 1,
            role: 'user',
            text: `User prompt ${index + 1}`
        }))
        const calls: Array<{ before?: { at: number; seq: number } | null }> = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({
                ok: true,
                sessionId,
                session: { ...session, namespace }
            }),
            getMessagesPage: (_sessionId: string, options: { before?: { at: number; seq: number } | null }) => {
                calls.push({ before: options.before })
                if (!options.before) {
                    return {
                        messages: messages.slice(50),
                        page: {
                            limit: 200,
                            nextBeforeAt: messages[50]?.createdAt ?? null,
                            nextBeforeSeq: messages[50]?.seq ?? null,
                            hasMore: true
                        }
                    }
                }
                return {
                    messages: messages.slice(0, 50),
                    page: {
                        limit: 200,
                        nextBeforeAt: null,
                        nextBeforeSeq: null,
                        hasMore: false
                    }
                }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/conversation-outline')
        const body = await response.json() as { items: Array<{ label: string }>; stats: { totalMessages: number } }

        expect(response.status).toBe(200)
        expect(calls).toHaveLength(2)
        expect(body.stats.totalMessages).toBe(250)
        expect(body.items).toHaveLength(250)
        expect(body.items[0]?.label).toBe('User prompt 1')
        expect(body.items[249]?.label).toBe('User prompt 250')
    })

    it('filters trivial assistant replies while keeping semantic short answers', () => {
        const session = makeSession()
        const outline = buildSessionLoomOutline({
            session,
            generatedAt: 1_800_000_000_100,
            filters: {
                redactSecrets: true,
                includeSystemEvents: true,
                includeToolDetails: false
            },
            messages: [
                makeMessage({ id: 'm-1', seq: 1, role: 'user', text: 'Which database should we use?' }),
                makeMessage({ id: 'm-2', seq: 2, role: 'agent', text: 'ok' }),
                makeMessage({ id: 'm-3', seq: 3, role: 'agent', text: 'SQLite' }),
                makeMessage({ id: 'm-4', seq: 4, role: 'agent', text: '决定：本阶段使用 SQLite，避免新增服务依赖。' })
            ]
        })

        expect(outline.items.map((item) => item.label)).toEqual([
            'Which database should we use?',
            'SQLite',
            '决定：本阶段使用 SQLite，避免新增服务依赖。'
        ])
        expect(outline.items.map((item) => item.kind)).toEqual(['user', 'assistant', 'decision'])
        expect(outline.items.map((item) => item.targetMessageId)).toEqual([
            'user-text:m-1',
            'agent-text:m-3:0',
            'agent-text:m-4:0'
        ])
    })

    it('redacts outline labels by default', () => {
        const outline = buildSessionLoomOutline({
            session: makeSession(),
            generatedAt: 1_800_000_000_100,
            filters: {
                redactSecrets: true,
                includeSystemEvents: false,
                includeToolDetails: false
            },
            messages: [
                makeMessage({ id: 'm-1', seq: 1, role: 'user', text: 'Use token=abc123 for this export' })
            ]
        })

        expect(outline.items[0]?.label).toContain('token=[REDACTED]')
        expect(outline.items[0]?.label).not.toContain('abc123')
    })
})

describe('Session Loom export', () => {
    it('redacts private keys, bearer tokens, URL userinfo, query secrets, JSON and env secrets', () => {
        const bearerSecret = ['sk', 'example-token'].join('-')
        const bareToken = ['sk', 'exampletoken0000'].join('-')
        const privateKeyFixture = [
            '-----BEGIN PRIVATE',
            'KEY-----\nabc\n-----END PRIVATE',
            'KEY-----'
        ].join(' ')
        const input = [
            `Bearer ${bearerSecret}`,
            'https://test-user:placeholder-value@example.com/repo.git',
            'https://example.com/callback?token=abc&safe=1',
            '{"apiKey":"abc123","name":"demo"}',
            'PASSWORD=abc123',
            bareToken,
            privateKeyFixture
        ].join('\n')

        const result = redactSessionLoomText(input)

        expect(result.count).toBeGreaterThanOrEqual(7)
        expect(result.text).toContain('Bearer [REDACTED]')
        expect(result.text).toContain('https://[REDACTED]@example.com/repo.git')
        expect(result.text).toContain('token=[REDACTED]')
        expect(result.text).toContain('"apiKey":"[REDACTED]"')
        expect(result.text).toContain('PASSWORD=[REDACTED]')
        expect(result.text).toContain('[REDACTED_TOKEN]')
        expect(result.text).toContain('[REDACTED_PRIVATE_KEY]')
        expect(result.text).not.toContain(bearerSecret)
        expect(result.text).not.toContain(bareToken)
        expect(result.text).not.toContain('placeholder-value')
        expect(result.text).not.toContain('abc123')
    })

    it('builds Markdown with metadata, summary, raw conversation, clarifications, filters, and drift decisions', () => {
        const preview = buildSessionLoomExportPreview({
            session: makeSession(),
            generatedAt: 1_800_000_000_200,
            request: {
                language: 'zh-CN',
                format: 'markdown',
                template: 'decisions',
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: true,
                    includeToolDetails: false
                }
            },
            messages: [
                makeMessage({ id: 'm-1', seq: 1, role: 'user', text: '请确认需求范围，token=abc123' }),
                makeMessage({ id: 'm-2', seq: 2, role: 'agent', text: '问题：是否需要移动端下载兜底？' }),
                makeMessage({ id: 'm-3', seq: 3, role: 'user', text: '回答：需要。' }),
                makeMessage({ id: 'm-4', seq: 4, role: 'agent', text: '决定：Markdown 导出默认开启脱敏。' })
            ]
        })

        expect(preview.markdown).toContain('# Example Session')
        expect(preview.markdown).toContain('## 会话元数据')
        expect(preview.markdown).toContain('## 概要')
        expect(preview.markdown).toContain('## 澄清问答')
        expect(preview.markdown).toContain('## 过滤规则')
        expect(preview.markdown).toContain('## 偏差与决策区')
        expect(preview.markdown).toContain('## 模板说明')
        expect(preview.markdown).toContain('- 导出模板: 决策记录')
        expect(preview.markdown).toContain('已启用敏感信息脱敏')
        expect(preview.markdown).toContain('- path: [REDACTED_PATH]')
        expect(preview.markdown).toContain('- host: [REDACTED_HOST]')
        expect(preview.markdown).toContain('token=[REDACTED]')
        expect(preview.markdown).not.toContain('token=abc123')
        expect(preview.markdown).not.toContain('/home/tester/project')
        expect(preview.markdown).not.toContain('test-host')
        expect(preview.stats.messageCount).toBe(4)
        expect(preview.stats.redactions).toBe(3)
    })

    it('formats generated, outline, and raw conversation timestamps in Beijing time', () => {
        const utcTimestamp = 1_780_985_194_883
        const preview = buildSessionLoomExportPreview({
            session: makeSession(),
            generatedAt: utcTimestamp,
            request: {
                language: 'zh-CN',
                format: 'markdown',
                template: 'raw',
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: false,
                    includeToolDetails: false
                }
            },
            messages: [
                makeMessage({
                    id: 'm-1',
                    seq: 1,
                    role: 'user',
                    text: '导出这个会话',
                    createdAt: utcTimestamp
                })
            ]
        })

        expect(preview.markdown).toContain('> 生成时间: 2026-06-09 14:06:34.883 北京时间')
        expect(preview.markdown).toContain('- 2026-06-09 14:06:34.883 北京时间 · user · 导出这个会话')
        expect(preview.markdown).toContain('### 1. 用户 · 2026-06-09 14:06:34.883 北京时间')
        expect(preview.markdown).not.toContain('2026-06-09T06:06:34.883Z')
    })

    it('uses the selected template to change Markdown sections', () => {
        const messages = [
            makeMessage({ id: 'm-1', seq: 1, role: 'user', text: '需求：移动端需要下载兜底。' }),
            makeMessage({ id: 'm-2', seq: 2, role: 'agent', text: '决定：下载失败时复制 Markdown。风险：Safari 分享能力不稳定。' })
        ]
        const rawPreview = buildSessionLoomExportPreview({
            session: makeSession(),
            generatedAt: 1_800_000_000_200,
            request: {
                language: 'zh-CN',
                format: 'markdown',
                template: 'raw',
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: false,
                    includeToolDetails: false
                }
            },
            messages
        })
        const prdPreview = buildSessionLoomExportPreview({
            session: makeSession(),
            generatedAt: 1_800_000_000_200,
            request: {
                language: 'zh-CN',
                format: 'markdown',
                template: 'prd',
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: false,
                    includeToolDetails: false
                }
            },
            messages
        })

        expect(rawPreview.markdown).toContain('- 导出模板: 原始对话')
        expect(rawPreview.markdown).toContain('## 原始对话')
        expect(prdPreview.markdown).toContain('- 导出模板: PRD 笔记')
        expect(prdPreview.markdown).toContain('## 用户需求')
        expect(prdPreview.markdown).toContain('## 范围与验收线索')
        expect(prdPreview.markdown).toContain('## 问题与风险')
        expect(prdPreview.markdown).not.toBe(rawPreview.markdown)
    })

    it('redacts path-derived titles by default', () => {
        const session = makeSession({
            metadata: {
                path: '/home/tester/project',
                host: 'test-host',
                flavor: 'codex'
            }
        })
        const outline = buildSessionLoomOutline({
            session,
            generatedAt: 1_800_000_000_100,
            filters: {
                redactSecrets: true,
                includeSystemEvents: false,
                includeToolDetails: false
            },
            messages: [
                makeMessage({ id: 'm-1', seq: 1, role: 'user', text: 'Export this session' })
            ]
        })

        expect(outline.title).toBe('[REDACTED_PATH]')
        expect(outline.title).not.toContain('/home/tester/project')
    })

    it('omits system events by default', async () => {
        const session = makeSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({
                ok: true,
                sessionId,
                session: { ...session, namespace }
            }),
            getMessagesPage: () => ({
                messages: [
                    makeMessage({ id: 'm-1', seq: 1, role: 'user', text: 'Keep user content' }),
                    makeMessage({ id: 'm-2', seq: 2, role: 'system', text: 'Do not export system prompt' })
                ],
                page: {
                    limit: 200,
                    nextBeforeAt: null,
                    nextBeforeSeq: null,
                    hasMore: false
                }
            })
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/exports/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
        const body = await response.json() as { markdown: string; filters: { includeSystemEvents: boolean }; stats: { systemEvents: number } }

        expect(response.status).toBe(200)
        expect(body.filters.includeSystemEvents).toBe(false)
        expect(body.stats.systemEvents).toBe(0)
        expect(body.markdown).toContain('Keep user content')
        expect(body.markdown).not.toContain('Do not export system prompt')
    })

    it('creates assets with lifecycle metadata and supports deletion', async () => {
        const session = makeSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({
                ok: true,
                sessionId,
                session: { ...session, namespace }
            }),
            getMessagesPage: () => ({
                messages: [makeMessage({ id: 'm-1', seq: 1, role: 'user', text: 'Export this session' })],
                page: {
                    limit: 200,
                    nextBeforeAt: null,
                    nextBeforeSeq: null,
                    hasMore: false
                }
            })
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const createResponse = await app.request('/api/sessions/session-1/exports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: '../unsafe name' })
        })
        const created = await createResponse.json() as {
            asset: {
                exportId: string
                fileName: string
                checksum: string
                createdAt: number
                expiresAt: number
            }
        }

        expect(createResponse.status).toBe(200)
        expect(created.asset.fileName).toBe('unsafe-name.md')
        expect(created.asset.checksum).toMatch(/^[a-f0-9]{64}$/)
        expect(created.asset.expiresAt).toBeGreaterThan(created.asset.createdAt)

        const downloadResponse = await app.request(`/api/sessions/session-1/exports/${created.asset.exportId}/download`)
        expect(downloadResponse.status).toBe(200)
        expect(await downloadResponse.text()).toContain('Export this session')

        const deleteResponse = await app.request(`/api/sessions/session-1/exports/${created.asset.exportId}`, {
            method: 'DELETE'
        })
        expect(deleteResponse.status).toBe(200)

        const listResponse = await app.request('/api/sessions/session-1/exports')
        const listed = await listResponse.json() as { assets: unknown[] }
        expect(listed.assets).toEqual([])
    })

    it('generates synthesis through a background provider call and stores Markdown as an export asset', async () => {
        const session = makeSession()
        const sendMessage = mock(async (
            _sessionId: string,
            _payload: {
                text: string
                localId?: string | null
                sentFrom?: 'webapp'
                deliveryMode?: 'queue'
            }
        ) => undefined)
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({
                ok: true,
                sessionId,
                session: { ...session, namespace }
            }),
            getMessagesPage: () => ({
                messages: [
                    makeMessage({ id: 'm-1', seq: 1, role: 'user', text: '需要沉淀设计方案。' }),
                    makeMessage({ id: 'm-2', seq: 2, role: 'agent', text: '决定：提炼应由当前 Agent 使用当前模型完成。' })
                ],
                page: {
                    limit: 200,
                    nextBeforeAt: null,
                    nextBeforeSeq: null,
                    hasMore: false
                }
            }),
            sendMessage
        } as Partial<SyncEngine>
        const synthesizeDesign = mock(async (input: {
            session: Session
            systemPrompt: string
            prompt: string
        }) => {
            expect(input.session.id).toBe('session-1')
            expect(input.systemPrompt).toContain('background design synthesis agent')
            expect(input.prompt).toContain('# 会话织锦深度提炼任务')
            expect(input.prompt).toContain('决定：提炼应由当前 Agent 使用当前模型完成。')
            return {
                markdown: '# 设计方案\n\n## 背景与目标\n\n沉淀当前会话经验。',
                provider: {
                    providerId: 'provider-1',
                    providerName: 'Test Provider',
                    protocol: 'openai' as const,
                    model: 'gpt-test',
                    agentFlavor: 'codex',
                }
            }
        })
        const app = createApp(engine, { synthesizeDesign })

        const response = await app.request('/api/sessions/session-1/synthesis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: 'zh-CN',
                template: 'design',
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: true,
                    includeToolDetails: false
                }
            })
        })
        const body = await response.json() as {
            provider: {
                providerId: string
                providerName: string
                protocol: string
                model: string
                agentFlavor: string
            }
            summary: string
            markdown: string
            asset: { exportId: string; fileName: string; checksum: string }
        }

        expect(response.status).toBe(200)
        expect(body.provider).toEqual({
            providerId: 'provider-1',
            providerName: 'Test Provider',
            protocol: 'openai',
            model: 'gpt-test',
            agentFlavor: 'codex',
        })
        expect(body.summary).toContain('Test Provider / gpt-test')
        expect(body.summary).toContain('未打断当前会话主线')
        expect(body.markdown).toContain('# 设计方案')
        expect(body.asset.fileName).toContain('.md')
        expect(body.asset.checksum).toMatch(/^[a-f0-9]{64}$/)
        expect(sendMessage).not.toHaveBeenCalled()
        expect(synthesizeDesign).toHaveBeenCalledTimes(1)

        const downloadResponse = await app.request(`/api/sessions/session-1/exports/${body.asset.exportId}/download`)
        expect(downloadResponse.status).toBe(200)
        expect(await downloadResponse.text()).toContain('# 设计方案')
    })

    it('rejects explicit external model synthesis because synthesis uses the session agent', async () => {
        const session = makeSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({
                ok: true,
                sessionId,
                session: { ...session, namespace }
            }),
            getMessagesPage: () => ({
                messages: [makeMessage({ id: 'm-1', seq: 1, role: 'user', text: 'Summarize this session' })],
                page: {
                    limit: 200,
                    nextBeforeAt: null,
                    nextBeforeSeq: null,
                    hasMore: false
                }
            })
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/synthesis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: 'en',
                template: 'decisions',
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: true,
                    includeToolDetails: false
                },
                useExternalModel: true,
                explicitConfirmation: false
            })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'Session Loom synthesis uses the current session agent. External model selection is not supported.'
        })
    })
})
