import { useCallback, useRef } from 'react'
import { Manager, Socket } from 'socket.io-client'
import { useAppContext } from '@/lib/app-context'

interface BinaryUploadResult {
    success: boolean
    path?: string
    error?: string
}

export function useBinaryUpload() {
    const { baseUrl, token } = useAppContext()
    const socketRef = useRef<Socket | null>(null)
    const managerRef = useRef<Manager | null>(null)

    const getSocket = useCallback((): Socket | null => {
        if (!baseUrl || !token) return null

        if (socketRef.current?.connected) return socketRef.current

        if (managerRef.current) {
            managerRef.current._close()
            managerRef.current = null
        }

        const socketUrl = baseUrl.replace(/\/$/, '')
        const manager = new Manager(socketUrl, {
            path: '/socket.io/',
            reconnection: false,
            transports: ['websocket'],
        })
        managerRef.current = manager

        const socket = manager.socket('/terminal', {
            auth: { token }
        })
        socketRef.current = socket

        socket.on('disconnect', () => {
            socketRef.current = null
        })

        return socket
    }, [baseUrl, token])

    const uploadBinaryFile = useCallback(async (
        sessionId: string,
        file: File
    ): Promise<BinaryUploadResult> => {
        const socket = getSocket()
        if (!socket) {
            return { success: false, error: 'Socket not available' }
        }

        if (!socket.connected) {
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'))
                }, 5000)
                socket.once('connect', () => {
                    clearTimeout(timeout)
                    resolve()
                })
                socket.once('connect_error', (err) => {
                    clearTimeout(timeout)
                    reject(err)
                })
                socket.connect()
            })
        }

        const arrayBuffer = await file.arrayBuffer()

        return new Promise<BinaryUploadResult>((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Upload timeout' })
            }, 30000)

            socket.emit('image:upload', {
                sessionId,
                filename: file.name,
                mimeType: file.type || 'application/octet-stream'
            }, arrayBuffer, (response: BinaryUploadResult) => {
                clearTimeout(timeout)
                resolve(response)
            })
        })
    }, [getSocket])

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect()
            socketRef.current = null
        }
    }, [])

    return { uploadBinaryFile, disconnect }
}
