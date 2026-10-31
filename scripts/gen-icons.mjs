// Gera os ícones do Android (adaptativo, legado e redondo) e o ícone da Play Store a partir dos SVGs em assets/.
// Uso: npm run icons (depois de `npx cap add android`).
import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
if (!existsSync(res)) throw new Error('Pasta android/ não existe. Rode `npx cap add android` primeiro.');

const fg = await readFile(path.join(root, 'assets', 'icon-foreground.svg'));
const bg = await readFile(path.join(root, 'assets', 'icon-background.svg'));
const render = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png();

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, mult] of Object.entries(DENSITIES)) {
  const dir = path.join(res, `mipmap-${name}`);
  await mkdir(dir, { recursive: true });
  const launcher = Math.round(48 * mult), layer = Math.round(108 * mult);

  await render(fg, layer).toFile(path.join(dir, 'ic_launcher_foreground.png'));

  // Ícone legado (Android < 8): fundo + primeiro plano, quadrado com cantos arredondados e redondo.
  const flat = await sharp(bg, { density: 384 }).resize(layer, layer)
    .composite([{ input: await render(fg, layer).toBuffer() }]).png().toBuffer();
  const crop = Math.round(layer * 72 / 108), off = Math.round((layer - crop) / 2);
  const face = await sharp(flat).extract({ left: off, top: off, width: crop, height: crop }).resize(launcher, launcher).png().toBuffer();
  const mask = (r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${launcher}" height="${launcher}"><rect width="${launcher}" height="${launcher}" rx="${r}" fill="#fff"/></svg>`);
  await sharp(face).composite([{ input: mask(launcher * 0.18), blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher.png'));
  await sharp(face).composite([{ input: mask(launcher / 2), blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'));
}

const anydpi = path.join(res, 'mipmap-anydpi-v26');
await mkdir(anydpi, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
const { writeFile } = await import('node:fs/promises');
await writeFile(path.join(anydpi, 'ic_launcher.xml'), adaptive);
await writeFile(path.join(anydpi, 'ic_launcher_round.xml'), adaptive);
await writeFile(path.join(res, 'values', 'ic_launcher_background.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2F2961</color>\n</resources>\n');

// Ícone de 512x512 exigido pela Play Store (a loja aplica o arredondamento).
const store = path.join(root, 'store');
await mkdir(store, { recursive: true });
await sharp(bg, { density: 384 }).resize(512, 512)
  .composite([{ input: await render(fg, 512).toBuffer() }]).png().toFile(path.join(store, 'icon-512.png'));

// Favicon do navegador.
await mkdir(path.join(root, 'public'), { recursive: true });
await copyFile(path.join(root, 'assets', 'icon-foreground.svg'), path.join(root, 'public', 'icon.svg'));
console.log('Ícones gerados.');
