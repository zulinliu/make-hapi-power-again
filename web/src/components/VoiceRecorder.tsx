import { useState, useCallback, useRef, useEffect } from 'react'

interface VoiceRecorderProps {
    onTranscribed: (text: string) => void
    onError?: (error: string) => void
}

type RecorderState = 'idle' | 'recording' | 'uploading' | 'error'

export function VoiceRecorder({ onTranscribed, onError }: VoiceRecorderProps) {
    const [state, setState] = useState<RecorderState>('idle')
    const [duration, setDuration] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef<number>(0)

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try { mediaRecorderRef.current.stop() } catch {}
        }
        mediaRecorderRef.current = null
        chunksRef.current = []
    }, [])

    useEffect(() => {
        return cleanup
    }, [cleanup])

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/ogg'

            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = recorder
            chunksRef.current = []

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop())

                if (chunksRef.current.length === 0) {
                    setState('idle')
                    return
                }

                setState('uploading')
                const audioBlob = new Blob(chunksRef.current, { type: mimeType })

                try {
                    const formData = new FormData()
                    formData.append('audio', audioBlob, `recording.${mimeType.includes('webm') ? 'webm' : 'ogg'}`)

                    const response = await fetch('/api/voice/transcribe', {
                        method: 'POST',
                        body: formData
                    })

                    if (!response.ok) {
                        const body = await response.json().catch(() => ({}))
                        throw new Error(body.error || 'Transcription failed')
                    }

                    const data = await response.json() as { success?: boolean; text?: string }
                    if (data.text) {
                        onTranscribed(data.text)
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Transcription failed'
                    onError?.(msg)
                    setState('error')
                    setTimeout(() => setState('idle'), 2000)
                    return
                }

                setState('idle')
                setDuration(0)
            }

            startTimeRef.current = Date.now()
            setDuration(0)
            setState('recording')
            recorder.start(1000)

            timerRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
            }, 500)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Microphone access denied'
            onError?.(msg)
            setState('error')
            setTimeout(() => setState('idle'), 2000)
        }
    }, [onTranscribed, onError])

    const stopRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
        }
    }, [])

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    if (state === 'idle') {
        return (
            <button
                type="button"
                onClick={startRecording}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] transition-colors"
                title="语音输入"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
            </button>
        )
    }

    return (
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {state === 'recording' && (
                <>
                    <span className="text-xs text-red-500 font-mono tabular-nums">
                        {formatDuration(duration)}
                    </span>
                    <button
                        type="button"
                        onClick={stopRecording}
                        className="text-xs text-red-500 hover:text-red-400 font-medium"
                    >
                        停止
                    </button>
                </>
            )}
            {state === 'uploading' && (
                <span className="text-xs text-[var(--app-hint)]">转录中...</span>
            )}
            {state === 'error' && (
                <span className="text-xs text-red-500">录音失败</span>
            )}
        </div>
    )
}
