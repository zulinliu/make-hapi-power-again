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

const SKILLS_DIR = () => join(getHome(), '.claude', 'skills')
const SKILL_NAME_RE = /^[a-zA-Z0-9_-]+$/
const REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/

function getHome(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? homedir()
}

interface SkillMeta {
    source: string
    repo?: string
    originalPath?: string
    installedAt: string
}

async function readSkillMeta(skillName: string): Promise<SkillMeta | null> {
    const metaPath = join(SKILLS_DIR(), skillName, '.skill-meta.json')
    if (!existsSync(metaPath)) return null
    try {
        const data = await readFile(metaPath, 'utf-8')
        return JSON.parse(data)
    } catch {
        return null
    }
}

async function writeSkillMeta(skillName: string, meta: SkillMeta): Promise<void> {
    const metaPath = join(SKILLS_DIR(), skillName, '.skill-meta.json')
    await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

export function registerSkillManagementHandlers(rpcHandlerManager: RpcHandlerManager): void {
    rpcHandlerManager.registerHandler(RPC_METHODS.SkillSearch, async (request: { query: string; limit?: number }) => {
        try {
            const { query, limit = 20 } = request

            if (!query || query.length < 2) {
                return { success: true, results: [], total: 0 }
            }

            // Fetch from skills.sh API
            const response = await fetch(
                `https://skills.sh/api/search?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}`,
                { signal: AbortSignal.timeout(10_000) }
            )

            if (!response.ok) {
                return rpcError(`skills.sh search failed: ${response.status}`)
            }

            const data = await response.json() as {
                results: Array<{
                    name: string
                    description?: string
                    repo: string
                    path: string
                    stars?: number
                    author?: string
                }>
                total: number
            }

            return { success: true, results: data.results ?? [], total: data.total ?? 0 }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to search skills'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.SkillInstall, async (request: {
        name: string
        repo: string
        path?: string
    }) => {
        try {
            const { name, repo, path } = request

            if (!name || !SKILL_NAME_RE.test(name)) {
                return rpcError('Invalid skill name')
            }
            if (!repo || !REPO_RE.test(repo)) {
                return rpcError('Invalid repo format (expected owner/repo)')
            }

            const skillsDir = SKILLS_DIR()
            const targetDir = resolve(skillsDir, name)

            // Path traversal check
            if (!targetDir.startsWith(resolve(skillsDir))) {
                return rpcError('Invalid skill path')
            }

            if (existsSync(targetDir)) {
                return rpcError(`Skill already installed: ${name}`)
            }

            await mkdir(targetDir, { recursive: true })

            const branch = 'main'
            try {
                await execFileAsync('git', ['clone', '--depth', '1', '--sparse', '--branch', branch, `https://github.com/${repo}.git`, targetDir], { timeout: 60_000 })
            } catch {
                // Try without branch specification
                await execFileAsync('git', ['clone', '--depth', '1', '--sparse', `https://github.com/${repo}.git`, targetDir], { timeout: 60_000 })
            }

            // If a specific path is specified, use sparse-checkout
            if (path) {
                try {
                    await execFileAsync('git', ['sparse-checkout', 'set', path], { cwd: targetDir, timeout: 30_000 })
                } catch {
                    logger.debug(`sparse-checkout failed for ${name}, full clone used`)
                }
            }

            // Write installation metadata
            await writeSkillMeta(name, {
                source: 'skills-sh',
                repo,
                originalPath: path,
                installedAt: new Date().toISOString(),
            })

            // Read SKILL.md content for response
            let description: string | undefined
            const skillMdPath = join(targetDir, path ?? '', 'SKILL.md')
            if (existsSync(skillMdPath)) {
                const content = await readFile(skillMdPath, 'utf-8')
                const descMatch = content.match(/^description:\s*(.+)$/m)
                if (descMatch) description = descMatch[1].trim()
            }

            logger.info(`Skill installed: ${name} from ${repo}`)
            return {
                success: true,
                skill: { name, description, repo, path, installedAt: new Date().toISOString() }
            }
        } catch (error) {
            // Cleanup on failure
            try {
                const targetDir = resolve(SKILLS_DIR(), request.name)
                if (request.name && SKILL_NAME_RE.test(request.name) && existsSync(targetDir)) {
                    await rm(targetDir, { recursive: true, force: true })
                }
            } catch (cleanupError) {
                logger.warn(`Cleanup failed for ${request.name}: ${getErrorMessage(cleanupError, 'unknown')}`)
            }
            return rpcError(getErrorMessage(error, 'Failed to install skill'))
        }
    })

    rpcHandlerManager.registerHandler(RPC_METHODS.SkillUninstall, async (request: { name: string }) => {
        try {
            const { name } = request

            if (!name || !SKILL_NAME_RE.test(name)) {
                return rpcError('Invalid skill name')
            }

            const skillDir = resolve(SKILLS_DIR(), name)
            if (!skillDir.startsWith(resolve(SKILLS_DIR()))) {
                return rpcError('Invalid skill path')
            }

            if (!existsSync(skillDir)) {
                return rpcError(`Skill not found: ${name}`)
            }

            await rm(skillDir, { recursive: true, force: true })
            logger.info(`Skill uninstalled: ${name}`)
            return { success: true, uninstalled: true }
        } catch (error) {
            return rpcError(getErrorMessage(error, 'Failed to uninstall skill'))
        }
    })
}
