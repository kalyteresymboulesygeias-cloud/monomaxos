import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "public", "editorial");
const VARIANTS = [
  { width: 256, quality: 68 },
  { width: 800, quality: 62 },
];

async function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      await walk(full);
      continue;
    }
    if (!name.endsWith(".webp") || /-w\d+\.webp$/.test(name)) continue;
    const meta = await sharp(full).metadata();
    const width = meta.width ?? 0;
    for (const variant of VARIANTS) {
      const dest = full.replace(/\.webp$/, `-w${variant.width}.webp`);
      if (width <= variant.width) {
        if (!fs.existsSync(dest)) fs.copyFileSync(full, dest);
        continue;
      }
      await sharp(full)
        .resize({ width: variant.width, withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toFile(dest);
    }
  }
}

await walk(root);
