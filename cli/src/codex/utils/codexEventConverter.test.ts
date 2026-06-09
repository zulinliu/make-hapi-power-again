import { describe, expect, it } from 'vitest';
import { convertCodexEvent } from './codexEventConverter';

describe('convertCodexEvent', () => {
    it('extracts session_meta id', () => {
        const result = convertCodexEvent({
            type: 'session_meta',
            payload: { id: 'session-123' }
        });

        expect(result).toEqual({ sessionId: 'session-123' });
    });

    it('converts agent_message events', () => {
        const result = convertCodexEvent({
            type: 'event_msg',
            payload: { type: 'agent_message', message: 'hello' }
        });

        expect(result?.message).toMatchObject({
            type: 'message',
            message: 'hello'
        });
    });

    it('converts user_message events', () => {
        const result = convertCodexEvent({
            type: 'event_msg',
            payload: { type: 'user_message', message: 'hello user' }
        });

        expect(result?.userMessage).toBe('hello user');
    });

    it('converts reasoning events', () => {
        const result = convertCodexEvent({
            type: 'event_msg',
            payload: { type: 'agent_reasoning', text: 'thinking' }
        });

        expect(result?.message).toMatchObject({
            type: 'reasoning',
            message: 'thinking'
        });
    });

    it('converts reasoning delta events', () => {
        const result = convertCodexEvent({
            type: 'event_msg',
            payload: { type: 'agent_reasoning_delta', delta: 'step' }
        });

        expect(result?.message).toEqual({
            type: 'reasoning-delta',
            delta: 'step'
        });
    });

    it('sanitizes token_count usage info', () => {
        const result = convertCodexEvent({
            type: 'event_msg',
            payload: {
                type: 'token_count',
                info: {
                    thread_id: 'thread-1',
                    turn_id: 'turn-1',
                    prompt: 'do not persist this prompt',
                    headers: { authorization: 'Bearer secret' },
                    last: {
                        inputTokens: 10,
                        outputTokens: 2,
                        requestPath: '/home/tester/project'
                    },
                    total_token_usage: {
                        prompt_tokens: 20,
                        completion_tokens: 4,
                        total_tokens: 24,
                        prompt_tokens_details: {
                            cached_tokens: 3
                        },
                        apiKey: 'redacted-test-key'
                    }
                }
            }
        });

        expect(result?.message).toMatchObject({
            type: 'token_count',
            info: {
                thread_id: 'thread-1',
                turn_id: 'turn-1',
                last: {
                    inputTokens: 10,
                    outputTokens: 2
                },
                total_token_usage: {
                    prompt_tokens: 20,
                    completion_tokens: 4,
                    total_tokens: 24,
                    prompt_tokens_details: {
                        cached_tokens: 3
                    }
                }
            }
        });
    });

    it('converts function_call items', () => {
        const result = convertCodexEvent({
            type: 'response_item',
            payload: {
                type: 'function_call',
                name: 'ToolName',
                call_id: 'call-1',
                arguments: '{"foo":"bar"}'
            }
        });

        expect(result?.message).toMatchObject({
            type: 'tool-call',
            name: 'ToolName',
            callId: 'call-1',
            input: { foo: 'bar' }
        });
    });

    it('converts function_call_output items', () => {
        const result = convertCodexEvent({
            type: 'response_item',
            payload: {
                type: 'function_call_output',
                call_id: 'call-2',
                output: { ok: true }
            }
        });

        expect(result?.message).toMatchObject({
            type: 'tool-call-result',
            callId: 'call-2',
            output: { ok: true }
        });
    });
});
