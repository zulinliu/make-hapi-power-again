import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SVG_PATH = resolve(ROOT, 'web/public/icon.svg');
const OUT_DIR = resolve(ROOT, 'web/public');

const svgContent = readFileSync(SVG_PATH, 'utf-8');

const CHROME_PATH = '/usr/bin/google-chrome';

// All PNG assets to generate
const tasks = [
  // PWA icons
  { name: 'pwa-64x64.png', width: 64, height: 64, bg: '#1C1611', padding: 0.05 },
  { name: 'pwa-192x192.png', width: 192, height: 192, bg: '#1C1611', padding: 0.05 },
  { name: 'pwa-512x512.png', width: 512, height: 512, bg: '#1C1611', padding: 0.05 },
  // PWA maskable icons (more padding for safe zone)
  { name: 'pwa-maskable-192x192.png', width: 192, height: 192, bg: '#1C1611', padding: 0.25 },
  { name: 'pwa-maskable-512x512.png', width: 512, height: 512, bg: '#1C1611', padding: 0.25 },
  // Apple touch icons
  { name: 'apple-touch-icon-120x120.png', width: 120, height: 120, bg: '#1C1611', padding: 0.08 },
  { name: 'apple-touch-icon-152x152.png', width: 152, height: 152, bg: '#1C1611', padding: 0.08 },
  { name: 'apple-touch-icon-167x167.png', width: 167, height: 167, bg: '#1C1611', padding: 0.08 },
  { name: 'apple-touch-icon-180x180.png', width: 180, height: 180, bg: '#1C1611', padding: 0.08 },
  // Splash screens
  { name: 'splash-light-750x1334.png', width: 750, height: 1334, bg: '#FAFAFA', iconSize: 200 },
  { name: 'splash-dark-750x1334.png', width: 750, height: 1334, bg: '#1C1611', iconSize: 200 },
  { name: 'splash-light-1125x2436.png', width: 1125, height: 2436, bg: '#FAFAFA', iconSize: 280 },
  { name: 'splash-dark-1125x2436.png', width: 1125, height: 2436, bg: '#1C1611', iconSize: 280 },
  { name: 'splash-light-1170x2532.png', width: 1170, height: 2532, bg: '#FAFAFA', iconSize: 280 },
  { name: 'splash-dark-1170x2532.png', width: 1170, height: 2532, bg: '#1C1611', iconSize: 280 },
  { name: 'splash-light-1179x2556.png', width: 1179, height: 2556, bg: '#FAFAFA', iconSize: 280 },
  { name: 'splash-dark-1179x2556.png', width: 1179, height: 2556, bg: '#1C1611', iconSize: 280 },
  { name: 'splash-light-1284x2778.png', width: 1284, height: 2778, bg: '#FAFAFA', iconSize: 320 },
  { name: 'splash-dark-1284x2778.png', width: 1284, height: 2778, bg: '#1C1611', iconSize: 320 },
  { name: 'splash-light-1290x2796.png', width: 1290, height: 2796, bg: '#FAFAFA', iconSize: 320 },
  { name: 'splash-dark-1290x2796.png', width: 1290, height: 2796, bg: '#1C1611', iconSize: 320 },
];

function buildIconHTML(task) {
  const isSplash = task.iconSize !== undefined;
  if (isSplash) {
    // Splash: centered logo on background
    return `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${task.width}px; height: ${task.height}px; background: ${task.bg}; display: flex; align-items: center; justify-content: center; }
  .logo { width: ${task.iconSize}px; height: ${task.iconSize}px; }
</style></head><body>
  <div class="logo">${svgContent}</div>
</body></html>`;
  }
  // Icon: SVG fills most of the canvas with padding
  const padPct = (task.padding || 0) * 100;
  const svgSize = 100 - padPct * 2;
  return `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${task.width}px; height: ${task.height}px; background: ${task.bg}; display: flex; align-items: center; justify-content: center; }
  .icon { width: ${svgSize}%; height: ${svgSize}%; }
  .icon svg { width: 100%; height: 100%; }
</style></head><body>
  <div class="icon">${svgContent}</div>
</body></html>`;
}

async function main() {
  console.log('Launching Chrome...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  let done = 0;
  for (const task of tasks) {
    const html = buildIconHTML(task);
    const page = await browser.newPage({ viewport: { width: task.width, height: task.height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const outPath = resolve(OUT_DIR, task.name);
    await page.screenshot({ path: outPath, type: 'png' });
    await page.close();
    done++;
    console.log(`[${done}/${tasks.length}] ${task.name}`);
  }

  await browser.close();
  console.log(`\nDone. Generated ${done} PNG files.`);
}

main().catch(e => { console.error(e); process.exit(1); });
