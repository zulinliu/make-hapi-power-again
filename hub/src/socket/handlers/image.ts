import { z } from 'zod'
import type { SocketWithData } from '../socketTypes'

const imageUploadMetaSchema = z.object({
    sessionId: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().regex(/^image\/.+/, 'Only image MIME types allowed')
})

const MAX_BINARY_UPLOAD_BYTES = 50 * 1024 * 1024

export type ImageHandlersDeps = {
    uploadBinary: (sessionId: string, filename: string, base64Content: string, mimeType: string) => Promise<{ success: boolean; path?: string; error?: string }>
}

export function registerImageHandlers(socket: SocketWithData, deps: ImageHandlersDeps): void {
    const { uploadBinary } = deps

    socket.on('image:upload', async (meta: unknown, binary: unknown, ack?: (response: unknown) => void) => {
        const respond = (data: unknown) => ack?.(data)

        if (!ack) return

        const parsed = imageUploadMetaSchema.safeParse(meta)
        if (!parsed.success) {
            respond({ success: false, error: 'Invalid metadata' })
            return
        }

        if (!Buffer.isBuffer(binary) && !(binary instanceof ArrayBuffer) && !(binary instanceof Uint8Array)) {
            respond({ success: false, error: 'Binary data required' })
            return
        }

        const buffer = Buffer.isBuffer(binary) ? binary : Buffer.from(binary as ArrayBuffer)
        if (buffer.length > MAX_BINARY_UPLOAD_BYTES) {
            respond({ success: false, error: 'File too large (max 50MB)' })
            return
        }

        const { sessionId, filename, mimeType } = parsed.data

        try {
            const base64Content = buffer.toString('base64')
            const result = await uploadBinary(sessionId, filename, base64Content, mimeType)
            respond(result)
        } catch (error) {
            respond({
                success: false,
                error: error instanceof Error ? error.message : 'Upload failed'
            })
        }
    })
}
