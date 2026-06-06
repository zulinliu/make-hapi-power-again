import { useRef, useEffect, useCallback } from 'react'
import type { BreadcrumbSegment } from './types'

export interface BreadcrumbNavProps {
  segments: BreadcrumbSegment[]
  onNavigate: (path: string) => void
}

export function BreadcrumbNav({ segments, onNavigate }: BreadcrumbNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [segments, scrollToBottom])

  if (segments.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" style={{
      height: 40,
      background: 'var(--hp-surface-1)',
      borderBottom: '1px solid var(--hp-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
    }}>
      <div
        ref={scrollRef}
        role="list"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1

          return (
            <span key={segment.path} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 4, scrollSnapAlign: isLast ? 'end' : undefined }}>
              {index > 0 && (
                <span style={{ color: 'var(--hp-text-tertiary)', fontSize: 11, flexShrink: 0 }} aria-hidden="true">/</span>
              )}
              {isLast ? (
                <span aria-current="page" style={{ color: 'var(--hp-primary)', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                  {segment.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(segment.path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--hp-text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--hp-text-primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--hp-text-secondary)' }}
                >
                  {segment.name}
                </button>
              )}
            </span>
          )
        })}
      </div>
    </nav>
  )
}

export function buildBreadcrumbs(path: string, rootLabel: string): BreadcrumbSegment[] {
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
    return [{ name: '~', path: rootPath }]
  }

  const parts = afterRoot.split('/').filter(Boolean)
  const segments: BreadcrumbSegment[] = [{ name: '~', path: rootPath }]

  let currentPath = rootPath
  for (const part of parts) {
    currentPath = `${currentPath}/${part}`
    segments.push({ name: part, path: currentPath })
  }

  return segments
}
