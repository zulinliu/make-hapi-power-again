import { logger } from '@/ui/logger'
import { resolve, dirname } from 'path'
import { unlink, rmdir, rename, cp, mkdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import { validatePath } from '../pathSecurity'
import { getErrorMessage, rpcError } from '../rpcResponses'

interface DeleteFileRequest {
    path: string
    recursive?: boolean
}

interface RenameFileRequest {
    oldPath: string
    newPath: string
}

interface CopyFileRequest {
    sourcePath: string
    destinationPath: string
}

interface MoveFileRequest {
    sourcePath: string
    destinationPath: string
}

interface CreateDirectoryRequest {
    path: string
    recursive?: boolean
}

export function registerFileOperationHandlers(rpcHandlerManager: RpcHandlerManager, workingDirectory: string): void {
    rpcHandlerManager.registerHandler<DeleteFileRequest>(RPC_METHODS.DeleteFile, async (data) => {
        logger.debug('Delete file request:', data.path)

        const validation = validatePath(data.path, workingDirectory)
        if (!validation.valid) {
            return rpcError(validation.error ?? 'Invalid file path')
        }

        const resolvedPath = resolve(workingDirectory, data.path)

        try {
            const fileStat = await stat(resolvedPath)
            if (fileStat.isDirectory()) {
                if (data.recursive) {
                    const { rm } = await import('fs/promises')
                    await rm(resolvedPath, { recursive: true, force: false })
                } else {
                    await rmdir(resolvedPath)
                }
            } else {
                await unlink(resolvedPath)
            }
            return { success: true }
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException
            if (nodeError.code === 'ENOENT') {
                return rpcError('File or directory not found')
            }
            if (nodeError.code === 'ENOTEMPTY') {
                return rpcError('Directory is not empty. Use recursive option to delete.')
            }
            logger.debug('Failed to delete:', error)
            return rpcError(getErrorMessage(error, 'Failed to delete'))
        }
    })

    rpcHandlerManager.registerHandler<RenameFileRequest>(RPC_METHODS.RenameFile, async (data) => {
        logger.debug('Rename file request:', data.oldPath, '->', data.newPath)

        const srcValidation = validatePath(data.oldPath, workingDirectory)
        if (!srcValidation.valid) {
            return rpcError(srcValidation.error ?? 'Invalid source path')
        }
        const dstValidation = validatePath(data.newPath, workingDirectory)
        if (!dstValidation.valid) {
            return rpcError(dstValidation.error ?? 'Invalid destination path')
        }

        const resolvedOld = resolve(workingDirectory, data.oldPath)
        const resolvedNew = resolve(workingDirectory, data.newPath)

        if (!existsSync(resolvedOld)) {
            return rpcError('Source path does not exist')
        }
        if (existsSync(resolvedNew)) {
            return rpcError('Destination path already exists')
        }

        try {
            const destDir = dirname(resolvedNew)
            if (!existsSync(destDir)) {
                await mkdir(destDir, { recursive: true })
            }
            await rename(resolvedOld, resolvedNew)
            return { success: true }
        } catch (error) {
            logger.debug('Failed to rename:', error)
            return rpcError(getErrorMessage(error, 'Failed to rename'))
        }
    })

    rpcHandlerManager.registerHandler<CopyFileRequest>(RPC_METHODS.CopyFile, async (data) => {
        logger.debug('Copy file request:', data.sourcePath, '->', data.destinationPath)

        const srcValidation = validatePath(data.sourcePath, workingDirectory)
        if (!srcValidation.valid) {
            return rpcError(srcValidation.error ?? 'Invalid source path')
        }
        const dstValidation = validatePath(data.destinationPath, workingDirectory)
        if (!dstValidation.valid) {
            return rpcError(dstValidation.error ?? 'Invalid destination path')
        }

        const resolvedSrc = resolve(workingDirectory, data.sourcePath)
        const resolvedDst = resolve(workingDirectory, data.destinationPath)

        if (!existsSync(resolvedSrc)) {
            return rpcError('Source path does not exist')
        }
        if (existsSync(resolvedDst)) {
            return rpcError('Destination path already exists')
        }

        try {
            const destDir = dirname(resolvedDst)
            if (!existsSync(destDir)) {
                await mkdir(destDir, { recursive: true })
            }
            const srcStat = await stat(resolvedSrc)
            await cp(resolvedSrc, resolvedDst, { recursive: srcStat.isDirectory() })
            return { success: true }
        } catch (error) {
            logger.debug('Failed to copy:', error)
            return rpcError(getErrorMessage(error, 'Failed to copy'))
        }
    })

    rpcHandlerManager.registerHandler<MoveFileRequest>(RPC_METHODS.MoveFile, async (data) => {
        logger.debug('Move file request:', data.sourcePath, '->', data.destinationPath)

        const srcValidation = validatePath(data.sourcePath, workingDirectory)
        if (!srcValidation.valid) {
            return rpcError(srcValidation.error ?? 'Invalid source path')
        }
        const dstValidation = validatePath(data.destinationPath, workingDirectory)
        if (!dstValidation.valid) {
            return rpcError(dstValidation.error ?? 'Invalid destination path')
        }

        const resolvedSrc = resolve(workingDirectory, data.sourcePath)
        const resolvedDst = resolve(workingDirectory, data.destinationPath)

        if (!existsSync(resolvedSrc)) {
            return rpcError('Source path does not exist')
        }
        if (existsSync(resolvedDst)) {
            return rpcError('Destination path already exists')
        }

        try {
            const destDir = dirname(resolvedDst)
            if (!existsSync(destDir)) {
                await mkdir(destDir, { recursive: true })
            }
            await rename(resolvedSrc, resolvedDst)
            return { success: true }
        } catch (error) {
            logger.debug('Failed to move:', error)
            return rpcError(getErrorMessage(error, 'Failed to move'))
        }
    })

    rpcHandlerManager.registerHandler<CreateDirectoryRequest>(RPC_METHODS.CreateDirectory, async (data) => {
        logger.debug('Create directory request:', data.path)

        const validation = validatePath(data.path, workingDirectory)
        if (!validation.valid) {
            return rpcError(validation.error ?? 'Invalid directory path')
        }

        const resolvedPath = resolve(workingDirectory, data.path)

        if (existsSync(resolvedPath)) {
            return rpcError('Directory already exists')
        }

        try {
            await mkdir(resolvedPath, { recursive: data.recursive !== false })
            return { success: true }
        } catch (error) {
            logger.debug('Failed to create directory:', error)
            return rpcError(getErrorMessage(error, 'Failed to create directory'))
        }
    })
}
