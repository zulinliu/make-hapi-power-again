import * as React from 'react'
import { PageScaffold, type PageTab } from '@/components/layout/PageScaffold'

export interface SubPageTab {
    id: string
    label: string
}

export interface SubPageLayoutProps {
    tabs?: SubPageTab[]
    activeTab?: string
    onTabChange?: (tabId: string) => void
    toolbar?: React.ReactNode
    children: React.ReactNode
}

/**
 * SubPageLayout — tabbed sub-page layout.
 *
 * Internally delegates to PageScaffold for:
 * - Consistent header/toolbar/tabs/content/footer structure
 * - Safe-area insets
 * - Touch-friendly tab targets
 *
 * This is the preferred layout for session-scoped sub-pages
 * (Extensions, Loom, etc.) that need tabs and toolbar.
 */
export function SubPageLayout({
    tabs,
    activeTab,
    onTabChange,
    toolbar,
    children,
}: SubPageLayoutProps) {
    // Convert SubPageTab[] to PageTab[] for PageScaffold
    const pageTabs: PageTab[] | undefined = tabs?.map((tab) => ({
        id: tab.id,
        label: tab.label,
    }))

    // Build toolbar slot
    const toolbarSlot = toolbar ? (
        <div className="mx-auto w-full max-w-content px-3 py-2">
            {toolbar}
        </div>
    ) : undefined

    return (
        <PageScaffold
            toolbar={toolbarSlot}
            tabs={pageTabs}
            activeTabId={activeTab}
            onTabChange={onTabChange}
        >
            <SubPageContent>{children}</SubPageContent>
        </PageScaffold>
    )
}

function SubPageContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-content">
            {children}
        </div>
    )
}
