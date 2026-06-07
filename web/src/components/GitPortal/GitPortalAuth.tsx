import { useState } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import type { GitPlatform } from '@/lib/git-portal-storage'

interface GitPortalAuthProps {
  auth: { type: 'password' | 'token' | 'ssh'; username?: string; password?: string } | null
  onAuthChange: (auth: { type: 'password' | 'token'; username?: string; password?: string } | null) => void
  platform: GitPlatform
  show: boolean
}

const HINT_KEYS: Record<GitPlatform, string> = {
  github: 'gitPortal.auth.hint.github',
  gitlab: 'gitPortal.auth.hint.gitlab',
  bitbucket: 'gitPortal.auth.hint.bitbucket',
  other: 'gitPortal.auth.hint.generic',
}

export function GitPortalAuth({ auth, onAuthChange, platform, show }: GitPortalAuthProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'password' | 'token'>(
    auth?.type === 'token' ? 'token' : 'password'
  )

  if (!show) return null

  const hintKey = HINT_KEYS[platform] ?? HINT_KEYS.other

  return (
    <div className="gp-auth">
      <h4 className="text-sm font-medium text-[var(--hp-text)] mb-2">
        {t('gitPortal.auth.privateRepo')}
      </h4>

      <p className="text-xs text-[var(--hp-text-muted)] mb-3">
        {t(hintKey)}
      </p>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          className={cn(
            'gp-auth-tab px-3 py-1 text-xs rounded-md border transition-colors',
            mode === 'password'
              ? 'bg-[var(--hp-primary-subtle)] border-[var(--hp-primary)] text-[var(--hp-primary)]'
              : 'border-[var(--hp-border)] text-[var(--hp-text-muted)] hover:text-[var(--hp-text)]'
          )}
          onClick={() => {
            setMode('password')
            onAuthChange({ type: 'password', username: auth?.username ?? '', password: '' })
          }}
        >
          {t('gitPortal.auth.usePassword')}
        </button>
        <button
          type="button"
          className={cn(
            'gp-auth-tab px-3 py-1 text-xs rounded-md border transition-colors',
            mode === 'token'
              ? 'bg-[var(--hp-primary-subtle)] border-[var(--hp-primary)] text-[var(--hp-primary)]'
              : 'border-[var(--hp-border)] text-[var(--hp-text-muted)] hover:text-[var(--hp-text)]'
          )}
          onClick={() => {
            setMode('token')
            onAuthChange({ type: 'token', password: '' })
          }}
        >
          {t('gitPortal.auth.useToken')}
        </button>
      </div>

      {mode === 'password' ? (
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-[var(--hp-text-muted)] mb-1">
              {t('gitPortal.auth.username')}
            </label>
            <input
              type="text"
              className="gp-input w-full px-3 py-1.5 text-sm rounded-md border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-text)] placeholder:text-[var(--hp-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--hp-primary)]"
              placeholder={t('gitPortal.auth.usernamePlaceholder')}
              value={auth?.username ?? ''}
              onChange={e => onAuthChange({ type: 'password', username: e.target.value, password: auth?.password ?? '' })}
              autoComplete="username"
            />
          </div>
          <div className="relative">
            <label className="block text-xs text-[var(--hp-text-muted)] mb-1">
              {t('gitPortal.auth.password')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="gp-input w-full px-3 py-1.5 pr-9 text-sm rounded-md border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-text)] placeholder:text-[var(--hp-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--hp-primary)]"
              placeholder={t('gitPortal.auth.passwordPlaceholder')}
              value={auth?.password ?? ''}
              onChange={e => onAuthChange({ type: 'password', username: auth?.username ?? '', password: e.target.value })}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-2 top-[26px] text-[var(--hp-text-muted)] hover:text-[var(--hp-text)]"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              aria-label={showPassword ? t('gitPortal.auth.hidePassword') : t('gitPortal.auth.showPassword')}
            >
              {showPassword ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-[var(--hp-text-muted)] mb-1">
            {t('gitPortal.auth.token')}
          </label>
          <input
            type="password"
            className="gp-input w-full px-3 py-1.5 text-sm rounded-md border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-text)] placeholder:text-[var(--hp-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--hp-primary)]"
            placeholder={t('gitPortal.auth.tokenPlaceholder')}
            value={auth?.password ?? ''}
            onChange={e => onAuthChange({ type: 'token', password: e.target.value })}
            autoComplete="off"
          />
        </div>
      )}
    </div>
  )
}
