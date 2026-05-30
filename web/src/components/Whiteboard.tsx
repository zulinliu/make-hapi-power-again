import { useState, useRef, useCallback, useEffect } from 'react'

interface WhiteboardProps {
    onSend: (base64DataUrl: string) => void
    onClose: () => void
}

type Tool = 'pen' | 'eraser'

const COLORS = [
    '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
]

const STROKE_WIDTHS = [2, 4, 6, 8, 12]

export function Whiteboard({ onSend, onClose }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [tool, setTool] = useState<Tool>('pen')
    const [color, setColor] = useState('#000000')
    const [strokeWidth, setStrokeWidth] = useState(4)
    const [isDrawing, setIsDrawing] = useState(false)
    const lastPosRef = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
    }, [])

    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        if ('touches' in e) {
            const touch = e.touches[0] || e.changedTouches[0]
            return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }, [])

    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        setIsDrawing(true)
        lastPosRef.current = getPos(e)
    }, [getPos])

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        if (!isDrawing) return

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx || !lastPosRef.current) return

        const pos = getPos(e)

        ctx.beginPath()
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
        ctx.lineWidth = tool === 'eraser' ? strokeWidth * 3 : strokeWidth
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()

        lastPosRef.current = pos
    }, [isDrawing, color, strokeWidth, tool, getPos])

    const stopDraw = useCallback(() => {
        setIsDrawing(false)
        lastPosRef.current = null
    }, [])

    const handleClear = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        const dpr = window.devicePixelRatio || 1
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    }, [])

    const handleSend = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dataUrl = canvas.toDataURL('image/png')
        onSend(dataUrl)
    }, [onSend])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col w-[90vw] max-w-[800px] h-[80vh] max-h-[600px] bg-[var(--app-bg)] rounded-xl shadow-2xl border border-[var(--app-border)] overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                    <div className="flex gap-1">
                        {(['pen', 'eraser'] as Tool[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTool(t)}
                                className={`px-2 py-1 text-xs rounded ${
                                    tool === t
                                        ? 'bg-[var(--app-fg)] text-[var(--app-bg)]'
                                        : 'text-[var(--app-hint)] hover:bg-[var(--app-bg)]'
                                }`}
                            >
                                {t === 'pen' ? '画笔' : '橡皮'}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-5 bg-[var(--app-border)]" />

                    <div className="flex gap-1">
                        {COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => { setColor(c); setTool('pen') }}
                                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                                    color === c && tool === 'pen' ? 'border-[var(--app-fg)] scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>

                    <div className="w-px h-5 bg-[var(--app-border)]" />

                    <div className="flex gap-1">
                        {STROKE_WIDTHS.map(w => (
                            <button
                                key={w}
                                type="button"
                                onClick={() => setStrokeWidth(w)}
                                className={`flex items-center justify-center w-6 h-6 rounded ${
                                    strokeWidth === w ? 'bg-[var(--app-fg)]/10' : ''
                                }`}
                            >
                                <div
                                    className="rounded-full bg-[var(--app-fg)]"
                                    style={{ width: Math.min(w, 8), height: Math.min(w, 8) }}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="flex-1" />

                    <button type="button" onClick={handleClear} className="text-xs text-[var(--app-hint)] hover:text-[var(--app-fg)] px-2 py-1">
                        清空
                    </button>
                    <button type="button" onClick={onClose} className="text-xs text-[var(--app-hint)] hover:text-[var(--app-fg)] px-2 py-1">
                        关闭
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        className="text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                    >
                        发送给代理
                    </button>
                </div>

                {/* Canvas */}
                <div className="flex-1 relative overflow-hidden bg-white">
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={stopDraw}
                        onMouseLeave={stopDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={stopDraw}
                    />
                </div>
            </div>
        </div>
    )
}
