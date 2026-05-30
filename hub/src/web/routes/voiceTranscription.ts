import { Hono } from 'hono'
import type { WebAppEnv } from '../middleware/auth'

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions'

const MAX_AUDIO_SIZE = 25 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
    'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm',
    'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'
])

function sanitizeFilename(name: string): string {
    const base = name.replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    return base || 'recording.webm'
}

export function createVoiceTranscriptionRoutes(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post('/voice/transcribe', async (c) => {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return c.json({ error: 'OpenAI API key not configured' }, 400)
        }

        const contentType = c.req.header('content-type') || ''
        let audioBuffer: Buffer
        let mimeType = 'audio/webm'
        let filename = 'recording.webm'

        if (contentType.includes('multipart/form-data')) {
            const formData = await c.req.formData()
            const audioFile = formData.get('audio') as File | null
            if (!audioFile) {
                return c.json({ error: 'No audio file provided' }, 400)
            }

            if (audioFile.size > MAX_AUDIO_SIZE) {
                return c.json({ error: 'Audio file too large (max 25MB)' }, 413)
            }

            mimeType = audioFile.type || 'audio/webm'
            if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
                return c.json({ error: `Unsupported audio format: ${mimeType}` }, 400)
            }

            filename = sanitizeFilename(audioFile.name || 'recording.webm')
            const arrayBuffer = await audioFile.arrayBuffer()
            audioBuffer = Buffer.from(arrayBuffer)
        } else {
            const body = await c.req.arrayBuffer()
            if (body.byteLength > MAX_AUDIO_SIZE) {
                return c.json({ error: 'Audio data too large (max 25MB)' }, 413)
            }
            audioBuffer = Buffer.from(body)
        }

        const formData = new FormData()
        formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)
        formData.append('model', 'whisper-1')
        formData.append('response_format', 'json')

        const lang = c.req.header('x-language')
        if (lang) {
            formData.append('language', lang)
        }

        try {
            const response = await fetch(WHISPER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } }
                return c.json({
                    error: errorData.error?.message || `Whisper API error: ${response.status}`
                }, 500)
            }

            const data = await response.json() as { text?: string; language?: string }
            return c.json({
                success: true,
                text: data.text || '',
                language: data.language
            })
        } catch (error) {
            return c.json({
                error: error instanceof Error ? error.message : 'Transcription failed'
            }, 500)
        }
    })

    return app
}
