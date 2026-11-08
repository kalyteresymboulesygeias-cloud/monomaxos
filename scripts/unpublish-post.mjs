#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value, pretty = false) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
}

export function unpublishArticle(slug, options = {}) {
  if (!slug) throw new Error("--slug is required");
  const contentDir = options.contentDir ?? path.resolve(here, "..", "content");
  const indexPath = path.join(contentDir, "posts-index.json");
  const categoriesPath = path.join(contentDir, "categories.json");
  const index = readJson(indexPath);
  const position = index.findIndex((entry) => entry.slug === slug);
  if (position < 0) throw new Error(`slug "${slug}" does not exist`);
  const [item] = index.splice(position, 1);
  const shardPath = path.join(contentDir, "posts", item.file);
  const posts = readJson(shardPath);
  const remaining = posts.filter((post) => post.slug !== slug);
  const removed = posts.find((post) => post.slug === slug);
  const categoryIds = removed?.categories ?? item.categories ?? [];
  const categories = readJson(categoriesPath);
  for (const category of categories) {
    if (categoryIds.includes(category.id) && category.count > 0) category.count -= 1;
  }
  if (!options.dryRun) {
    writeJson(shardPath, remaining);
    writeJson(indexPath, index);
    writeJson(categoriesPath, categories, true);
  }
  return { ok: true, dry_run: Boolean(options.dryRun), slug, id: item.id, file: item.file, categories: categoryIds };
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--slug");
  const slug = at >= 0 ? args[at + 1] : undefined;
  const contentAt = args.indexOf("--content");
  try {
    const result = unpublishArticle(slug, {
      dryRun: args.includes("--dry-run"),
      contentDir: contentAt >= 0 ? path.resolve(args[contentAt + 1]) : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    console.error("Usage: node scripts/unpublish-post.mjs --slug <slug> [--dry-run]");
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
