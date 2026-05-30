import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/ui/logger'
import { RPC_METHODS } from '@hapi/protocol/rpcMethods'
import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import { getErrorMessage, rpcError } from '../rpcResponses'

const execFileAsync = promisify(execFile)

const PLUGINS_DIR = () => join(getHome(), '.claude', 'plugins', 'local')
const STORAGE_DIR = () => join(PLUGINS_DIR(), '.storage')
const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]*$/
const MAX_STORAGE_KEYS = 1000

function getHome(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? homedir()
}

interface PluginManifest {
    id: string
    name: string
    version: string
    description?: string
    author?: string
    main: string
    permissions: string[]
    contributes?: {
        commands?: Array<{ id: string; label: string; handler: string }>
        panels?: Array<{ id: string; label: string; component: string }>
        settings?: Array<{ key: string; type: string; label: string; default: unknown }>
    }
}

interface InstalledPlugin {
    id: string
    name: string
    version: string
    description?: string
    author?: string
    permissions: string[]
    enabled: boolean
    installedAt: string
    sourceType: string
    sourceUrl?: string
}

function getRegistryPath(): string {
    return join(PLUGINS_DIR(), 'registry.json')
}

async function readRegistry(): Promise<Record<string, InstalledPlugin>> {
    const path = getRegistryPath()
    if (!existsSync(path)) return {}
    try {
        const data = await readFile(path, 'utf-8')
        return JSON.parse(data)
    } catch {
        return {}
    }
}

async function writeRegistry(registry: Record<string, InstalledPlugin>): Promise<void> {
    const dir = PLUGINS_DIR()
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
    }
    await writeFile(getRegistryPath(), JSON.stringify(registry, null, 2), 'utf-8')
}

async function readManifest(pluginDir: string): Promise<PluginManifest | null> {
    const manifestPath = join(pluginDir, 'plugin.json')
    if (!existsSync(manifestPath)) return null
    try {
        const data = await readFile(manifestPath, 'utf-8')
        return JSON.parse(data)
    } catch {
        return null
    }
}

async function discoverInstalledPlugins(): Promise<InstalledPlugin[]> {
    const registry = await readRegistry()
    const plugins: InstalledPlugin[] = []

    for (const [id, meta] of Object.entries(registry)) {
        const pluginDir = join(PLUGINS_DIR(), id)
        const manifest = await readManifest(pluginDir)
        plugins.push({
            ...meta,
            id,
            name: manifest?.name ?? meta.name ?? id,
            version: manifest?.version ?? meta.version ?? '0.0.0',
            description: manifest?.description ?? meta.description,
            permissions: manifest?.permissions ?? meta.permissions ?? [],
        })
    }

    return plugins
}

async function ensureStorageDir(pluginId: string): Promise<string> {
    const dir = STORAGE_DIR()
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
    }
    const storagePath = join(dir, `${pluginId}.json`)
    return storagePath
}

async function readPluginStorage(pluginId: string): Promise<Record<string, string>> {
    const storagePath = await ensureStorageDir(pluginId)
    if (!existsSync(storagePath)) return {}
    try {
        const data = await readFile(storagePath, 'utf-8')
        return JSON.parse(data)
    } catch {
        return {}
    }
}

async function writePluginStorage(pluginId: string, data: Record<string, string>): Promise<void> {
    const storagePath = await ensureStorageDir(pluginId)
    await writeFile(storagePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function registerPluginHandlers(rpcHandlerManager: RpcHandlerManager): void {
    rpcHandlerManager.registerHandler(RPC_METHODS.PluginList, async () => {
        try {
            const plugins = await discoverInstalledPlugins()
            return { success: true, plugins }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to list plugins'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.PluginInstall, async (request: {
        pluginId: string
        sourceUrl?: string
        sourceType?: string
    }) => {
        try {
            const { pluginId, sourceUrl, sourceType = 'registry' } = request

            if (!pluginId || !PLUGIN_ID_RE.test(pluginId)) {
                return rpcError('Invalid plugin ID (must match [a-z0-9][a-z0-9-]*)')
            }

            const pluginDir = resolve(PLUGINS_DIR(), pluginId)
            if (!pluginDir.startsWith(resolve(PLUGINS_DIR()))) {
                return rpcError('Invalid plugin path')
            }

            if (!existsSync(pluginDir)) {
                await mkdir(pluginDir, { recursive: true })
                await writeFile(join(pluginDir, 'plugin.json'), JSON.stringify({
                    id: pluginId,
                    name: pluginId,
                    version: '0.0.1',
                    main: 'index.js',
                    permissions: [],
                }, null, 2))
            }

            const manifest = await readManifest(pluginDir)
            const registry = await readRegistry()

            registry[pluginId] = {
                id: pluginId,
                name: manifest?.name ?? pluginId,
                version: manifest?.version ?? '0.0.1',
                description: manifest?.description,
                author: manifest?.author,
                permissions: manifest?.permissions ?? [],
                enabled: true,
                installedAt: new Date().toISOString(),
                sourceType,
                sourceUrl,
            }

            await writeRegistry(registry)

            logger.info(`Plugin installed: ${pluginId}`)
            return { success: true, plugin: registry[pluginId] }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to install plugin'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.PluginUninstall, async (request: { pluginId: string }) => {
        try {
            const { pluginId } = request

            if (!pluginId || !PLUGIN_ID_RE.test(pluginId)) {
                return rpcError('Invalid plugin ID')
            }

            const registry = await readRegistry()

            if (!registry[pluginId]) {
                return rpcError(`Plugin not found: ${pluginId}`)
            }

            const pluginDir = resolve(PLUGINS_DIR(), pluginId)
            if (pluginDir.startsWith(resolve(PLUGINS_DIR()))) {
                if (existsSync(pluginDir)) {
                    await rm(pluginDir, { recursive: true, force: true })
                }
            }

            const storagePath = join(STORAGE_DIR(), `${pluginId}.json`)
            if (existsSync(storagePath)) {
                await rm(storagePath, { force: true })
            }

            // Remove from registry
            delete registry[pluginId]
            await writeRegistry(registry)

            logger.info(`Plugin uninstalled: ${pluginId}`)
            return { success: true, uninstalled: true }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to uninstall plugin'))
        }
    })

    // Storage KV operations
    rpcHandlerManager.registerHandler(RPC_METHODS.PluginStorageGet, async (request: { pluginId: string; key: string }) => {
        try {
            if (!request.pluginId || !PLUGIN_ID_RE.test(request.pluginId)) return rpcError('Invalid plugin ID')
            const data = await readPluginStorage(request.pluginId)
            return { success: true, value: data[request.key] ?? null }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to get storage'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.PluginStorageSet, async (request: { pluginId: string; key: string; value: string }) => {
        try {
            if (!request.pluginId || !PLUGIN_ID_RE.test(request.pluginId)) return rpcError('Invalid plugin ID')
            const data = await readPluginStorage(request.pluginId)
            if (Object.keys(data).length >= MAX_STORAGE_KEYS && !(request.key in data)) {
                return rpcError('Storage key limit exceeded')
            }
            data[request.key] = request.value
            await writePluginStorage(request.pluginId, data)
            return { success: true, set: true }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to set storage'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.PluginStorageDelete, async (request: { pluginId: string; key: string }) => {
        try {
            if (!request.pluginId || !PLUGIN_ID_RE.test(request.pluginId)) return rpcError('Invalid plugin ID')
            const data = await readPluginStorage(request.pluginId)
            delete data[request.key]
            await writePluginStorage(request.pluginId, data)
            return { success: true, deleted: true }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to delete storage'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.PluginStorageList, async (request: { pluginId: string; prefix?: string }) => {
        try {
            if (!request.pluginId || !PLUGIN_ID_RE.test(request.pluginId)) return rpcError('Invalid plugin ID')
            const data = await readPluginStorage(request.pluginId)
            const prefix = request.prefix ?? ''
            const entries = Object.entries(data)
                .filter(([key]) => key.startsWith(prefix))
                .map(([key, value]) => ({ key, value }))
            return { success: true, entries }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to list storage'))
        }
    })
}
