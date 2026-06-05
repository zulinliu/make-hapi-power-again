import * as React from 'react'

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

export function SubPageLayout({
  tabs,
  activeTab,
  onTabChange,
  toolbar,
  children,
}: SubPageLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar && (
        <div className="shrink-0 overflow-x-auto"
          style={{
            borderBottom: '1px solid var(--app-border)',
            background: 'var(--app-bg)',
            padding: 'var(--hp-space-2) var(--hp-space-3)',
          }}
        >
          <div className="mx-auto w-full max-w-content">
            {toolbar}
          </div>
        </div>
      )}

      {tabs && tabs.length > 0 && (
        <div
          className="flex shrink-0"
          style={{
            borderBottom: '1px solid var(--app-border)',
            background: 'var(--app-bg)',
          }}
          role="tablist"
        >
          <div className="mx-auto w-full max-w-content">
            <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onTabChange?.(tab.id)}
                    className="relative flex-1 text-center text-sm font-semibold transition-colors whitespace-nowrap"
                    style={{ paddingTop: 'var(--hp-space-3)', paddingBottom: 'var(--hp-space-3)' }}
                  >
                    <span
                      style={{
                        color: isActive ? 'var(--app-fg)' : 'var(--app-hint)',
                      }}
                    >
                      {tab.label}
                    </span>
                    <span
                      className="absolute bottom-0 left-[10%] w-4/5 transition-colors"
                      style={{
                        height: 2,
                        borderRadius: 'var(--hp-radius-full)',
                        background: isActive ? 'var(--hp-primary)' : 'transparent',
                        transitionDuration: 'var(--hp-duration-fast)',
                      }}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div
        className="flex-1 min-h-0 overflow-y-auto app-scroll-y"
        role="tabpanel"
      >
        <div className="mx-auto w-full max-w-content">
          {children}
        </div>
      </div>
    </div>
  )
}
