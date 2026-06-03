export function GitStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'M': 'var(--app-warning)',
    'A': 'var(--app-success)',
    'D': 'var(--app-danger)',
    'R': 'var(--app-link)',
    '?': 'var(--app-hint)',
  }
  const bgMap: Record<string, string> = {
    'M': 'var(--app-warning-subtle)',
    'A': 'var(--app-success-subtle)',
    'D': 'var(--app-badge-error-bg)',
    'R': 'var(--app-primary-subtle)',
    '?': 'var(--app-subtle-bg)',
  }

  const color = colorMap[status] || 'var(--app-hint)'
  const bg = bgMap[status] || 'var(--app-subtle-bg)'

  return (
    <span
      className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
      style={{ color, background: bg }}
    >
      {status}
    </span>
  )
}
