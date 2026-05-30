import { useLocation, useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'

interface SidebarItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: string
}

const NAV_ITEMS: SidebarItem[] = [
  { id: 'sessions', label: 'Sessions', icon: '💬', path: '/sessions' },
  { id: 'git', label: 'Git', icon: '🔀', path: '/sessions' },
  { id: 'files', label: 'Files', icon: '📁', path: '/sessions' },
  { id: 'terminal', label: 'Terminal', icon: '⌨', path: '/sessions' },
  { id: 'extensions', label: 'Extensions', icon: '🧩', path: '/sessions' },
  { id: 'browse', label: 'Browse', icon: '🌐', path: '/browse' },
  { id: 'settings', label: 'Settings', icon: '⚙', path: '/settings' },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { api } = useAppContext()

  if (!api) return null

  const activeId = getActiveSection(location.pathname)

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        width: collapsed ? 'var(--hp-sidebar-collapsed-width)' : 'var(--hp-sidebar-width)',
        background: 'var(--hp-surface-0)',
        borderColor: 'var(--hp-border)',
        transition: 'width var(--hp-duration-normal) var(--hp-ease-default)',
      }}
    >
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-2 px-3 h-12 border-b shrink-0"
        style={{ borderColor: 'var(--hp-border)' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--hp-primary)', color: 'var(--hp-primary-text)' }}
        >
          H
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm" style={{ color: 'var(--hp-text-primary)' }}>
            Hapi Power
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id
          return (
            <button
              key={item.id}
              onClick={() => navigate({ to: item.path as '/sessions' | '/browse' | '/settings' })}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors"
              style={{
                background: isActive ? 'var(--hp-primary-subtle)' : 'transparent',
                color: isActive ? 'var(--hp-primary)' : 'var(--hp-text-secondary)',
                fontWeight: isActive ? 500 : 400,
              }}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge && (
                <span
                  className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--hp-primary-subtle)', color: 'var(--hp-primary)' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Toggle */}
      {onToggle && (
        <div
          className="flex items-center justify-center h-10 border-t shrink-0"
          style={{ borderColor: 'var(--hp-border)' }}
        >
          <button
            onClick={onToggle}
            className="text-xs px-3 py-1 rounded"
            style={{ color: 'var(--hp-text-tertiary)' }}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
      )}
    </aside>
  )
}

function getActiveSection(pathname: string): string {
  if (pathname.startsWith('/browse')) return 'browse'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.includes('/files') || pathname.includes('/file')) return 'files'
  if (pathname.includes('/terminal')) return 'terminal'
  return 'sessions'
}
