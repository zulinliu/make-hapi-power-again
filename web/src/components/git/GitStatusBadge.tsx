export function GitStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'M': 'var(--hp-warning)',
    'A': 'var(--hp-success)',
    'D': 'var(--hp-danger)',
    'R': 'var(--hp-info)',
    '?': 'var(--hp-text-tertiary)',
  }
  const bgMap: Record<string, string> = {
    'M': 'var(--hp-warning-subtle)',
    'A': 'var(--hp-success-subtle)',
    'D': 'var(--hp-danger-subtle)',
    'R': 'var(--hp-info-subtle)',
    '?': 'var(--hp-surface-1)',
  }

  const color = colorMap[status] || 'var(--hp-text-tertiary)'
  const bg = bgMap[status] || 'var(--hp-surface-1)'

  return (
    <span
      className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-[var(--hp-radius-xs)]"
      style={{ color, background: bg }}
    >
      {status}
    </span>
  )
}
