import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { WebAppEnv } from '../middleware/auth'
import { createOrchestrationRoutes } from './orchestration'

function createApp() {
    const app = new Hono<WebAppEnv>()
    app.route('/api', createOrchestrationRoutes())
    return app
}

describe('orchestration routes', () => {
    describe('GET /api/orchestration/skills', () => {
        it('returns all orchestration skills', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
            expect(body.skills).toBeInstanceOf(Array)
            expect(body.skills).toHaveLength(5)
        })

        it('includes all expected skill patterns', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills')
            const body = await response.json() as Record<string, any>

            const patterns = body.skills.map((s: { pattern: string }) => s.pattern)
            expect(patterns).toContain('loop')
            expect(patterns).toContain('handoff')
            expect(patterns).toContain('advisor')
            expect(patterns).toContain('committee')
            expect(patterns).toContain('epic')
        })

        it('each skill has required fields', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills')
            const body = await response.json() as Record<string, any>

            for (const skill of body.skills) {
                expect(skill.id).toMatch(/^orchestration-/)
                expect(typeof skill.name).toBe('string')
                expect(skill.name.length).toBeGreaterThan(0)
                expect(typeof skill.description).toBe('string')
                expect(skill.description.length).toBeGreaterThan(0)
                expect(typeof skill.config).toBe('object')
            }
        })
    })

    describe('GET /api/orchestration/skills/:id', () => {
        it('returns a single skill by id', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills/orchestration-loop')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
            expect(body.skill.id).toBe('orchestration-loop')
            expect(body.skill.pattern).toBe('loop')
            expect(body.skill.config.maxIterations).toBe(10)
        })

        it('returns handoff skill', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills/orchestration-handoff')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.skill.pattern).toBe('handoff')
            expect(body.skill.config.preserveContext).toBe(true)
        })

        it('returns advisor skill', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills/orchestration-advisor')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.skill.pattern).toBe('advisor')
            expect(body.skill.config.consultBeforeAction).toBe(true)
        })

        it('returns committee skill', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills/orchestration-committee')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.skill.pattern).toBe('committee')
            expect(body.skill.config.memberCount).toBe(3)
        })

        it('returns epic skill', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills/orchestration-epic')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.skill.pattern).toBe('epic')
            expect(body.skill.config.parallelism).toBe(2)
        })

        it('returns 404 for unknown skill id', async () => {
            const app = createApp()

            const response = await app.request('/api/orchestration/skills/orchestration-nonexistent')

            expect(response.status).toBe(404)
            const body = await response.json() as Record<string, any>
            expect(body.error).toBe('Skill not found')
        })
    })
})
