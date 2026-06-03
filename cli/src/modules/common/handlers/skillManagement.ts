import { mkdir, readFile, rm, readdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/ui/logger'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import { getErrorMessage, rpcError } from '../rpcResponses'

const execFileAsync = promisify(execFile)

const SKILLS_DIR = () => join(getHome(), '.claude', 'skills')
const SKILL_NAME_RE = /^[a-zA-Z0-9_-]+$/
const REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/

function getHome(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? homedir()
}

async function findSkillMd(dir: string): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        if (entry.name === 'SKILL.md') return join(dir, 'SKILL.md')
        if (entry.name.startsWith('.') || entry.name === '.git') continue
        if (entry.isDirectory()) {
            const found = await findSkillMd(join(dir, entry.name)).catch(() => null)
            if (found) return found
        }
    }
    return null
}

/**
 * Find the skill subdirectory within a cloned repo that contains the target skill.
 * Handles multi-skill repos where skills live in subdirectories like skills/<name>/.
 */
async function findSkillDirInRepo(repoDir: string, skillName: string): Promise<string> {
    // Strategy 1: SKILL.md at repo root (single-skill repo)
    if (existsSync(join(repoDir, 'SKILL.md'))) {
        return repoDir
    }

    // Strategy 2: <skillName>/SKILL.md
    if (existsSync(join(repoDir, skillName, 'SKILL.md'))) {
        return join(repoDir, skillName)
    }

    // Strategy 3: skills/<skillName>/SKILL.md (common multi-skill repo layout)
    if (existsSync(join(repoDir, 'skills', skillName, 'SKILL.md'))) {
        return join(repoDir, 'skills', skillName)
    }

    // Strategy 4: Recursive search for a directory named <skillName> containing SKILL.md
    async function searchDir(dir: string, depth: number): Promise<string | null> {
        if (depth > 5) return null
        try {
            const entries = await readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '.git') continue
                const subPath = join(dir, entry.name)
                if (entry.name === skillName && existsSync(join(subPath, 'SKILL.md'))) {
                    return subPath
                }
                const found = await searchDir(subPath, depth + 1)
                if (found) return found
            }
        } catch { /* ignore */ }
        return null
    }

    const found = await searchDir(repoDir, 0)
    if (found) return found

    // Fallback: return repo root
    return repoDir
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
            const { name, repo } = request

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

            // Check if already installed (SKILL.md at root means valid install)
            if (existsSync(targetDir) && existsSync(join(targetDir, 'SKILL.md'))) {
                return rpcError(`Skill already installed: ${name}`)
            }

            // Clean up any incomplete/broken install
            if (existsSync(targetDir)) {
                await rm(targetDir, { recursive: true, force: true })
            }

            await mkdir(skillsDir, { recursive: true })

            // Clone to temp directory first, then extract the correct skill subdirectory
            const tmpDir = resolve(skillsDir, `.tmp-${name}-${Date.now()}`)

            try {
                // Clone repo to temp dir
                try {
                    await execFileAsync('git', ['clone', '--depth', '1', '--branch', 'main', `https://github.com/${repo}.git`, tmpDir], { timeout: 60_000 })
                } catch {
                    try {
                        await execFileAsync('git', ['clone', '--depth', '1', `https://github.com/${repo}.git`, tmpDir], { timeout: 60_000 })
                    } catch {
                        throw new Error(`Failed to clone ${repo}`)
                    }
                }

                // Find the skill directory within the cloned repo
                const skillSourceDir = await findSkillDirInRepo(tmpDir, name)

                // Copy skill contents to target (excluding .git)
                await mkdir(targetDir, { recursive: true })
                await execFileAsync('cp', ['-r', `${skillSourceDir}/.`, targetDir], { timeout: 30_000 })
                // Remove .git from target to save space
                const gitDir = join(targetDir, '.git')
                if (existsSync(gitDir)) {
                    await rm(gitDir, { recursive: true, force: true })
                }
            } finally {
                // Always clean up temp directory
                if (existsSync(tmpDir)) {
                    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
                }
            }

            // Write installation metadata
            await writeSkillMeta(name, {
                source: 'skills-sh',
                repo,
                originalPath: request.path,
                installedAt: new Date().toISOString(),
            })

            // Read description from SKILL.md (now at root of target)
            let description: string | undefined
            const skillMdPath = join(targetDir, 'SKILL.md')
            if (existsSync(skillMdPath)) {
                const content = await readFile(skillMdPath, 'utf-8')
                const descMatch = content.match(/^description:\s*(.+)$/m)
                if (descMatch) description = descMatch[1].trim()
            }

            logger.info(`Skill installed: ${name} from ${repo}`)
            return {
                success: true,
                skill: { name, description, repo, installedAt: new Date().toISOString() }
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
