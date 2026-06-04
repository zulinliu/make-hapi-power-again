// Screenshot generator for README
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '..', 'docs', 'assets');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });

  // Desktop screenshot (1440x900)
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await desktop.waitForTimeout(3000);
  await desktop.screenshot({ path: path.join(assetsDir, 'screenshot-desktop.png'), fullPage: false });
  console.log('Desktop screenshot saved');
  await desktop.close();

  // Mobile screenshot (390x844 iPhone 14)
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  await mobile.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await mobile.waitForTimeout(3000);
  await mobile.screenshot({ path: path.join(assetsDir, 'screenshot-mobile.png'), fullPage: false });
  console.log('Mobile screenshot saved');
  await mobile.close();

  await browser.close();
  console.log('All screenshots done!');
})();
