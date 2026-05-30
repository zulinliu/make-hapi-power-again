import { Hono } from 'hono'
import type { WebAppEnv } from '../middleware/auth'

interface OrchestrationSkill {
    id: string
    name: string
    description: string
    pattern: 'loop' | 'handoff' | 'advisor' | 'committee' | 'epic'
    config: Record<string, unknown>
}

const ORCHESTRATION_SKILLS: OrchestrationSkill[] = [
    {
        id: 'orchestration-loop',
        name: 'Loop',
        description: '自主循环执行模式 — 代理持续执行任务直到完成条件满足或达到最大迭代次数。适用于需要多轮迭代的复杂任务。',
        pattern: 'loop',
        config: {
            maxIterations: 10,
            stopCondition: 'task-complete',
            checkpointInterval: 5
        }
    },
    {
        id: 'orchestration-handoff',
        name: 'Handoff',
        description: '任务移交模式 — 将当前任务上下文完整移交给另一个专业代理。适用于需要不同专业领域知识的场景。',
        pattern: 'handoff',
        config: {
            preserveContext: true,
            targetAgent: 'specialist',
            includeHistory: true
        }
    },
    {
        id: 'orchestration-advisor',
        name: 'Advisor',
        description: '顾问模式 — 在代理做出关键决策前，先咨询另一个代理获取建议。适用于需要多角度评估的决策场景。',
        pattern: 'advisor',
        config: {
            advisorRole: 'reviewer',
            consultBeforeAction: true,
            includeAdviceInResponse: false
        }
    },
    {
        id: 'orchestration-committee',
        name: 'Committee',
        description: '委员会模式 — 多个代理并行审查同一问题，汇总意见后做出最终决策。适用于需要共识的关键决策。',
        pattern: 'committee',
        config: {
            memberCount: 3,
            decisionStrategy: 'majority',
            includeDissentingOpinions: true
        }
    },
    {
        id: 'orchestration-epic',
        name: 'Epic',
        description: '史诗模式 — 将大型任务分解为多个子任务，按依赖关系编排执行顺序。适用于需要多阶段完成的复杂项目。',
        pattern: 'epic',
        config: {
            decompositionStrategy: 'dependency-graph',
            parallelism: 2,
            checkpointAfterPhase: true
        }
    }
]

export function createOrchestrationRoutes(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/orchestration/skills', (c) => {
        return c.json({ success: true, skills: ORCHESTRATION_SKILLS })
    })

    app.get('/orchestration/skills/:id', (c) => {
        const skill = ORCHESTRATION_SKILLS.find(s => s.id === c.req.param('id'))
        if (!skill) {
            return c.json({ error: 'Skill not found' }, 404)
        }
        return c.json({ success: true, skill })
    })

    return app
}
