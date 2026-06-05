const FLAVOR_BADGES: Record<string, { label: string; colors: string }> = {
    claude: {
        label: 'Cl',
        colors: 'bg-[var(--app-flavor-claude)] text-white',
    },
    codex: {
        label: 'Cx',
        colors: 'bg-[var(--app-flavor-codex)] text-white',
    },
    cursor: {
        label: 'Cu',
        colors: 'bg-[var(--app-flavor-cursor)] text-white',
    },
    gemini: {
        label: 'Gm',
        colors: 'bg-[var(--app-flavor-gemini)] text-white',
    },
    kimi: {
        label: 'Km',
        colors: 'bg-[var(--app-flavor-kimi)] text-white',
    },
    opencode: {
        label: 'Op',
        colors: 'bg-[var(--app-flavor-opencode)] text-white',
    },
}

const UNKNOWN_FLAVOR_BADGE = {
    label: 'Un',
    colors: 'bg-[var(--app-secondary-bg)] text-[var(--app-hint)]',
}

export function AgentFlavorIcon({ flavor, className }: { flavor?: string | null; className?: string }) {
    const normalized = (flavor ?? '').trim().toLowerCase()
    const badge = FLAVOR_BADGES[normalized] ?? UNKNOWN_FLAVOR_BADGE

    return (
        <span
            aria-hidden="true"
            className={`inline-flex items-center justify-center rounded-sm text-[8px] font-semibold leading-none ${badge.colors} ${className ?? 'h-4 w-4'}`}
        >
            {badge.label}
        </span>
    )
}
