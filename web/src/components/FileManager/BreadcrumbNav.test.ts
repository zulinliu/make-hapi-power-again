import { describe, expect, it } from 'vitest'
import { buildBreadcrumbs } from './BreadcrumbNav'

describe('buildBreadcrumbs', () => {
    it('shows the actual absolute path when the configured root label is not in the path', () => {
        expect(buildBreadcrumbs('/home/tester/project/temp_test', 'workspace')).toEqual([
            { name: '/home/tester/project/temp_test', path: '/home/tester/project/temp_test' }
        ])
    })

    it('keeps project-root breadcrumbs when the root label is present', () => {
        expect(buildBreadcrumbs('/home/tester/project/src/components', 'project', 'Project root')).toEqual([
            { name: 'Project root', path: '/home/tester/project' },
            { name: 'src', path: '/home/tester/project/src' },
            { name: 'components', path: '/home/tester/project/src/components' }
        ])
    })
})
