import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import path from 'path';

const chromium = execSync('which chromium').toString().trim();
const browser = await puppeteer.launch({
  executablePath: chromium,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 1398, deviceScaleFactor: 2 });
await page.goto('file://' + path.resolve('store-previews/slides.html'), { waitUntil: 'networkidle0' });
await page.evaluateHandle('document.fonts.ready');
await new Promise(r => setTimeout(r, 500));

const names = ['1-real-profit-tracking','2-log-in-seconds','3-see-what-you-make','4-best-days','5-ai-suggestions','6-track-expenses','7-home-screen-widget','8-free-trial'];
for (let i = 0; i < names.length; i++) {
  const el = await page.$(`#s${i + 1}`);
  await el.screenshot({ path: `store-previews/out/${names[i]}.png` });
  console.log('saved', names[i]);
}
await browser.close();
