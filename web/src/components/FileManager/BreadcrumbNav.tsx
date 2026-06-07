import { useRef, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/use-translation'
import type { BreadcrumbSegment } from './types'

export interface BreadcrumbNavProps {
  segments: BreadcrumbSegment[]
  onNavigate: (path: string) => void
  onCopyPath?: (path: string) => void
}

export function BreadcrumbNav({ segments, onNavigate, onCopyPath }: BreadcrumbNavProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [segments, scrollToBottom])

  if (segments.length === 0) return null

  const displaySegments = segments.length > 4
    ? [segments[0], { name: '…', path: segments[Math.max(0, segments.length - 3)].path }, ...segments.slice(-2)]
    : segments

  return (
    <nav
      aria-label={t('fm.breadcrumb.label')}
      className="fm-breadcrumb"
      style={{
        minHeight: 44,
        background: 'var(--hp-surface-1)',
        borderBottom: '1px solid var(--hp-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 var(--hp-space-3)',
      }}
    >
      <div
        ref={scrollRef}
        role="list"
        aria-label={segments.map((segment) => segment.name).join('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: 1,
        }}
      >
        {displaySegments.map((segment, index) => {
          const isLast = index === displaySegments.length - 1
          const isEllipsis = segment.name === '…'

          return (
            <span
              key={`${segment.path}-${index}`}
              role="listitem"
              style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, scrollSnapAlign: isLast ? 'end' : undefined }}
            >
              {index > 0 && (
                <span style={{ color: 'var(--hp-text-tertiary)', fontSize: 11, flexShrink: 0 }} aria-hidden="true">/</span>
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  title={segment.name}
                  style={{
                    color: 'var(--hp-primary)',
                    fontWeight: 650,
                    fontSize: 13,
                    maxWidth: 'min(42vw, 280px)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flexShrink: 1,
                  }}
                >
                  {segment.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(segment.path)}
                  aria-label={isEllipsis ? t('fm.breadcrumb.jumpParents') : t('fm.breadcrumb.open', { name: segment.name })}
                  title={isEllipsis ? segment.path : segment.name}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    maxWidth: isEllipsis ? 44 : 'min(34vw, 180px)',
                    background: isEllipsis ? 'var(--hp-surface-2)' : 'transparent',
                    border: isEllipsis ? '1px solid var(--hp-border)' : '1px solid transparent',
                    borderRadius: 'var(--hp-radius-sm)',
                    padding: isEllipsis ? '0 10px' : '0 8px',
                    color: 'var(--hp-text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hp-surface-2)'; e.currentTarget.style.color = 'var(--hp-text-primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isEllipsis ? 'var(--hp-surface-2)' : 'transparent'; e.currentTarget.style.color = 'var(--hp-text-secondary)' }}
                >
                  {segment.name}
                </button>
              )}
            </span>
          )
        })}
      </div>

      {onCopyPath && (
        <button
          type="button"
          onClick={() => onCopyPath(segments[segments.length - 1]?.path ?? '')}
          aria-label={t('fm.breadcrumb.copyCurrentPath')}
          title={t('fm.breadcrumb.copyCurrentPath')}
          style={{
            minWidth: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0 10px',
            borderRadius: 'var(--hp-radius-md)',
            border: '1px solid var(--hp-border)',
            background: 'var(--hp-surface-0)',
            color: 'var(--hp-text-secondary)',
            fontSize: 12,
            fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{t('fm.breadcrumb.copyPathAction')}</span>
        </button>
      )}
    </nav>
  )
}

export function buildBreadcrumbs(path: string, rootLabel: string, rootDisplayLabel = 'Project root'): BreadcrumbSegment[] {
  const normalized = path.replace(/\\/g, '/')
  const clean = normalized.replace(/\/+$/, '')

  const rootPattern = new RegExp(`(^|/)${rootLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`)
  const rootMatch = clean.match(rootPattern)

  if (!rootMatch || rootMatch.index === undefined) {
    return [{ name: '~', path: clean || '/' }]
  }

  const rootEnd = rootMatch.index + rootMatch[0].length
  const rootPath = clean.slice(0, rootMatch.index + rootMatch[0].length).replace(/\/$/, '')
  const afterRoot = clean.slice(rootEnd)

  if (!afterRoot) {
    return [{ name: rootDisplayLabel, path: rootPath }]
  }

  const parts = afterRoot.split('/').filter(Boolean)
  const segments: BreadcrumbSegment[] = [{ name: rootDisplayLabel, path: rootPath }]

  let currentPath = rootPath
  for (const part of parts) {
    currentPath = `${currentPath}/${part}`
    segments.push({ name: part, path: currentPath })
  }

  return segments
}
