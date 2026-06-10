#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

const requiredFiles = [
    'DESIGN.md',
    '.impeccable/design.json',
    '.planning/research/2026-06-10-unified-frontend-audit.md',
    '.planning/sketches/001-unified-frontend/index.html',
    'docs/design-system.md',
    'docs/adaptive-ui.md',
    'docs/frontend-architecture.md',
    'web/src/components/layout/AdaptiveContext.tsx',
    'web/src/components/layout/PageScaffold.tsx',
    'web/src/components/layout/WorkbenchShell.tsx',
    'web/src/components/layout/SessionWorkspace.tsx',
    'web/src/components/ui/OverlaySurface.tsx',
]

const prototypeRequirements = [
    'data-module="login"',
    'data-module="new"',
    'data-module="chat"',
    'data-module="files"',
    'data-module="terminal"',
    'data-module="git"',
    'data-module="loom"',
    'data-module="extensions"',
    'data-module="settings"',
    'Unified OverlaySurface',
    'window: compact',
    'window: medium',
    'window: expanded',
    'PWA update',
    'Telegram fallback',
    'Context: 40%',
    'Git Atlas',
    'Session Loom',
    'Model Nexus',
]

const designRequirements = [
    '## 1. Overview',
    '## 2. Colors',
    '## 3. Typography',
    '## 4. Elevation',
    '## 5. Components',
    "## 6. Do's and Don'ts",
    'The Fixed Scale Rule',
    'The Orange Budget Rule',
]

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)))

if (missing.length > 0) {
    console.error(`Missing required files:\n${missing.map((file) => `- ${file}`).join('\n')}`)
    process.exit(1)
}

const prototype = fs.readFileSync(path.join(root, '.planning/sketches/001-unified-frontend/index.html'), 'utf8')
const prototypeMissing = prototypeRequirements.filter((item) => !prototype.includes(item))
if (prototypeMissing.length > 0) {
    console.error(`Prototype missing coverage markers:\n${prototypeMissing.map((item) => `- ${item}`).join('\n')}`)
    process.exit(1)
}

const design = fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf8')
const designMissing = designRequirements.filter((item) => !design.includes(item))
if (designMissing.length > 0) {
    console.error(`DESIGN.md missing required sections:\n${designMissing.map((item) => `- ${item}`).join('\n')}`)
    process.exit(1)
}

const sidecar = JSON.parse(fs.readFileSync(path.join(root, '.impeccable/design.json'), 'utf8'))
if (sidecar.schemaVersion !== 2 || !sidecar.extensions?.adaptive || !sidecar.extensions?.overlayTaxonomy) {
    console.error('Sidecar is missing schemaVersion 2, adaptive metadata, or overlay taxonomy.')
    process.exit(1)
}

console.log('Unified frontend artifact verification passed.')
