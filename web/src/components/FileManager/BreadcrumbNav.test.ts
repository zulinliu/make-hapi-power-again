import { describe, expect, it } from 'vitest'
import { buildBreadcrumbs } from './BreadcrumbNav'

describe('buildBreadcrumbs', () => {
    it('shows the actual absolute path when the configured root label is not in the path', () => {
        expect(buildBreadcrumbs('/home/liuzl/agent/temp_test', 'project')).toEqual([
            { name: '/home/liuzl/agent/temp_test', path: '/home/liuzl/agent/temp_test' }
        ])
    })

    it('keeps project-root breadcrumbs when the root label is present', () => {
        expect(buildBreadcrumbs('/home/liuzl/project/src/components', 'project', 'Project root')).toEqual([
            { name: 'Project root', path: '/home/liuzl/project' },
            { name: 'src', path: '/home/liuzl/project/src' },
            { name: 'components', path: '/home/liuzl/project/src/components' }
        ])
    })
})
