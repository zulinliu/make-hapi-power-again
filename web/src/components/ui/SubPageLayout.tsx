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
        <div className="border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 shrink-0 overflow-x-auto">
          <div className="mx-auto w-full max-w-content">
            {toolbar}
          </div>
        </div>
      )}

      {tabs && tabs.length > 0 && (
        <div
          className="flex border-b border-[var(--app-border)] bg-[var(--app-bg)] shrink-0"
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
                    className="relative flex-1 py-3 text-center text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <span
                      className={
                        isActive
                          ? 'text-[var(--app-fg)]'
                          : 'text-[var(--app-hint)]'
                      }
                    >
                      {tab.label}
                    </span>
                    <span
                      className={`absolute bottom-0 left-[10%] h-0.5 w-4/5 rounded-full transition-colors duration-150 ${
                        isActive
                          ? 'bg-[var(--app-link)]'
                          : 'bg-transparent'
                      }`}
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
