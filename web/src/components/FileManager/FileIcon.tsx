import { useMemo } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FileIconProps {
  fileName: string
  size?: number
  className?: string
  isGitRepo?: boolean
  isHidden?: boolean
}

/* ------------------------------------------------------------------ */
/*  Color mapping                                                      */
/* ------------------------------------------------------------------ */

const EXTENSION_COLORS: Record<string, string> = {
  ts: 'oklch(0.60 0.15 250)',
  tsx: 'oklch(0.60 0.15 250)',
  js: 'oklch(0.75 0.16 85)',
  jsx: 'oklch(0.75 0.16 85)',
  mjs: 'oklch(0.75 0.16 85)',
  cjs: 'oklch(0.75 0.16 85)',
  py: 'oklch(0.55 0.15 65)',
  rs: 'oklch(0.60 0.14 20)',
  go: 'oklch(0.65 0.12 190)',
  css: 'oklch(0.65 0.14 300)',
  scss: 'oklch(0.65 0.14 300)',
  less: 'oklch(0.65 0.14 300)',
  html: 'oklch(0.60 0.15 25)',
  htm: 'oklch(0.60 0.15 25)',
  json: 'oklch(0.70 0.10 85)',
  yaml: 'oklch(0.60 0.12 250)',
  yml: 'oklch(0.60 0.12 250)',
  toml: 'oklch(0.55 0.12 160)',
  xml: 'oklch(0.65 0.14 30)',
  md: 'var(--hp-text-secondary)',
  mdx: 'var(--hp-text-secondary)',
  txt: 'var(--hp-text-tertiary)',
  pdf: 'oklch(0.60 0.18 22)',
  png: 'oklch(0.55 0.12 160)',
  jpg: 'oklch(0.55 0.12 160)',
  jpeg: 'oklch(0.55 0.12 160)',
  webp: 'oklch(0.55 0.12 160)',
  gif: 'oklch(0.55 0.12 160)',
  svg: 'oklch(0.55 0.12 160)',
  ico: 'oklch(0.55 0.12 160)',
  zip: 'oklch(0.65 0.10 85)',
  tar: 'oklch(0.55 0.12 250)',
  gz: 'oklch(0.55 0.12 250)',
  lock: 'oklch(0.55 0.10 250)',
}

/** Exact filename matches (case-insensitive) */
const EXACT_NAME_COLORS: Record<string, string> = {
  dockerfile: 'oklch(0.55 0.14 55)',
  '.dockerignore': 'oklch(0.55 0.14 55)',
  '.gitignore': 'oklch(0.60 0.14 20)',
  '.gitattributes': 'oklch(0.60 0.14 20)',
  license: 'oklch(0.60 0.10 250)',
  license_mit: 'oklch(0.60 0.10 250)',
  license_apache: 'oklch(0.60 0.10 250)',
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getExtension(fileName: string): string {
  const lower = fileName.trim().toLowerCase()

  // Handle double extensions like .tar.gz, .tar.bz2
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'gz'
  if (lower.endsWith('.tar.bz2')) return 'tar'

  // Dotfiles with no further extension (e.g. .gitignore)
  if (lower.startsWith('.') && lower.indexOf('.', 1) === -1) {
    return ''
  }

  const parts = lower.split('.')
  if (parts.length <= 1) return ''
  return parts[parts.length - 1] ?? ''
}

function getBaseName(fileName: string): string {
  return fileName.trim().toLowerCase()
}

/**
 * Return the color string for a file name.
 *
 * Uses oklch via CSS custom-property or literal oklch() value.
 * This function is exported so callers can reuse the palette.
 */
export function getFileTypeColor(fileName: string): string {
  const base = getBaseName(fileName)

  // Exact-name match first (Dockerfile, .gitignore, LICENSE, .env*)
  if (EXACT_NAME_COLORS[base]) return EXACT_NAME_COLORS[base]

  // .env / .env.local / .env.production etc.
  if (base === '.env' || base.startsWith('.env.')) return 'oklch(0.60 0.12 250)'

  // Extension-based lookup
  const ext = getExtension(fileName)
  if (ext && EXTENSION_COLORS[ext]) return EXTENSION_COLORS[ext]

  return 'var(--hp-text-tertiary)'
}

/**
 * Heuristic: treat a name as a directory if it has no extension AND
 * does not look like a known extension-less file (Dockerfile, LICENSE,
 * Makefile, .gitignore, .env, etc).
 */
const KNOWN_EXTENSIONLESS = new Set([
  'dockerfile',
  'license',
  'license_mit',
  'license_apache',
  'makefile',
  'gemfile',
  'rakefile',
  'vagrantfile',
  'jenkinsfile',
  'brewfile',
  'procfile',
  'podfile',
  'fastfile',
])

function isLikelyDirectory(fileName: string): boolean {
  const base = fileName.trim()
  const lower = base.toLowerCase()

  // Dotfiles like .gitignore, .env — not directories
  if (lower.startsWith('.')) return false

  // Known extension-less filenames
  if (KNOWN_EXTENSIONLESS.has(lower)) return false

  // Has an extension -> file
  if (base.includes('.')) return false

  // No extension and not a known file -> likely directory
  return true
}

/* ------------------------------------------------------------------ */
/*  SVG paths                                                          */
/* ------------------------------------------------------------------ */

const FOLDER_PATH = 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'

const FILE_BODY = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
const FILE_FOLD = 'M14 2v6h6'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FileIcon({
  fileName,
  size = 22,
  className,
  isGitRepo = false,
  isHidden = false,
}: FileIconProps) {
  const isDir = isLikelyDirectory(fileName)
  const color = useMemo(() => getFileTypeColor(fileName), [fileName])

  // Folders always use the primary palette color (or muted when hidden)
  const resolvedColor = useMemo(() => {
    if (isDir) {
      return isHidden ? 'var(--hp-text-tertiary)' : 'var(--hp-primary)'
    }
    return color
  }, [isDir, isHidden, color])

  const opacity = isDir && isHidden ? 0.6 : 1

  if (isDir) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ color: resolvedColor, opacity }}
        aria-hidden="true"
      >
        <path d={FOLDER_PATH} />
        {isGitRepo && (
          <circle
            cx="19"
            cy="19"
            r="3"
            fill="oklch(0.65 0.16 155)"
            stroke="none"
          />
        )}
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ color: resolvedColor, opacity }}
      aria-hidden="true"
    >
      <path d={FILE_BODY} />
      <path d={FILE_FOLD} />
    </svg>
  )
}
