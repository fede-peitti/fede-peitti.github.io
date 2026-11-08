import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUBLIC = join(ROOT, 'public');
const PORTRAIT = join(ROOT, 'src/assets/profile/portrait.jpg');

const C = {
  bg: '#fafaf8',
  ink: '#141414',
  accent: '#2e6e5e',
  muted: '#5d5d5d',
  white: '#fafaf8',
};
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

await sharp(PORTRAIT)
  .resize(800, 800, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(join(PUBLIC, 'headshot.jpg'));

const W = 1200;
const H = 630;
const D = 380;
const px = W - D - 96; 
const py = (H - D) / 2; 
const cxc = px + D / 2;
const cyc = py + D / 2;

const circleMask = Buffer.from(
  `<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#fff"/></svg>`
);
const portraitCircle = await sharp(PORTRAIT)
  .resize(D, D, { fit: 'cover', position: 'attention' })
  .composite([{ input: circleMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="14" height="${H}" fill="${C.accent}"/>
  <circle cx="${cxc}" cy="${cyc}" r="${D / 2 + 13}" fill="none" stroke="${C.accent}" stroke-width="3" opacity="0.55"/>
  <g font-family="${FONT}">
    <text x="90" y="308" font-size="76" font-weight="700" fill="${C.ink}">Federico Peitti</text>
    <text x="92" y="536" font-size="28" font-weight="700" fill="${C.accent}">pipo.github.io</text>
  </g>
</svg>`);


await sharp({ create: { width: W, height: H, channels: 4, background: C.bg } })
  .composite([
    { input: portraitCircle, left: px, top: py },
    { input: overlay, left: 0, top: 0 },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(join(PUBLIC, 'og.jpg'));

const iconSvg = (s) => {
  const r = Math.round(s * 0.19);
  const fs = Math.round(s * 0.62);
  return Buffer.from(
    `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${s}" height="${s}" rx="${r}" fill="${C.accent}"/>` +
      `<text x="50%" y="51%" dominant-baseline="central" text-anchor="middle" ` +
      `font-family="${FONT}" font-size="${fs}" font-weight="700" fill="${C.white}">K</text></svg>`
  );
};
for (const s of [16, 32]) {
  await sharp(iconSvg(s))
    .png()
    .toFile(join(PUBLIC, `favicon-${s}.png`));
}
await sharp(iconSvg(180))
  .flatten({ background: C.accent })
  .png()
  .toFile(join(PUBLIC, 'apple-touch-icon.png'));

const mask512 = Buffer.from(
  `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="512" height="512" fill="${C.accent}"/>` +
    `<text x="50%" y="52%" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="${FONT}" font-size="300" font-weight="700" fill="${C.white}">F</text></svg>`
);
await sharp(mask512).png().toFile(join(PUBLIC, 'icon-512.png'));

const manifest = {
  name: 'Federico Peitti',
  short_name: 'Fede',
  description:
    'description placeholder',
  start_url: '/',
  display: 'minimal-ui',
  background_color: C.bg,
  theme_color: C.bg,
  icons: [
    { src: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
writeFileSync(join(PUBLIC, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

console.log(
  'Generated: og.jpg, headshot.jpg, favicon-16/32.png, apple-touch-icon.png, icon-512.png, site.webmanifest'
);
