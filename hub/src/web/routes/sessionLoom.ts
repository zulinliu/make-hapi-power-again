import { Hono } from 'hono'
import { createHash, randomUUID } from 'node:crypto'
import {
    SessionLoomExportPreviewRequestSchema,
    SessionLoomExportRequestSchema,
    SessionLoomSynthesisRequestSchema,
    safeStringify,
} from '@hapipower/protocol'
import { unwrapRoleWrappedRecordEnvelope } from '@hapipower/protocol/messages'
import type {
    SessionLoomExportAsset,
    SessionLoomExportPreviewRequest,
    SessionLoomExportPreviewResponse,
    SessionLoomExportStats,
    SessionLoomFilters,
    SessionLoomLanguage,
    SessionLoomOutlineItem,
    SessionLoomOutlineKind,
    SessionLoomOutlineResponse,
    SessionLoomSynthesisResponse,
    SessionLoomTemplate,
} from '@hapipower/protocol/apiTypes'
import type { DecryptedMessage, Session } from '@hapipower/protocol/types'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'

type ConversationEntry = {
    message: DecryptedMessage
    role: 'user' | 'assistant' | 'system' | 'tool'
    text: string
    toolDetailsOmitted: boolean
}

type RedactionResult = {
    text: string
    count: number
}

type StoredExport = {
    asset: SessionLoomExportAsset
    markdown: string
}

const exportsById = new Map<string, StoredExport>()
const MAX_EXPORTS_PER_SESSION = 20
const MAX_OUTLINE_LABEL_LENGTH = 96
const MAX_ENTRY_TEXT_LENGTH = 12_000
const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const BEIJING_TIME_OFFSET_MS = 8 * 60 * 60 * 1000
const DEFAULT_SESSION_LOOM_FILTERS: SessionLoomFilters = {
    redactSecrets: true,
    includeSystemEvents: false,
    includeToolDetails: false
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, maxLength: number): string {
    const normalized = collapseWhitespace(value)
    if (normalized.length <= maxLength) {
        return normalized
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function formatBeijingTime(value: number | null | undefined, language: SessionLoomLanguage): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'n/a'
    }
    const date = new Date(value + BEIJING_TIME_OFFSET_MS)
    const pad = (part: number, length = 2) => part.toString().padStart(length, '0')
    const timestamp = [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate())
    ].join('-')
        + ' '
        + [
            pad(date.getUTCHours()),
            pad(date.getUTCMinutes()),
            pad(date.getUTCSeconds())
        ].join(':')
        + `.${pad(date.getUTCMilliseconds(), 3)}`
    return language === 'en' ? `${timestamp} Beijing Time` : `${timestamp} 北京时间`
}

function extractText(value: unknown, depth = 0): string {
    if (depth > 4) {
        return ''
    }
    if (typeof value === 'string') {
        return value
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => extractText(item, depth + 1))
            .filter((item) => item.trim().length > 0)
            .join('\n')
    }
    if (!isRecord(value)) {
        return ''
    }

    if (typeof value.text === 'string') {
        return value.text
    }
    if (typeof value.message === 'string') {
        return value.message
    }
    if (isRecord(value.message)) {
        const messageContent = extractText(value.message.content, depth + 1)
        if (messageContent) return messageContent
        return extractText(value.message, depth + 1)
    }
    if ('content' in value) {
        const content = extractText(value.content, depth + 1)
        if (content) return content
    }
    if (isRecord(value.data)) {
        const data = extractText(value.data, depth + 1)
        if (data) return data
    }
    if (typeof value.output === 'string') {
        return value.output
    }
    return ''
}

function isToolLikeContent(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.some(isToolLikeContent)
    }
    if (!isRecord(value)) {
        return false
    }
    const type = typeof value.type === 'string' ? value.type : ''
    if (type.includes('tool') || type === 'function_call') {
        return true
    }
    return isToolLikeContent(value.content) || isToolLikeContent(value.data)
}

function extractToolCallId(value: unknown, depth = 0): string | null {
    if (depth > 4) {
        return null
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const id = extractToolCallId(item, depth + 1)
            if (id) return id
        }
        return null
    }
    if (!isRecord(value)) {
        return null
    }
    const type = typeof value.type === 'string' ? value.type : ''
    if (type.includes('tool') || type === 'function_call') {
        for (const key of ['id', 'toolCallId', 'tool_call_id', 'callId']) {
            const candidate = value[key]
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                return candidate
            }
        }
    }
    return extractToolCallId(value.content, depth + 1)
        ?? extractToolCallId(value.data, depth + 1)
        ?? extractToolCallId(value.message, depth + 1)
}

function classifyMessage(message: DecryptedMessage, filters: SessionLoomFilters): ConversationEntry | null {
    const record = unwrapRoleWrappedRecordEnvelope(message.content)
    if (!record) {
        if (!filters.includeSystemEvents) {
            return null
        }
        const text = extractText(message.content) || safeStringify(message.content)
        return {
            message,
            role: 'system',
            text: truncate(text, MAX_ENTRY_TEXT_LENGTH),
            toolDetailsOmitted: false
        }
    }

    const toolLike = isToolLikeContent(record.content)
    if (toolLike && !filters.includeToolDetails) {
        return {
            message,
            role: 'tool',
            text: '[Tool details omitted by export filters]',
            toolDetailsOmitted: true
        }
    }

    const text = extractText(record.content) || safeStringify(record.content)
    if (
        !filters.includeSystemEvents
        && record.role !== 'user'
        && record.role !== 'agent'
        && record.role !== 'assistant'
        && !toolLike
    ) {
        return null
    }

    if (record.role === 'user') {
        return {
            message,
            role: 'user',
            text: truncate(text, MAX_ENTRY_TEXT_LENGTH),
            toolDetailsOmitted: false
        }
    }
    if (toolLike) {
        return {
            message,
            role: 'tool',
            text: truncate(text, MAX_ENTRY_TEXT_LENGTH),
            toolDetailsOmitted: false
        }
    }
    if (record.role === 'agent' || record.role === 'assistant') {
        return {
            message,
            role: 'assistant',
            text: truncate(text, MAX_ENTRY_TEXT_LENGTH),
            toolDetailsOmitted: false
        }
    }
    return {
        message,
        role: 'system',
        text: truncate(text, MAX_ENTRY_TEXT_LENGTH),
        toolDetailsOmitted: false
    }
}

function isTrivialAssistantText(value: string): boolean {
    const text = collapseWhitespace(value).toLowerCase()
    return text === ''
        || text === 'ok'
        || text === 'okay'
        || text === 'done'
        || text === '完成'
        || text === '好的'
        || text === '已完成'
}

function outlineKindForEntry(entry: ConversationEntry): SessionLoomOutlineKind {
    if (entry.role === 'tool') return 'tool'
    if (entry.role === 'system') return 'system'
    if (entry.role === 'assistant' && (/\b(decision|decided|tradeoff|drift)\b/i.test(entry.text) || /决定|结论|取舍|偏差/.test(entry.text))) {
        return 'decision'
    }
    return entry.role
}

function targetMessageIdForEntry(entry: ConversationEntry): string {
    if (entry.role === 'user') {
        return `user-text:${entry.message.id}`
    }
    if (entry.role === 'tool') {
        const record = unwrapRoleWrappedRecordEnvelope(entry.message.content)
        const toolCallId = extractToolCallId(record?.content ?? entry.message.content)
        return toolCallId ? `tool-call:${toolCallId}` : `agent-text:${entry.message.id}:0`
    }
    if (entry.role === 'system') {
        return `agent-event:${entry.message.id}`
    }
    return `agent-text:${entry.message.id}:0`
}

export function redactSessionLoomText(value: string): RedactionResult {
    let count = 0
    const replace = (input: string, pattern: RegExp, replacement: (...args: string[]) => string): string => {
        return input.replace(pattern, (...args: string[]) => {
            count += 1
            return replacement(...args)
        })
    }

    let text = value
    text = replace(text, /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, () => '[REDACTED_PRIVATE_KEY]')
    text = replace(text, /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, () => 'Bearer [REDACTED]')
    text = replace(text, /\bsk-[A-Za-z0-9_-]{12,}\b/g, () => '[REDACTED_TOKEN]')
    text = replace(text, /\bghp_[A-Za-z0-9_]{20,}\b/g, () => '[REDACTED_TOKEN]')
    text = replace(text, /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, () => '[REDACTED_TOKEN]')
    text = replace(text, /\b[A-Za-z]:\\(?:[^\\\s:*?"<>|]+\\)*[^\\\s:*?"<>|]*/g, () => '[REDACTED_PATH]')
    text = replace(
        text,
        /(^|[\s([{"'`])\/(?:home|Users|var|tmp|etc|opt|srv|mnt|Volumes|workspace|root)\/[^\s)\]}"'`,]*/g,
        (_match, prefix) => `${prefix}[REDACTED_PATH]`
    )
    text = replace(text, /([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+:[^/@\s]+)@/gi, (_match, protocol) => `${protocol}[REDACTED]@`)
    text = replace(text, /([?&](?:token|api_key|apikey|key|secret|password|auth|credential)=)[^&#\s]+/gi, (_match, prefix) => `${prefix}[REDACTED]`)
    text = replace(
        text,
        /("(?:token|password|secret|apiKey|api_key|auth|credential|key)"\s*:\s*")([^"]*)(")/gi,
        (_match, prefix, _secret, suffix) => `${prefix}[REDACTED]${suffix}`
    )
    text = replace(
        text,
        /(^|[^?&A-Za-z0-9_])(\b(?:token|password|secret|apiKey|api_key|auth|credential|key)\b\s*[:=]\s*)(["']?)([^&\s"',}]+)/gi,
        (_match, prefix, keyPrefix, quote) => `${prefix}${keyPrefix}${quote}[REDACTED]`
    )
    return { text, count }
}

function applyRedaction(value: string, filters: SessionLoomFilters): RedactionResult {
    if (!filters.redactSecrets) {
        return { text: value, count: 0 }
    }
    return redactSessionLoomText(value)
}

function rawSessionTitle(session: Session): string {
    return session.metadata?.name ?? session.metadata?.path ?? session.id
}

function exportSafeSessionTitle(session: Session, filters: SessionLoomFilters): RedactionResult {
    return applyRedaction(rawSessionTitle(session), filters)
}

function exportSafeMetadataHost(value: unknown, filters: SessionLoomFilters): RedactionResult {
    const text = typeof value === 'string' && value.trim().length > 0 ? value : 'n/a'
    if (!filters.redactSecrets || text === 'n/a') {
        return { text, count: 0 }
    }
    return { text: '[REDACTED_HOST]', count: 1 }
}

export function buildSessionLoomOutline(params: {
    session: Session
    messages: readonly DecryptedMessage[]
    filters: SessionLoomFilters
    generatedAt: number
}): SessionLoomOutlineResponse {
    const entries = params.messages
        .map((message) => classifyMessage(message, params.filters))
        .filter((entry): entry is ConversationEntry => entry !== null)

    const items: SessionLoomOutlineItem[] = []
    for (const entry of entries) {
        if (entry.role === 'assistant' && isTrivialAssistantText(entry.text)) {
            continue
        }
        const rawLabel = truncate(entry.text, MAX_OUTLINE_LABEL_LENGTH)
        const label = params.filters.redactSecrets ? redactSessionLoomText(rawLabel).text : rawLabel
        if (!label) {
            continue
        }
        const kind = outlineKindForEntry(entry)
        items.push({
            id: `session-loom:${kind}:${entry.message.id}`,
            targetMessageId: targetMessageIdForEntry(entry),
            kind,
            label,
            createdAt: entry.message.createdAt,
            depth: entry.role === 'assistant' || entry.role === 'tool' ? 1 : 0
        })
    }

    return {
        success: true,
        sessionId: params.session.id,
        title: exportSafeSessionTitle(params.session, params.filters).text,
        generatedAt: params.generatedAt,
        items,
        stats: {
            totalMessages: params.messages.length,
            outlineItems: items.length,
            firstMessageAt: params.messages[0]?.createdAt ?? null,
            lastMessageAt: params.messages[params.messages.length - 1]?.createdAt ?? null
        }
    }
}

function computeStats(
    messages: readonly DecryptedMessage[],
    entries: readonly ConversationEntry[],
    outline: SessionLoomOutlineResponse,
    redactions: number
): SessionLoomExportStats {
    return {
        messageCount: messages.length,
        outlineCount: outline.items.length,
        userMessages: entries.filter((entry) => entry.role === 'user').length,
        assistantMessages: entries.filter((entry) => entry.role === 'assistant').length,
        systemEvents: entries.filter((entry) => entry.role === 'system').length,
        redactions,
        filteredToolDetails: entries.filter((entry) => entry.toolDetailsOmitted).length
    }
}

function labels(language: SessionLoomLanguage) {
    if (language === 'en') {
        return {
            generated: 'Generated',
            template: 'Template',
            metadata: 'Session metadata',
            summary: 'Summary',
            outline: 'Outline',
            rawConversation: 'Raw conversation',
            clarification: 'Clarification Q&A',
            filters: 'Filters',
            drift: 'Drift and decisions',
            noClarification: 'No explicit clarification Q&A was detected.',
            noDecision: 'No explicit drift or decision marker was detected.',
            redactionOn: 'secret redaction enabled',
            redactionOff: 'secret redaction disabled',
            toolDetailsOn: 'tool details included',
            toolDetailsOff: 'tool details omitted',
            systemOn: 'system events included',
            systemOff: 'system events omitted'
        }
    }
    return {
        generated: '生成时间',
        template: '导出模板',
        metadata: '会话元数据',
        summary: '概要',
        outline: '大纲',
        rawConversation: '原始对话',
        clarification: '澄清问答',
        filters: '过滤规则',
        drift: '偏差与决策区',
        noClarification: '未检测到明确的澄清问答。',
        noDecision: '未检测到明确的偏差或决策标记。',
        redactionOn: '已启用敏感信息脱敏',
        redactionOff: '未启用敏感信息脱敏',
        toolDetailsOn: '包含工具详情',
        toolDetailsOff: '省略工具详情',
        systemOn: '包含系统事件',
        systemOff: '省略系统事件'
    }
}

function roleLabel(role: ConversationEntry['role'], language: SessionLoomLanguage): string {
    if (language === 'en') {
        return role === 'user' ? 'User' : role === 'assistant' ? 'Assistant' : role === 'tool' ? 'Tool' : 'System'
    }
    return role === 'user' ? '用户' : role === 'assistant' ? '助手' : role === 'tool' ? '工具' : '系统'
}

function buildSummary(entries: readonly ConversationEntry[], language: SessionLoomLanguage): string[] {
    const userPrompts = entries.filter((entry) => entry.role === 'user').slice(0, 5)
    if (language === 'en') {
        return [
            `This export contains ${entries.length} visible conversation entries.`,
            ...userPrompts.map((entry) => `- User asked: ${truncate(entry.text, 120)}`)
        ]
    }
    return [
        `本导出包含 ${entries.length} 条可见对话记录。`,
        ...userPrompts.map((entry) => `- 用户提出：${truncate(entry.text, 120)}`)
    ]
}

function extractClarifications(entries: readonly ConversationEntry[]): string[] {
    return entries
        .filter((entry) => /clarify|clarification|question|answer|澄清|问题|回答|确认/.test(entry.text))
        .slice(0, 10)
        .map((entry) => `- ${truncate(entry.text, 180)}`)
}

function extractDecisions(entries: readonly ConversationEntry[]): string[] {
    return entries
        .filter((entry) => /decision|decided|tradeoff|risk|drift|决定|结论|取舍|风险|偏差/i.test(entry.text))
        .slice(0, 10)
        .map((entry) => `- ${truncate(entry.text, 180)}`)
}

function templateName(template: SessionLoomTemplate, language: SessionLoomLanguage): string {
    if (language === 'en') {
        switch (template) {
            case 'raw': return 'Raw conversation'
            case 'design': return 'Design handoff'
            case 'prd': return 'PRD notes'
            case 'decisions': return 'Decision log'
            case 'retrospective': return 'Retrospective'
            case 'drift-check': return 'Drift check'
            case 'lesson-card': return 'Lesson card'
        }
    }
    switch (template) {
        case 'raw': return '原始对话'
        case 'design': return '设计交付'
        case 'prd': return 'PRD 笔记'
        case 'decisions': return '决策记录'
        case 'retrospective': return '复盘'
        case 'drift-check': return '偏差检查'
        case 'lesson-card': return '经验卡片'
    }
}

function templateDescription(template: SessionLoomTemplate, language: SessionLoomLanguage): string {
    if (language === 'en') {
        switch (template) {
            case 'raw': return 'chronological transcript for archiving and debugging'
            case 'design': return 'design goals, interaction notes, decisions, and open questions'
            case 'prd': return 'requirements, scope, acceptance signals, and risks'
            case 'decisions': return 'decisions, tradeoffs, unresolved questions, and source outline'
            case 'retrospective': return 'what happened, issues, follow-ups, and reusable takeaways'
            case 'drift-check': return 'original intent compared with drift, risks, and system/tool signals'
            case 'lesson-card': return 'reusable lesson, context, practice, and caveats'
        }
    }
    switch (template) {
        case 'raw': return '按时间顺序留档，适合排查和完整复盘'
        case 'design': return '整理设计目标、交互线索、决策和待确认问题'
        case 'prd': return '整理需求、范围、验收线索和风险'
        case 'decisions': return '集中记录决定、取舍、未决问题和来源大纲'
        case 'retrospective': return '复盘做了什么、问题、后续动作和可复用经验'
        case 'drift-check': return '对照原始目标检查偏差、风险和系统/工具信号'
        case 'lesson-card': return '沉淀可复用经验、适用场景、做法和注意事项'
    }
}

function templateSectionLabels(language: SessionLoomLanguage): Record<
    'templateOverview'
    | 'designGoals'
    | 'interactionNotes'
    | 'requirements'
    | 'scopeAcceptance'
    | 'completedWork'
    | 'issuesRisks'
    | 'followUps'
    | 'originalIntent'
    | 'signals'
    | 'lesson'
    | 'applicableContext'
    | 'practice'
    | 'caveats',
    string
> {
    if (language === 'en') {
        return {
            templateOverview: 'Template overview',
            designGoals: 'Design goals',
            interactionNotes: 'Interaction notes',
            requirements: 'Requirements',
            scopeAcceptance: 'Scope and acceptance signals',
            completedWork: 'Completed work',
            issuesRisks: 'Issues and risks',
            followUps: 'Follow-ups',
            originalIntent: 'Original intent',
            signals: 'Signals',
            lesson: 'Lesson',
            applicableContext: 'Applicable context',
            practice: 'Practice',
            caveats: 'Caveats'
        }
    }
    return {
        templateOverview: '模板说明',
        designGoals: '设计目标',
        interactionNotes: '交互与交付线索',
        requirements: '用户需求',
        scopeAcceptance: '范围与验收线索',
        completedWork: '完成事项',
        issuesRisks: '问题与风险',
        followUps: '后续动作',
        originalIntent: '原始目标',
        signals: '信号',
        lesson: '经验',
        applicableContext: '适用场景',
        practice: '可复用做法',
        caveats: '注意事项'
    }
}

function emptyTemplateLine(language: SessionLoomLanguage): string {
    return language === 'en' ? '- (none detected)' : '- （未检测到）'
}

function entryLines(
    entries: readonly ConversationEntry[],
    language: SessionLoomLanguage,
    predicate: (entry: ConversationEntry) => boolean,
    limit = 10
): string[] {
    return entries
        .filter(predicate)
        .slice(0, limit)
        .map((entry) => `- ${roleLabel(entry.role, language)}：${truncate(entry.text, 180)}`)
}

function appendSection(lines: string[], title: string, content: readonly string[], emptyLine: string): void {
    lines.push(`## ${title}`, '', ...(content.length > 0 ? content : [emptyLine]), '')
}

function buildTemplateSections(params: {
    template: SessionLoomTemplate
    language: SessionLoomLanguage
    sanitizedEntries: readonly ConversationEntry[]
    outlineItems: readonly SessionLoomOutlineItem[]
    conversationLines: readonly string[]
    clarificationLines: readonly string[]
    decisionLines: readonly string[]
    filterLines: readonly string[]
    copy: ReturnType<typeof labels>
}): string[] {
    const section = templateSectionLabels(params.language)
    const emptyLine = emptyTemplateLine(params.language)
    const lines: string[] = []
    const userLines = entryLines(params.sanitizedEntries, params.language, (entry) => entry.role === 'user')
    const assistantLines = entryLines(params.sanitizedEntries, params.language, (entry) => entry.role === 'assistant')
    const systemToolLines = entryLines(params.sanitizedEntries, params.language, (entry) => entry.role === 'system' || entry.role === 'tool')
    const issueRiskLines = entryLines(params.sanitizedEntries, params.language, (entry) => /risk|issue|problem|blocked|failed|风险|问题|失败|阻塞|异常/i.test(entry.text))
    const followUpLines = entryLines(params.sanitizedEntries, params.language, (entry) => /todo|follow.?up|next|后续|下一步|待办|继续/i.test(entry.text))
    const outlineLines = params.outlineItems.map((item) => `- ${formatBeijingTime(item.createdAt, params.language)} · ${item.kind} · ${item.label}`)

    appendSection(lines, section.templateOverview, [
        `- ${params.copy.template}: ${templateName(params.template, params.language)}`,
        `- ${params.copy.summary}: ${templateDescription(params.template, params.language)}`
    ], emptyLine)

    switch (params.template) {
        case 'raw':
            appendSection(lines, params.copy.outline, outlineLines, '- (empty)')
            appendSection(lines, params.copy.rawConversation, params.conversationLines, '(empty)')
            appendSection(lines, params.copy.clarification, params.clarificationLines.length > 0 ? params.clarificationLines : [params.copy.noClarification], emptyLine)
            appendSection(lines, params.copy.drift, params.decisionLines.length > 0 ? params.decisionLines : [params.copy.noDecision], emptyLine)
            break
        case 'design':
            appendSection(lines, section.designGoals, userLines, emptyLine)
            appendSection(lines, section.interactionNotes, [...assistantLines, ...params.decisionLines], emptyLine)
            appendSection(lines, params.copy.clarification, params.clarificationLines.length > 0 ? params.clarificationLines : [params.copy.noClarification], emptyLine)
            appendSection(lines, section.followUps, followUpLines, emptyLine)
            appendSection(lines, params.copy.outline, outlineLines, '- (empty)')
            break
        case 'prd':
            appendSection(lines, section.requirements, userLines, emptyLine)
            appendSection(lines, section.scopeAcceptance, [...params.clarificationLines, ...params.decisionLines], emptyLine)
            appendSection(lines, section.issuesRisks, issueRiskLines, emptyLine)
            appendSection(lines, section.followUps, followUpLines, emptyLine)
            appendSection(lines, params.copy.rawConversation, params.conversationLines, '(empty)')
            break
        case 'decisions':
            appendSection(lines, params.copy.drift, params.decisionLines.length > 0 ? params.decisionLines : [params.copy.noDecision], emptyLine)
            appendSection(lines, params.copy.clarification, params.clarificationLines.length > 0 ? params.clarificationLines : [params.copy.noClarification], emptyLine)
            appendSection(lines, section.issuesRisks, issueRiskLines, emptyLine)
            appendSection(lines, params.copy.outline, outlineLines, '- (empty)')
            break
        case 'retrospective':
            appendSection(lines, section.completedWork, assistantLines, emptyLine)
            appendSection(lines, section.issuesRisks, issueRiskLines, emptyLine)
            appendSection(lines, section.followUps, followUpLines, emptyLine)
            appendSection(lines, section.lesson, params.decisionLines.length > 0 ? params.decisionLines : [params.copy.noDecision], emptyLine)
            appendSection(lines, params.copy.rawConversation, params.conversationLines, '(empty)')
            break
        case 'drift-check':
            appendSection(lines, section.originalIntent, userLines.slice(0, 3), emptyLine)
            appendSection(lines, params.copy.drift, params.decisionLines.length > 0 ? params.decisionLines : [params.copy.noDecision], emptyLine)
            appendSection(lines, section.signals, [...issueRiskLines, ...systemToolLines], emptyLine)
            appendSection(lines, params.copy.outline, outlineLines, '- (empty)')
            break
        case 'lesson-card':
            appendSection(lines, section.lesson, params.decisionLines.length > 0 ? params.decisionLines : assistantLines.slice(0, 5), emptyLine)
            appendSection(lines, section.applicableContext, userLines.slice(0, 5), emptyLine)
            appendSection(lines, section.practice, assistantLines.slice(0, 8), emptyLine)
            appendSection(lines, section.caveats, issueRiskLines, emptyLine)
            break
    }

    appendSection(lines, params.copy.filters, params.filterLines, emptyLine)
    return lines
}

export function buildSessionLoomExportPreview(params: {
    session: Session
    messages: readonly DecryptedMessage[]
    request: SessionLoomExportPreviewRequest
    generatedAt: number
}): SessionLoomExportPreviewResponse {
    const filters = {
        redactSecrets: params.request.filters.redactSecrets ?? true,
        includeSystemEvents: params.request.filters.includeSystemEvents ?? false,
        includeToolDetails: params.request.filters.includeToolDetails ?? false
    }
    const entries = params.messages
        .map((message) => classifyMessage(message, filters))
        .filter((entry): entry is ConversationEntry => entry !== null)
    const outline = buildSessionLoomOutline({
        session: params.session,
        messages: params.messages,
        filters,
        generatedAt: params.generatedAt
    })
    const copy = labels(params.request.language)
    let redactions = 0
    const titleResult = exportSafeSessionTitle(params.session, filters)
    redactions += titleResult.count
    const title = titleResult.text
    const sanitizedEntries = entries.map((entry) => {
        const redacted = applyRedaction(entry.text, filters)
        redactions += redacted.count
        return { ...entry, text: redacted.text }
    })
    const outlineItems = outline.items.map((item) => ({
        ...item,
        label: filters.redactSecrets ? redactSessionLoomText(item.label).text : item.label
    }))
    const filterLines = [
        `- ${filters.redactSecrets ? copy.redactionOn : copy.redactionOff}`,
        `- ${filters.includeSystemEvents ? copy.systemOn : copy.systemOff}`,
        `- ${filters.includeToolDetails ? copy.toolDetailsOn : copy.toolDetailsOff}`,
    ]
    const metadataPath = applyRedaction(params.session.metadata?.path ?? 'n/a', filters)
    const metadataHost = exportSafeMetadataHost(params.session.metadata?.host, filters)
    redactions += metadataPath.count + metadataHost.count
    const stats = computeStats(params.messages, sanitizedEntries, outline, redactions)
    const metadataLines = [
        `- id: ${params.session.id}`,
        `- path: ${metadataPath.text}`,
        `- host: ${metadataHost.text}`,
        `- flavor: ${params.session.metadata?.flavor ?? 'n/a'}`,
        `- active: ${params.session.active ? 'true' : 'false'}`,
    ]
    const conversationLines = sanitizedEntries.map((entry, index) => {
        return [
            `### ${index + 1}. ${roleLabel(entry.role, params.request.language)} · ${formatBeijingTime(entry.message.createdAt, params.request.language)}`,
            '',
            entry.text || '(empty)'
        ].join('\n')
    })
    const clarificationLines = extractClarifications(sanitizedEntries)
    const decisionLines = extractDecisions(sanitizedEntries)
    const templateSections = buildTemplateSections({
        template: params.request.template,
        language: params.request.language,
        sanitizedEntries,
        outlineItems,
        conversationLines,
        clarificationLines,
        decisionLines,
        filterLines,
        copy
    })
    const markdown = [
        `# ${title}`,
        '',
        `> ${copy.generated}: ${formatBeijingTime(params.generatedAt, params.request.language)}`,
        '',
        `## ${copy.metadata}`,
        '',
        ...metadataLines,
        '',
        `## ${copy.summary}`,
        '',
        ...buildSummary(sanitizedEntries, params.request.language),
        '',
        ...templateSections,
        ''
    ].join('\n')

    return {
        success: true,
        sessionId: params.session.id,
        generatedAt: params.generatedAt,
        markdown,
        title,
        stats,
        filters,
        warnings: filters.redactSecrets
            ? []
            : ['Secret redaction is disabled for this preview.']
    }
}

function buildLocalSynthesis(preview: SessionLoomExportPreviewResponse, template: SessionLoomTemplate, language: SessionLoomLanguage): SessionLoomSynthesisResponse {
    const heading = language === 'en' ? 'Local synthesis' : '本地提炼'
    const lines = language === 'en'
        ? [
            `${heading}: ${preview.title}`,
            '',
            `- Messages: ${preview.stats.messageCount}`,
            `- User prompts: ${preview.stats.userMessages}`,
            `- Assistant replies: ${preview.stats.assistantMessages}`,
            `- Template: ${template}`,
            `- Redactions: ${preview.stats.redactions}`,
        ]
        : [
            `${heading}：${preview.title}`,
            '',
            `- 消息数：${preview.stats.messageCount}`,
            `- 用户消息：${preview.stats.userMessages}`,
            `- 助手回复：${preview.stats.assistantMessages}`,
            `- 模板：${template}`,
            `- 脱敏次数：${preview.stats.redactions}`,
        ]

    return {
        success: true,
        sessionId: preview.sessionId,
        generatedAt: preview.generatedAt,
        template,
        provider: 'local',
        summary: lines.join('\n'),
        markdown: [
            `# ${heading}`,
            '',
            ...lines,
            '',
            '---',
            '',
            preview.markdown
        ].join('\n'),
        filters: preview.filters,
        stats: preview.stats
    }
}

async function readAllMessages(engine: SyncEngine, sessionId: string): Promise<DecryptedMessage[]> {
    const all: DecryptedMessage[] = []
    let before: { at: number; seq: number } | null = null
    for (;;) {
        const page = engine.getMessagesPage(sessionId, { limit: 200, before })
        all.unshift(...page.messages)
        if (!page.page.hasMore || page.page.nextBeforeAt === null || page.page.nextBeforeSeq === null) {
            break
        }
        before = { at: page.page.nextBeforeAt, seq: page.page.nextBeforeSeq }
    }
    return all.sort((a, b) => {
        const at = a.createdAt - b.createdAt
        return at !== 0 ? at : (a.seq ?? 0) - (b.seq ?? 0)
    })
}

function pruneOldExports(sessionId: string): void {
    const now = Date.now()
    for (const [exportId, entry] of exportsById.entries()) {
        if (entry.asset.expiresAt <= now) {
            exportsById.delete(exportId)
        }
    }

    const sessionExports = [...exportsById.values()]
        .filter((entry) => entry.asset.sessionId === sessionId)
        .sort((a, b) => b.asset.createdAt - a.asset.createdAt)
    for (const stale of sessionExports.slice(MAX_EXPORTS_PER_SESSION)) {
        exportsById.delete(stale.asset.exportId)
    }
}

function safeFileName(value: string): string {
    const base = value
        .trim()
        .replace(/[\\/]+/g, '-')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')
    return `${base || 'session-loom-export'}.md`
}

function checksumMarkdown(markdown: string): string {
    return createHash('sha256').update(markdown, 'utf8').digest('hex')
}

export function createSessionLoomRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/sessions/:id/conversation-outline', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const generatedAt = Date.now()
        const messages = await readAllMessages(engine, sessionResult.sessionId)
        return c.json(buildSessionLoomOutline({
            session: sessionResult.session,
            messages,
            filters: DEFAULT_SESSION_LOOM_FILTERS,
            generatedAt
        }))
    })

    app.post('/sessions/:id/exports/preview', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json().catch(() => null)
        const parsed = SessionLoomExportPreviewRequestSchema.safeParse(body ?? {})
        if (!parsed.success) {
            return c.json({ error: 'Invalid body', issues: parsed.error.flatten() }, 400)
        }

        const messages = await readAllMessages(engine, sessionResult.sessionId)
        return c.json(buildSessionLoomExportPreview({
            session: sessionResult.session,
            messages,
            request: parsed.data,
            generatedAt: Date.now()
        }))
    })

    app.post('/sessions/:id/exports', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json().catch(() => null)
        const parsed = SessionLoomExportRequestSchema.safeParse(body ?? {})
        if (!parsed.success) {
            return c.json({ error: 'Invalid body', issues: parsed.error.flatten() }, 400)
        }

        const messages = await readAllMessages(engine, sessionResult.sessionId)
        const generatedAt = Date.now()
        const preview = buildSessionLoomExportPreview({
            session: sessionResult.session,
            messages,
            request: parsed.data,
            generatedAt
        })
        const exportId = randomUUID()
        const fileName = safeFileName(parsed.data.fileName ?? preview.title)
        const asset: SessionLoomExportAsset = {
            exportId,
            sessionId: sessionResult.sessionId,
            title: preview.title,
            fileName,
            format: parsed.data.format,
            template: parsed.data.template,
            createdAt: generatedAt,
            expiresAt: generatedAt + EXPORT_TTL_MS,
            sizeBytes: Buffer.byteLength(preview.markdown, 'utf8'),
            checksum: checksumMarkdown(preview.markdown),
            stats: preview.stats
        }
        exportsById.set(exportId, { asset, markdown: preview.markdown })
        pruneOldExports(sessionResult.sessionId)

        return c.json({ success: true, asset, markdown: preview.markdown })
    })

    app.get('/sessions/:id/exports', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        pruneOldExports(sessionResult.sessionId)
        const assets = [...exportsById.values()]
            .filter((entry) => entry.asset.sessionId === sessionResult.sessionId)
            .map((entry) => entry.asset)
            .sort((a, b) => b.createdAt - a.createdAt)
        return c.json({ success: true, assets })
    })

    app.get('/sessions/:id/exports/:exportId/download', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const exportId = c.req.param('exportId')
        const stored = exportsById.get(exportId)
        if (!stored || stored.asset.sessionId !== sessionResult.sessionId || stored.asset.expiresAt <= Date.now()) {
            exportsById.delete(exportId)
            return c.json({ error: 'Export not found' }, 404)
        }

        return c.body(stored.markdown, 200, {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(stored.asset.fileName)}"`
        })
    })

    app.delete('/sessions/:id/exports/:exportId', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const exportId = c.req.param('exportId')
        const stored = exportsById.get(exportId)
        if (!stored || stored.asset.sessionId !== sessionResult.sessionId) {
            return c.json({ error: 'Export not found' }, 404)
        }
        exportsById.delete(exportId)
        return c.json({ success: true })
    })

    app.post('/sessions/:id/synthesis', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json().catch(() => null)
        const parsed = SessionLoomSynthesisRequestSchema.safeParse(body ?? {})
        if (!parsed.success) {
            return c.json({ error: 'Invalid body', issues: parsed.error.flatten() }, 400)
        }
        if (parsed.data.useExternalModel && !parsed.data.explicitConfirmation) {
            return c.json({ error: 'External synthesis requires explicit confirmation' }, 400)
        }
        if (parsed.data.useExternalModel) {
            return c.json({ error: 'External synthesis is not configured' }, 400)
        }

        const messages = await readAllMessages(engine, sessionResult.sessionId)
        const preview = buildSessionLoomExportPreview({
            session: sessionResult.session,
            messages,
            request: {
                language: parsed.data.language,
                format: 'markdown',
                template: parsed.data.template,
                filters: parsed.data.filters
            },
            generatedAt: Date.now()
        })
        return c.json(buildLocalSynthesis(preview, parsed.data.template, parsed.data.language))
    })

    return app
}
