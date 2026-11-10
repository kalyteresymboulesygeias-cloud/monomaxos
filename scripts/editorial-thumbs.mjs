import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "public", "editorial");
const WIDTH = 256;

async function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      await walk(full);
      continue;
    }
    if (!name.endsWith(".webp") || name.endsWith("-w256.webp")) continue;
    const dest = full.replace(/\.webp$/, "-w256.webp");
    const meta = await sharp(full).metadata();
    const width = meta.width ?? WIDTH;
    if (width <= WIDTH) {
      if (!fs.existsSync(dest)) fs.copyFileSync(full, dest);
      continue;
    }
    await sharp(full).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 68 }).toFile(dest);
  }
}

await walk(root);
