// Generate PNG assets from SVG using Playwright
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'docs', 'assets');

const sizes = {
  'logo-mark': [
    { suffix: '-512', width: 512, height: 512 },
    { suffix: '-192', width: 192, height: 192 },
  ],
  'logo-lockup': [
    { suffix: '', width: 800, height: 200 },
  ],
  'favicon': [
    { suffix: '-32', width: 32, height: 32 },
    { suffix: '-16', width: 16, height: 16 },
  ],
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const [baseName, variants] of Object.entries(sizes)) {
    const svgPath = path.join(assetsDir, `${baseName}.svg`);
    if (!fs.existsSync(svgPath)) {
      console.log(`Skip ${baseName}: SVG not found`);
      continue;
    }
    const svgData = fs.readFileSync(svgPath);

    for (const variant of variants) {
      await page.setViewportSize({ width: variant.width * 2, height: variant.height * 2 });
      await page.setContent(`
        <html><body style="margin:0;padding:0;background:#0A0A0B;">
          <img src="data:image/svg+xml;base64,${svgData.toString('base64')}"
               width="${variant.width * 2}" height="${variant.height * 2}" />
        </body></html>
      `);
      const pngPath = path.join(assetsDir, `${baseName}${variant.suffix}.png`);
      await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: variant.width * 2, height: variant.height * 2 } });
      console.log(`Generated ${pngPath}`);
    }
  }

  // Generate favicon.ico (use 32px PNG as favicon)
  const favicon32 = path.join(assetsDir, 'favicon-32.png');
  if (fs.existsSync(favicon32)) {
    // Simple copy as .ico - browsers accept PNG-format .ico
    const icoPath = path.join(__dirname, '..', 'web', 'public', 'favicon.ico');
    fs.mkdirSync(path.dirname(icoPath), { recursive: true });
    fs.copyFileSync(favicon32, icoPath);
    console.log(`Copied favicon.ico`);
  }

  await browser.close();
  console.log('Done!');
})();
