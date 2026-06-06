import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.env.VITE_BASE_URL || '/'
const hubTarget = process.env.VITE_HUB_PROXY || 'http://127.0.0.1:3016'
const appVersion = readAppVersion()

function readAppVersion(): string {
    const buildInfoPath = resolve(__dirname, '../shared/src/buildInfo.ts')
    const buildInfo = readFileSync(buildInfoPath, 'utf8')
    const match = buildInfo.match(/export const APP_VERSION = ['"]([^'"]+)['"]/)

    if (!match) {
        throw new Error(`Could not read APP_VERSION from ${buildInfoPath}`)
    }

    return match[1]
}

function getVendorChunkName(id: string): string | undefined {
    if (!id.includes('/node_modules/')) {
        return undefined
    }

    if (id.includes('/node_modules/@xterm/')) {
        return 'vendor-terminal'
    }

    if (id.includes('/node_modules/monaco-editor/')) {
        return 'vendor-monaco'
    }

    if (id.includes('/node_modules/mermaid/')) {
        return 'vendor-mermaid'
    }

    if (
        id.includes('/node_modules/@assistant-ui/')
        || id.includes('/node_modules/remark-gfm/')
        || id.includes('/node_modules/hast-util-to-jsx-runtime/')
    ) {
        return 'vendor-assistant'
    }

    return undefined
}

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
        host: true,
        allowedHosts: ['test.liuzl.asia'],
        proxy: {
            '/api': {
                target: hubTarget,
                changeOrigin: true
            },
            '/socket.io': {
                target: hubTarget,
                ws: true
            }
        }
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: [
                'favicon.ico',
                'apple-touch-icon-120x120.png',
                'apple-touch-icon-152x152.png',
                'apple-touch-icon-167x167.png',
                'apple-touch-icon-180x180.png',
                'mask-icon.svg',
            ],
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            manifest: {
                name: 'Hapi Power',
                short_name: 'Hapi Power',
                description: '随时AI，编程自在 — AI编程工作台',
                categories: ['developer tools', 'productivity'],
                theme_color: '#F97316',
                background_color: '#FFF8F3',
                display: 'standalone',
                orientation: 'portrait',
                scope: base,
                start_url: base,
                icons: [
                    {
                        src: 'pwa-64x64.png',
                        sizes: '64x64',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-maskable-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-maskable-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                shortcuts: [
                    {
                        name: 'Sessions',
                        short_name: 'Sessions',
                        url: `${base}sessions`,
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
                    },
                ],
                share_target: {
                    action: `${base}sessions/new`,
                    method: 'POST',
                    enctype: 'multipart/form-data',
                    params: {
                        title: 'title',
                        text: 'text',
                        url: 'url',
                        files: [
                            {
                                name: 'files',
                                accept: ['text/*', 'image/*'],
                            },
                        ],
                    },
                },
            },
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}', 'offline.html'],
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            },
            devOptions: {
                enabled: true,
                type: 'module'
            }
        })
    ],
    base,
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    return getVendorChunkName(id)
                }
            }
        }
    }
})
