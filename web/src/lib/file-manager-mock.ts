import type { DirectoryListing, FileEntry } from '@/components/FileManager/types'

type VirtualFS = Map<string, FileEntry[]>

const ROOT = '/home/user/project'

function d(name: string, size: number, modified: string, extra?: Partial<FileEntry>): FileEntry {
  return {
    name,
    path: '',
    type: 'file',
    size,
    modified,
    isHidden: name.startsWith('.'),
    ...extra,
  }
}

function dir(name: string, modified: string, extra?: Partial<FileEntry>): FileEntry {
  return {
    name,
    path: '',
    type: 'directory',
    size: 0,
    modified,
    isHidden: name.startsWith('.'),
    ...extra,
  }
}

function buildFS(): VirtualFS {
  const fs: VirtualFS = new Map()

  const T = '2025-06-01T10:30:00Z'
  const T2 = '2025-05-28T14:22:00Z'
  const T3 = '2025-06-03T09:15:00Z'
  const T4 = '2025-04-15T08:00:00Z'
  const T5 = '2025-05-20T16:45:00Z'
  const T6 = '2025-06-05T11:00:00Z'

  // Root
  fs.set(ROOT, [
    dir('src', T3),
    dir('public', T5),
    dir('docs', T4),
    dir('.github', T4, { isHidden: true }),
    d('package.json', 1842, T6),
    d('package-lock.json', 284_930, T6),
    d('tsconfig.json', 612, T2),
    d('tsconfig.app.json', 284, T2),
    d('tsconfig.node.json', 198, T2),
    d('vite.config.ts', 1024, T3),
    d('tailwind.config.ts', 876, T3),
    d('postcss.config.js', 142, T2),
    d('.eslintrc.cjs', 428, T4, { isHidden: true }),
    d('.prettierrc', 112, T4, { isHidden: true }),
    d('.gitignore', 384, T4, { isHidden: true }),
    d('.env.local', 96, T5, { isHidden: true }),
    d('.env.example', 64, T4, { isHidden: true }),
    d('README.md', 4820, T6),
    d('LICENSE', 1070, T4),
  ])

  // src/
  fs.set(`${ROOT}/src`, [
    dir('components', T3),
    dir('hooks', T5),
    dir('lib', T3),
    dir('pages', T3),
    dir('styles', T4),
    dir('types', T2),
    d('App.tsx', 3200, T6),
    d('main.tsx', 480, T3),
    d('router.ts', 1856, T3),
    d('vite-env.d.ts', 38, T2),
  ])

  // src/components/
  fs.set(`${ROOT}/src/components`, [
    dir('FileManager', T6),
    dir('ui', T5),
    dir('SessionList', T3),
    dir('ChatInput', T3),
    d('Header.tsx', 2048, T5),
    d('Sidebar.tsx', 3840, T3),
    d('FileIcon.tsx', 1560, T6),
  ])

  // src/components/FileManager/
  fs.set(`${ROOT}/src/components/FileManager`, [
    d('types.ts', 920, T6),
    d('FileManager.tsx', 6400, T6),
    d('FileTable.tsx', 4200, T6),
    d('Breadcrumb.tsx', 1280, T5),
    d('FileToolbar.tsx', 2400, T5),
    d('useFileNavigation.ts', 1800, T5),
  ])

  // src/hooks/
  fs.set(`${ROOT}/src/hooks`, [
    d('useAuth.ts', 1280, T5),
    d('useDebounce.ts', 640, T2),
    d('useMediaQuery.ts', 480, T4),
    d('useLocalStorage.ts', 720, T4),
  ])

  // src/lib/
  fs.set(`${ROOT}/src/lib`, [
    d('api.ts', 3200, T3),
    d('utils.ts', 860, T3),
    d('query-client.ts', 420, T2),
    d('file-manager-mock.ts', 4800, T6),
  ])

  // src/pages/
  fs.set(`${ROOT}/src/pages`, [
    d('Dashboard.tsx', 2800, T3),
    d('FileManagerPage.tsx', 1600, T6),
    d('Settings.tsx', 3200, T5),
    d('Login.tsx', 1400, T4),
  ])

  // src/styles/
  fs.set(`${ROOT}/src/styles`, [
    d('globals.css', 2400, T4),
    d('animations.css', 860, T3),
  ])

  // src/types/
  fs.set(`${ROOT}/src/types`, [
    d('index.ts', 1200, T3),
    d('api.ts', 2400, T5),
  ])

  // public/
  fs.set(`${ROOT}/public`, [
    dir('icons', T4),
    dir('images', T5),
    d('favicon.ico', 4286, T4),
    d('robots.txt', 62, T4),
    d('manifest.json', 320, T4),
  ])

  // public/icons/
  fs.set(`${ROOT}/public/icons`, [
    d('icon-192.png', 12840, T4),
    d('icon-512.png', 24680, T4),
    d('apple-touch-icon.png', 8420, T4),
  ])

  // public/images/
  fs.set(`${ROOT}/public/images`, [
    d('logo.svg', 3200, T5),
    d('hero-banner.webp', 48_200, T5),
    d('og-image.png', 92_400, T4),
  ])

  // docs/
  fs.set(`${ROOT}/docs`, [
    d('ARCHITECTURE.md', 8400, T4),
    d('CONTRIBUTING.md', 3200, T4),
    d('API.md', 12_600, T5),
    d('CHANGELOG.md', 6800, T6),
    d('DEPLOYMENT.md', 4400, T4),
  ])

  // .github/
  fs.set(`${ROOT}/.github`, [
    dir('workflows', T4, { isHidden: true }),
    d('CODEOWNERS', 180, T4, { isHidden: true }),
    d('PULL_REQUEST_TEMPLATE.md', 640, T4, { isHidden: true }),
  ])

  // .github/workflows/
  fs.set(`${ROOT}/.github/workflows`, [
    d('ci.yml', 2400, T4, { isHidden: true }),
    d('deploy.yml', 1800, T4, { isHidden: true }),
    d('release.yml', 1200, T4, { isHidden: true }),
  ])

  return fs
}

const fs = buildFS()

function resolvePath(inputPath: string): string {
  const parts = inputPath.split('/').filter(Boolean)
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') {
      resolved.pop()
    } else if (part !== '.') {
      resolved.push(part)
    }
  }
  return '/' + resolved.join('/')
}

function parentPath(path: string): string | null {
  const normalized = resolvePath(path)
  if (normalized === ROOT) return null
  const idx = normalized.lastIndexOf('/')
  return idx <= 0 ? null : normalized.slice(0, idx)
}

function hasGitDirectory(dirPath: string): boolean {
  const entries = fs.get(dirPath)
  if (!entries) return false
  const subDirs = entries.filter((e) => e.type === 'directory')
  for (const d of subDirs) {
    const childPath = `${dirPath}/${d.name}`
    if (d.name === '.git') return true
    if (hasGitDirectory(childPath)) return true
  }
  return false
}

export async function mockListDirectory(
  path: string,
  showHidden: boolean = false,
): Promise<DirectoryListing> {
  const delay = 100 + Math.floor(Math.random() * 200)
  await new Promise((r) => setTimeout(r, delay))

  const normalized = resolvePath(path)

  const entries = fs.get(normalized)
  if (!entries) {
    throw new Error(`Directory not found: ${normalized}`)
  }

  const filtered = showHidden ? entries : entries.filter((e) => !e.isHidden)
  const sorted = [...filtered].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const annotated = sorted.map((entry) => ({
    ...entry,
    path: `${normalized}/${entry.name}`,
    isGitRepo:
      entry.type === 'directory' ? hasGitDirectory(`${normalized}/${entry.name}`) : undefined,
    isHidden: entry.name.startsWith('.'),
  }))

  return {
    path: normalized,
    entries: annotated,
    parentPath: parentPath(normalized),
  }
}
