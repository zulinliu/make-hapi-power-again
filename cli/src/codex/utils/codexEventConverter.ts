import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logger } from '@/ui/logger';

const CodexSessionEventSchema = z.object({
    timestamp: z.string().optional(),
    type: z.string(),
    payload: z.unknown().optional()
});

export type CodexSessionEvent = z.infer<typeof CodexSessionEventSchema>;

export type CodexMessage = {
    type: 'message';
    message: string;
    id: string;
} | {
    type: 'reasoning';
    message: string;
    id: string;
} | {
    type: 'reasoning-delta';
    delta: string;
} | {
    type: 'token_count';
    info: Record<string, unknown>;
    id: string;
} | {
    type: 'tool-call';
    name: string;
    callId: string;
    input: unknown;
    id: string;
} | {
    type: 'tool-call-result';
    callId: string;
    output: unknown;
    id: string;
};

export type CodexConversionResult = {
    sessionId?: string;
    message?: CodexMessage;
    userMessage?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const TOKEN_USAGE_NUMBER_KEYS = new Set([
    'input_tokens',
    'inputTokens',
    'prompt_tokens',
    'promptTokens',
    'output_tokens',
    'outputTokens',
    'completion_tokens',
    'completionTokens',
    'total_tokens',
    'totalTokens',
    'context_tokens',
    'contextTokens',
    'context_window',
    'contextWindow',
    'model_context_window',
    'modelContextWindow',
    'cache_creation_input_tokens',
    'cacheCreationInputTokens',
    'cache_read_input_tokens',
    'cacheReadInputTokens',
    'cached_input_tokens',
    'cachedInputTokens',
    'cached_tokens',
    'cachedTokens',
    'prompt_cache_hit_tokens',
    'promptCacheHitTokens'
]);

const TOKEN_USAGE_OBJECT_KEYS = new Set([
    'last',
    'last_token_usage',
    'lastTokenUsage',
    'total',
    'total_token_usage',
    'totalTokenUsage',
    'prompt_tokens_details',
    'promptTokensDetails',
    'input_tokens_details',
    'inputTokensDetails'
]);

const TOKEN_USAGE_STRING_KEYS = new Set([
    'thread_id',
    'threadId',
    'turn_id',
    'turnId'
]);

function sanitizeTokenUsageInfo(value: unknown): Record<string, unknown> {
    const record = asRecord(value);
    if (!record || Array.isArray(value)) {
        return {};
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(record)) {
        if (TOKEN_USAGE_NUMBER_KEYS.has(key)) {
            const numberValue = asNumber(nestedValue);
            if (numberValue !== null) {
                sanitized[key] = numberValue;
            }
            continue;
        }

        if (TOKEN_USAGE_STRING_KEYS.has(key)) {
            const stringValue = asString(nestedValue);
            if (stringValue) {
                sanitized[key] = stringValue;
            }
            continue;
        }

        if (TOKEN_USAGE_OBJECT_KEYS.has(key)) {
            const nested = sanitizeTokenUsageInfo(nestedValue);
            if (Object.keys(nested).length > 0) {
                sanitized[key] = nested;
            }
        }
    }

    return sanitized;
}

function parseArguments(value: unknown): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            return JSON.parse(trimmed);
        } catch (error) {
            logger.debug('[codexEventConverter] Failed to parse function_call arguments as JSON:', error);
        }
    }

    return value;
}

function extractCallId(payload: Record<string, unknown>): string | null {
    const candidates = [
        'call_id',
        'callId',
        'tool_call_id',
        'toolCallId',
        'id'
    ];

    for (const key of candidates) {
        const value = payload[key];
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    return null;
}

export function convertCodexEvent(rawEvent: unknown): CodexConversionResult | null {
    const parsed = CodexSessionEventSchema.safeParse(rawEvent);
    if (!parsed.success) {
        return null;
    }

    const { type, payload } = parsed.data;
    const payloadRecord = asRecord(payload);

    if (type === 'session_meta') {
        const sessionId = payloadRecord ? asString(payloadRecord.id) : null;
        if (!sessionId) {
            return null;
        }
        return { sessionId };
    }

    if (!payloadRecord) {
        return null;
    }

    if (type === 'event_msg') {
        const eventType = asString(payloadRecord.type);
        if (!eventType) {
            return null;
        }

        if (eventType === 'user_message') {
            const message = asString(payloadRecord.message)
                ?? asString(payloadRecord.text)
                ?? asString(payloadRecord.content);
            if (!message) {
                return null;
            }
            return {
                userMessage: message
            };
        }

        if (eventType === 'agent_message') {
            const message = asString(payloadRecord.message);
            if (!message) {
                return null;
            }
            return {
                message: {
                    type: 'message',
                    message,
                    id: randomUUID()
                }
            };
        }

        if (eventType === 'agent_reasoning') {
            const message = asString(payloadRecord.text) ?? asString(payloadRecord.message);
            if (!message) {
                return null;
            }
            return {
                message: {
                    type: 'reasoning',
                    message,
                    id: randomUUID()
                }
            };
        }

        if (eventType === 'agent_reasoning_delta') {
            const delta = asString(payloadRecord.delta) ?? asString(payloadRecord.text) ?? asString(payloadRecord.message);
            if (!delta) {
                return null;
            }
            return {
                message: {
                    type: 'reasoning-delta',
                    delta
                }
            };
        }

        if (eventType === 'token_count') {
            const info = sanitizeTokenUsageInfo(payloadRecord.info);
            if (Object.keys(info).length === 0) {
                return null;
            }
            return {
                message: {
                    type: 'token_count',
                    info,
                    id: randomUUID()
                }
            };
        }

        return null;
    }

    if (type === 'response_item') {
        const itemType = asString(payloadRecord.type);
        if (!itemType) {
            return null;
        }

        if (itemType === 'function_call') {
            const name = asString(payloadRecord.name);
            const callId = extractCallId(payloadRecord);
            if (!name || !callId) {
                return null;
            }
            return {
                message: {
                    type: 'tool-call',
                    name,
                    callId,
                    input: parseArguments(payloadRecord.arguments),
                    id: randomUUID()
                }
            };
        }

        if (itemType === 'function_call_output') {
            const callId = extractCallId(payloadRecord);
            if (!callId) {
                return null;
            }
            return {
                message: {
                    type: 'tool-call-result',
                    callId,
                    output: payloadRecord.output,
                    id: randomUUID()
                }
            };
        }

        return null;
    }

    return null;
}
