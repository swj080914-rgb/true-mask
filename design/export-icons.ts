// 마스코트 SVG(app/src/mascotArt.ts)로 앱 아이콘·스플래시 PNG를 만든다.
// 실행: node --experimental-strip-types design/export-icons.ts   (저장소 루트에서, playwright 필요)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_VIEWBOX, SPLASH_VIEWBOX, mascotSvg } from '../app/src/mascotArt.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'app', 'assets');
const preview = join(root, 'design', 'mascot');
mkdirSync(preview, { recursive: true });

const ICON_BG = '#7C4DFF';
// 안드로이드 적응형 아이콘은 가운데 약 66%만 확실히 보이므로 가면을 작게 둔다
const ANDROID_VIEWBOX = '-60 -84 360 360';

const jobs: { file: string; size: number; svg: string }[] = [
  { file: join(assets, 'icon.png'), size: 1024, svg: mascotSvg({ bg: ICON_BG, viewBox: ICON_VIEWBOX }) },
  { file: join(assets, 'favicon.png'), size: 48, svg: mascotSvg({ bg: ICON_BG, viewBox: ICON_VIEWBOX }) },
  { file: join(assets, 'android-icon-foreground.png'), size: 1024, svg: mascotSvg({ viewBox: ANDROID_VIEWBOX }) },
  { file: join(assets, 'android-icon-background.png'), size: 1024, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${ICON_BG}"/></svg>` },
  { file: join(assets, 'android-icon-monochrome.png'), size: 1024, svg: mascotSvg({ viewBox: ANDROID_VIEWBOX, monochrome: true }) },
  { file: join(assets, 'splash-icon.png'), size: 1024, svg: mascotSvg({ viewBox: SPLASH_VIEWBOX }) },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  const svg = j.svg.replace('<svg ', `<svg width="${j.size}" height="${j.size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: j.file, omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
  console.log('wrote', j.file.replace(root + '/', ''));
}
await browser.close();
