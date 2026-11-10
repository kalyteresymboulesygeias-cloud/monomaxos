#!/usr/bin/env node
// Publish one original Greek article into content/posts, content/posts-index.json
// and content/categories.json.
//
//   node scripts/publish-post.mjs --dry-run --file article.json
//   node scripts/publish-post.mjs --file article.json
//   node scripts/publish-post.mjs --self-test
//
// The article must be original Greek writing. The script refuses payloads that
// declare a third-party source. It does not call AI APIs and it does not fetch
// article bodies.
//
// Canonical links are https://monomaxos.gr/{slug}/ (www redirects to the apex;
// keep this in sync with lib/site.ts). Shards hold 100 posts, newest first,
// matching the WordPress export. posts-001.json is full, so the next article
// opens posts-041.json. Post ids step by 2: featured_media occupies id + 1,
// the same pairing as the current export (12063 / 12064).
//
// Images: pass an absolute R2/media URL, or /wp-content/uploads/... together
// with NEXT_PUBLIC_MEDIA_BASE / --media-base. lib/media.ts only rewrites URLs
// that are already keys in content/media-map.json, so this script does not
// register new files there. Store the final absolute URL instead.

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://monomaxos.gr";
const SHARD_SIZE = 100;
const RESERVED_SLUGS = new Set(["page", "category", "api", "feed", "sitemap", "robots", "index", "_next"]);
const BANNED_KEYS = [
  "source_url",
  "sourceUrl",
  "scraped_from",
  "scrapedFrom",
  "rewrite_of",
  "rewriteOf",
  "spun_from",
  "spunFrom",
  "canonical_source",
  "canonicalSource",
];
const MEDICAL_DISCLAIMER_TEXT =
  "Αποποίηση ευθύνης: Αυτό το άρθρο έχει αποκλειστικά εκπαιδευτικό και ενημερωτικό χαρακτήρα. Δεν αποτελεί ιατρική συμβουλή. Πάντα να συμβουλεύεστε τον γιατρό σας πριν από οποιαδήποτε αλλαγή στη διατροφή, στη λήψη συμπληρωμάτων ή στον τρόπο ζωής σας, ιδιαίτερα εάν λαμβάνετε φάρμακα ή έχετε χρόνιες παθήσεις.";
const ENTERTAINMENT_DISCLAIMER_TEXT =
  "Αποποίηση ευθύνης: Το άρθρο αυτό έχει αποκλειστικά ψυχαγωγικό και ενημερωτικό χαρακτήρα. Η αστρολογία δεν αποτελεί επιστήμη και δεν πρέπει να χρησιμοποιείται ως βάση για σημαντικές αποφάσεις. Οι πληροφορίες προέρχονται από την αστρολογική παράδοση και τις δημοφιλείς ερμηνείες.";
const TRADITION_DISCLAIMER_TEXT =
  "Αποποίηση ευθύνης: Το άρθρο αυτό έχει αποκλειστικά ενημερωτικό και πολιτιστικό χαρακτήρα. Οι πληροφορίες βασίζονται στην ελληνική εκκλησιαστική παράδοση και το επίσημο εορτολόγιο. Δεν αποτελούν θεολογική ερμηνεία ή επίσημη θέση της Εκκλησίας.";
const LIFESTYLE_DISCLAIMER_TEXT =
  "Αποποίηση ευθύνης: Το άρθρο αυτό έχει αποκλειστικά ενημερωτικό και προτάσεων χαρακτήρα. Δεν αποτελεί επαγγελματική συμβουλή. Οι αναφορές σε καλλιτέχνες βασίζονται σε δημόσια γνωστές πληροφορίες και έχουν ψυχαγωγικό χαρακτήρα.";
const DISCLAIMER = `<p><em>${MEDICAL_DISCLAIMER_TEXT}</em></p>`;
const DISCLAIMERS = {
  medical: { html: DISCLAIMER, present: /αποποίηση ευθύνης|δεν αντικαθιστά την ιατρική συμβουλή/i },
  entertainment: { html: `<p><em>${ENTERTAINMENT_DISCLAIMER_TEXT}</em></p>`, present: /ψυχαγωγικό και ενημερωτικό χαρακτήρα|ψυχαγωγικό χαρακτήρα\. Δεν αποτελούν πρόβλεψη/i },
  tradition: { html: `<p><em>${TRADITION_DISCLAIMER_TEXT}</em></p>`, present: /ενημερωτικό και πολιτιστικό χαρακτήρα/i },
  lifestyle: { html: `<p><em>${LIFESTYLE_DISCLAIMER_TEXT}</em></p>`, present: /προτάσεων χαρακτήρα/i },
  none: null,
};
const GREEK = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i",
  θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y",
  ΰ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
};

export class PublishError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublishError";
  }
}

const fail = (message) => {
  throw new PublishError(message);
};

export function slugify(title) {
  const source = String(title)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#0*38;|&amp;|&/g, " ")
    .toLowerCase();
  let out = "";
  for (const ch of source) out += GREEK[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "-");
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function athensStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value, pretty = false) {
  const text = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*38;|&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normText(value) {
  return stripHtml(value).replace(/[«»“”„"]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("el");
}

function hasGreek(value) {
  return /\p{Script=Greek}/u.test(value);
}

function envFileValue(file, key) {
  if (!fs.existsSync(file)) return "";
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match || match[1] !== key) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }
  return "";
}

function resolveMediaBase(options, cwd) {
  if (options.mediaBase != null) return String(options.mediaBase).replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_MEDIA_BASE) return process.env.NEXT_PUBLIC_MEDIA_BASE.replace(/\/$/, "");
  for (const name of [".env.local", ".env"]) {
    const value = envFileValue(path.join(cwd, name), "NEXT_PUBLIC_MEDIA_BASE");
    if (value) return value.replace(/\/$/, "");
  }
  return "";
}

function defaultContentDir() {
  const fromCwd = path.resolve("content");
  if (fs.existsSync(path.join(fromCwd, "posts-index.json"))) return fromCwd;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content");
}

function shardFiles(postsDir) {
  return fs.readdirSync(postsDir).filter((name) => /^posts-\d+\.json$/.test(name));
}

function shardNumber(name) {
  return Number(name.match(/(\d+)/)[1]);
}

function uploadPath(pathname) {
  const bare = pathname.split("?")[0].split("#")[0];
  if (!bare.startsWith("/wp-content/uploads/") || bare.includes("..")) return null;
  return bare;
}

export function resolveImageUrl(raw, mediaBase) {
  const input = String(raw ?? "").trim();
  if (!input || /\s/.test(input)) fail("featured image URL is required and cannot contain spaces");
  if (/^(?:javascript|data):/i.test(input)) fail("featured image URL must be an https URL or a /wp-content/uploads/ path");

  if (input.startsWith("/")) {
    const pathname = uploadPath(input);
    if (!pathname) fail("relative images must live under /wp-content/uploads/...");
    if (!mediaBase) {
      return {
        url: encodeURI(pathname),
        warning:
          "Stored a root-relative /wp-content/uploads path. lib/media.ts does not prefix those with NEXT_PUBLIC_MEDIA_BASE. Pass an absolute R2 URL, or set NEXT_PUBLIC_MEDIA_BASE / --media-base.",
      };
    }
    return { url: mediaBase.replace(/\/$/, "") + encodeURI(pathname), warning: "" };
  }

  let parsed;
  try {
    parsed = new URL(input.replace(/^http:\/\//i, "https://"));
  } catch {
    fail(`featured image URL is not valid: ${input}`);
  }
  if (parsed.protocol !== "https:") fail("featured image URL must use https");
  const pathname = uploadPath(parsed.pathname);
  const host = parsed.hostname.replace(/^www\./, "");
  if (pathname && host === "monomaxos.gr") {
    if (!mediaBase) {
      return {
        url: `https://${parsed.host}${encodeURI(pathname)}`,
        warning:
          "www/apex monomaxos.gr upload URLs are rewritten to R2 only when they already exist in content/media-map.json. New files are not added to that map. Pass the absolute R2 URL instead.",
      };
    }
    return { url: mediaBase.replace(/\/$/, "") + encodeURI(pathname), warning: "" };
  }
  if (!pathname) {
    return {
      url: parsed.href,
      warning:
        "Image is outside /wp-content/uploads/, so next/image will not optimize it. Prefer an absolute R2 URL under /wp-content/uploads/.",
    };
  }
  return { url: `${parsed.origin}${encodeURI(pathname)}`, warning: "" };
}

function textField(value, label) {
  const text = stripHtml(typeof value === "string" ? value : value?.rendered ?? "").trim();
  if (!text) fail(`${label} is required`);
  return text;
}

function ensureHtml(value) {
  const raw = typeof value === "string" ? value : value?.rendered;
  if (typeof raw !== "string" || !raw.trim()) fail("HTML body is required (content, html, or body)");
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  if (/<\s*script\b|<\s*iframe\b|<\s*object\b|<\s*embed\b|\son\w+\s*=/i.test(trimmed)) {
    fail("HTML must not include script, iframe, embed, object, or inline event handlers");
  }
  if (/<[a-z!/]/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>\n")}</p>`)
    .join("\n");
}

function resolveDisclaimer(value) {
  const kind = value == null || value === "" ? "medical" : String(value);
  if (!Object.hasOwn(DISCLAIMERS, kind)) fail('disclaimer must be "medical", "entertainment", "tradition", "lifestyle" or "none"');
  return kind;
}

function withDisclaimer(html, kind = "medical") {
  const disclaimer = DISCLAIMERS[kind];
  if (!disclaimer || disclaimer.present.test(html)) return { html, added: false };
  return { html: `${html}\n${disclaimer.html}`, added: true };
}

function resolveCredit(credit) {
  if (credit == null) return undefined;
  if (typeof credit !== "object" || Array.isArray(credit)) fail("featured_image.credit must be an object with name and url");
  const name = stripHtml(String(credit.name ?? "")).trim();
  const url = String(credit.url ?? "").trim();
  if (!name) fail("featured_image.credit.name is required");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("featured_image.credit.url must be an absolute https URL");
  }
  if (parsed.protocol !== "https:") fail("featured_image.credit.url must be an absolute https URL");
  return { name, url: parsed.href };
}

function toExcerpt(input, html) {
  const raw = typeof input === "string" ? input.trim() : input?.rendered?.trim() ?? "";
  if (raw) return /<[a-z]/i.test(raw) ? raw : `<p>${escapeHtml(raw)}</p>`;
  const text = stripHtml(html);
  const cut = text.length > 280 ? `${text.slice(0, 277).replace(/\s+\S*$/, "")} […]` : text;
  return `<p>${escapeHtml(cut)}</p>`;
}

function resolveCategories(payload, categories) {
  const raw = [];
  if (payload.categories != null) raw.push(...(Array.isArray(payload.categories) ? payload.categories : [payload.categories]));
  for (const key of ["category", "category_slug", "category_id"]) {
    if (payload[key] != null) raw.push(payload[key]);
  }
  if (!raw.length) fail("category is required (slug or numeric id)");
  const ids = [];
  const found = [];
  for (const item of raw) {
    const cat =
      typeof item === "number" || /^\d+$/.test(String(item))
        ? categories.find((category) => category.id === Number(item))
        : categories.find((category) => category.slug === String(item).trim());
    if (!cat) fail(`unknown category: ${item}`);
    if (!ids.includes(cat.id)) {
      ids.push(cat.id);
      found.push(cat);
    }
  }
  return { ids, found };
}

function resolveTags(payload) {
  if (payload.tags == null || payload.tags === "") return [];
  if (!Array.isArray(payload.tags)) fail("tags must be an array of numeric ids");
  const ids = [];
  for (const tag of payload.tags) {
    if (!Number.isInteger(tag) || tag <= 0) {
      fail("tags must be numeric ids. This project has no tag-name dictionary; omit tags or pass ids.");
    }
    if (!ids.includes(tag)) ids.push(tag);
  }
  return ids;
}

function positiveInt(value, label) {
  if (value == null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 16000) fail(`${label} must be a positive integer`);
  return number;
}

function insertByDateDesc(items, item) {
  const index = items.findIndex((entry) => entry.date <= item.date);
  if (index === -1) items.push(item);
  else items.splice(index, 0, item);
}

function chooseShard(index, postsDir) {
  const files = shardFiles(postsDir);
  if (!index.length) {
    const file = files.sort((a, b) => shardNumber(a) - shardNumber(b)).at(-1) ?? "posts-001.json";
    const existing = files.includes(file) ? readJson(path.join(postsDir, file)) : [];
    if (existing.length < SHARD_SIZE) return { file, posts: existing, created: !files.includes(file) };
  } else {
    const file = index[0].file;
    const full = path.join(postsDir, file);
    if (!fs.existsSync(full)) fail(`index points at missing shard ${file}`);
    const posts = readJson(full);
    if (!Array.isArray(posts)) fail(`${file} is not a post array`);
    if (posts.length < SHARD_SIZE) return { file, posts, created: false };
  }
  const next = files.reduce((max, name) => Math.max(max, shardNumber(name)), 0) + 1;
  const file = `posts-${String(next).padStart(3, "0")}.json`;
  return { file, posts: [], created: true };
}

function scanShards(postsDir, pages) {
  let maxId = 0;
  const slugs = new Set();
  const metas = new Set();
  for (const page of pages) maxId = Math.max(maxId, page.id || 0, page.featured_media || 0);
  for (const name of shardFiles(postsDir)) {
    const posts = readJson(path.join(postsDir, name));
    for (const post of posts) {
      maxId = Math.max(maxId, post.id || 0, post.featured_media || 0);
      if (post.slug) slugs.add(post.slug);
      const meta = normText(post.meta_description || "");
      if (meta) metas.add(meta);
    }
  }
  return { maxId, slugs, metas };
}

export function publishArticle(payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("payload must be a JSON object");
  for (const key of BANNED_KEYS) {
    if (payload[key]) fail(`refusing "${key}": publish original Greek writing, not a scraped or rewritten article`);
  }
  if (payload.original !== true) {
    fail('Set "original": true to confirm this article is original Greek writing, not scraped or spun content.');
  }

  const contentDir = options.contentDir ?? defaultContentDir();
  const postsDir = path.join(contentDir, "posts");
  const indexPath = path.join(contentDir, "posts-index.json");
  const categoriesPath = path.join(contentDir, "categories.json");
  const pagesPath = path.join(contentDir, "pages.json");
  for (const file of [indexPath, categoriesPath, pagesPath]) {
    if (!fs.existsSync(file)) fail(`missing ${file}`);
  }
  if (!fs.existsSync(postsDir)) fail(`missing ${postsDir}`);

  const title = textField(payload.title, "title");
  if (title.length > 180) fail("title is longer than 180 characters");
  const content = ensureHtml(payload.content ?? payload.html ?? payload.body ?? payload.content_html);
  const plain = stripHtml(content);
  if (!hasGreek(title) || !hasGreek(plain)) fail("title and body must be Greek");
  if (plain.length < 400) fail("body is too short (minimum 400 characters of text)");

  const categories = readJson(categoriesPath);
  const pages = readJson(pagesPath);
  const index = readJson(indexPath);
  if (!Array.isArray(categories) || !Array.isArray(pages) || !Array.isArray(index)) {
    fail("content JSON files must be arrays");
  }

  const { ids, found } = resolveCategories(payload, categories);
  const tags = resolveTags(payload);
  const slugSource = payload.slug ? String(payload.slug) : title;
  const slug = slugify(slugSource);
  if (!slug || slug.length < 3 || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail(`slug "${slug || slugSource}" is empty or not a URL slug`);
  }
  if (RESERVED_SLUGS.has(slug)) fail(`slug "${slug}" is reserved by the app router`);

  const scanned = scanShards(postsDir, pages);
  if (scanned.slugs.has(slug) || index.some((item) => item.slug === slug) || pages.some((page) => page.slug === slug)) {
    fail(`slug "${slug}" already exists`);
  }
  const titleKey = normText(title);
  if (index.some((item) => normText(item.title) === titleKey)) fail(`title already exists: ${title}`);

  const meta = textField(payload.meta_description ?? payload.metaDescription ?? payload.description, "meta_description");
  if (meta.length > 300) fail("meta_description is longer than 300 characters");
  if (scanned.metas.has(normText(meta))) fail("meta_description duplicates an existing post");

  const imageInput = payload.featured_image?.url ?? payload.image ?? payload.image_url;
  const alt = textField(payload.featured_image?.alt ?? payload.image_alt ?? payload.alt, "image alt");
  const mediaBase = resolveMediaBase(options, options.cwd ?? process.cwd());
  const image = resolveImageUrl(imageInput, mediaBase);
  const width = positiveInt(payload.featured_image?.width ?? payload.image_width, "image width");
  const height = positiveInt(payload.featured_image?.height ?? payload.image_height, "image height");

  let date = payload.date ? String(payload.date) : athensStamp(options.now ?? new Date());
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    fail("date must look like 2026-11-04T18:30:00 (Europe/Athens, no timezone suffix)");
  }
  const modified = payload.modified ? String(payload.modified) : date;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(modified)) fail("modified must look like 2026-11-04T18:30:00");

  const disclaimerKind = resolveDisclaimer(payload.disclaimer);
  const { html, added: disclaimerAdded } = withDisclaimer(content, disclaimerKind);
  const credit = resolveCredit(payload.featured_image?.credit ?? payload.image_credit);
  const excerpt = toExcerpt(payload.excerpt, content);
  const id = scanned.maxId + 1;
  const featuredMedia = id + 1;
  const featuredImage = {
    url: image.url,
    alt,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(credit ? { credit } : {}),
  };
  const post = {
    id,
    slug,
    title: { rendered: title },
    content: { rendered: html },
    excerpt: { rendered: excerpt },
    date,
    modified,
    link: `${SITE_ORIGIN}/${slug}/`,
    categories: ids,
    tags,
    featured_media: featuredMedia,
    featured_image: featuredImage,
    meta_description: meta,
  };
  const indexItem = {
    id,
    slug,
    date,
    title,
    categories: ids,
    image: featuredImage.url,
    file: "",
    modified,
  };

  const shard = chooseShard(index, postsDir);
  indexItem.file = shard.file;
  insertByDateDesc(shard.posts, post);
  insertByDateDesc(index, indexItem);
  for (const category of categories) {
    if (ids.includes(category.id)) category.count += 1;
  }

  const warnings = [];
  if (image.warning) warnings.push(image.warning);
  if (!/<h2\b/i.test(html)) warnings.push("Article has no <h2>. The page renders the title as the only H1; structure the body with H2 sections.");
  if (!/href\s*=\s*["'](?:https?:\/\/(?:www\.)?monomaxos\.gr\/|\/(?!\/))/i.test(html)) {
    warnings.push("No internal link found. Link to a related monomaxos.gr article or category.");
  }
  if (meta.length < 50 || meta.length > 160) warnings.push(`meta_description is ${meta.length} characters; aim for 50–160.`);
  if (title.length < 25 || title.length > 110) warnings.push(`title is ${title.length} characters; aim for about 25–110.`);
  if (!width || !height) warnings.push("Featured image has no width/height. Pass them when known.");
  if (ids.includes(1)) warnings.push("Category includes Uncategorized.");
  const sameDay = index.filter((item) => item.date.slice(0, 10) === date.slice(0, 10)).length;
  if (sameDay > 2) warnings.push(`This would be post ${sameDay} dated ${date.slice(0, 10)}. Guidance is 1–2 original posts per day.`);
  if (options.strict && warnings.length) fail(warnings.join("\n"));

  const root = path.dirname(contentDir);
  const display = (file) => {
    const rel = path.relative(root, file);
    return rel.startsWith("..") ? file : rel.split(path.sep).join("/");
  };
  const wrote = [
    display(path.join(postsDir, shard.file)),
    display(indexPath),
    display(categoriesPath),
  ];
  if (!options.dryRun) {
    fs.mkdirSync(postsDir, { recursive: true });
    writeJson(path.join(postsDir, shard.file), shard.posts);
    writeJson(indexPath, index);
    writeJson(categoriesPath, categories, true);
  }

  return {
    ok: true,
    dry_run: Boolean(options.dryRun),
    id,
    featured_media: featuredMedia,
    slug,
    link: post.link,
    date,
    file: shard.file,
    shard_created: shard.created,
    shard_count: shard.posts.length,
    index_position: index.findIndex((item) => item.id === id),
    categories: found.map((category) => ({
      id: category.id,
      slug: category.slug,
      count: category.count,
    })),
    disclaimer_added: disclaimerAdded,
    media_map_updated: false,
    image: featuredImage,
    warnings,
    wrote: options.dryRun ? [] : wrote,
    post,
  };
}

export function updateArticle(payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("payload must be a JSON object");
  for (const key of BANNED_KEYS) {
    if (payload[key]) fail(`refusing "${key}": publish original Greek writing, not a scraped or rewritten article`);
  }
  if (payload.original !== true) fail('Set "original": true to confirm this article is original Greek writing.');
  const slug = String(options.slug ?? payload.slug ?? "").trim();
  if (!slug) fail("--update needs --slug");
  const contentDir = options.contentDir ?? defaultContentDir();
  const postsDir = path.join(contentDir, "posts");
  const indexPath = path.join(contentDir, "posts-index.json");
  const index = readJson(indexPath);
  const item = index.find((entry) => entry.slug === slug);
  if (!item) fail(`slug "${slug}" does not exist`);
  const shardPath = path.join(postsDir, item.file);
  const posts = readJson(shardPath);
  const post = posts.find((entry) => entry.slug === slug);
  if (!post) fail(`slug "${slug}" is missing from ${item.file}`);

  const content = ensureHtml(payload.content ?? payload.html ?? payload.body ?? payload.content_html);
  const plain = stripHtml(content);
  if (!hasGreek(plain)) fail("body must be Greek");
  if (plain.length < 400) fail("body is too short (minimum 400 characters of text)");
  const meta = textField(payload.meta_description ?? payload.metaDescription ?? payload.description, "meta_description");
  if (meta.length > 300) fail("meta_description is longer than 300 characters");
  const scanned = scanShards(postsDir, []);
  if (normText(meta) !== normText(post.meta_description || "") && scanned.metas.has(normText(meta))) {
    fail("meta_description duplicates an existing post");
  }
  const modified = payload.modified ? String(payload.modified) : athensStamp(options.now ?? new Date());
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(modified)) fail("modified must look like 2026-11-04T18:30:00");

  if (payload.title != null) {
    const title = textField(payload.title, "title");
    if (title.length > 180) fail("title is longer than 180 characters");
    if (!hasGreek(title)) fail("title must be Greek");
    const titleKey = normText(title);
    if (index.some((entry) => entry.slug !== slug && normText(entry.title) === titleKey)) fail(`title already exists: ${title}`);
    post.title = { rendered: title };
    item.title = title;
  }

  const { html, added } = withDisclaimer(content, resolveDisclaimer(payload.disclaimer));
  post.content = { rendered: html };
  post.excerpt = { rendered: toExcerpt(payload.excerpt, content) };
  post.meta_description = meta;
  post.modified = modified;
  const imageInput = payload.featured_image?.url ?? payload.image ?? payload.image_url;
  if (imageInput) {
    const alt = textField(payload.featured_image?.alt ?? payload.image_alt ?? payload.alt, "image alt");
    const image = resolveImageUrl(imageInput, resolveMediaBase(options, options.cwd ?? process.cwd()));
    const width = positiveInt(payload.featured_image?.width ?? payload.image_width, "image width");
    const height = positiveInt(payload.featured_image?.height ?? payload.image_height, "image height");
    const credit = resolveCredit(payload.featured_image?.credit ?? payload.image_credit);
    post.featured_image = {
      url: image.url,
      alt,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(credit ? { credit } : {}),
    };
    item.image = image.url;
  }
  item.modified = modified;
  if (!options.dryRun) {
    writeJson(shardPath, posts);
    writeJson(indexPath, index);
  }
  return { ok: true, updated: true, dry_run: Boolean(options.dryRun), slug, id: post.id, date: post.date, modified, file: item.file, disclaimer_added: added, post };
}

function parseArgs(argv) {
  const out = { dryRun: false, selfTest: false, strict: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--self-test") out.selfTest = true;
    else if (arg === "--strict") out.strict = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--file" || arg === "-f") out.file = argv[++i];
    else if (arg === "--content") out.content = argv[++i];
    else if (arg === "--media-base") out.mediaBase = argv[++i];
    else if (arg === "--update") out.update = true;
    else if (arg === "--slug") out.slug = argv[++i];
    else if (arg === "--slugify") out.slugify = argv[++i];
    else if (arg.startsWith("--")) fail(`unknown option ${arg}`);
    else if (!out.file) out.file = arg;
    else fail(`unexpected argument ${arg}`);
    if ((arg === "--file" || arg === "-f" || arg === "--content" || arg === "--media-base" || arg === "--slug" || arg === "--slugify") && argv[i] == null) {
      fail(`${arg} needs a value`);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/publish-post.mjs [--dry-run] [--strict] [--file article.json] [--content content] [--media-base URL]
       node scripts/publish-post.mjs --update --slug <slug> [--dry-run] --file article.json
       node scripts/publish-post.mjs --slugify "<Greek text>"
       node scripts/publish-post.mjs --self-test

Reads a JSON article from --file or stdin. --dry-run prints the post and the files it would write.
Required: original=true, Greek title, HTML body, category slug or id, meta_description, image URL and alt.
Canonical link: ${SITE_ORIGIN}/{slug}/
`);
}

function readPayload(file) {
  const raw = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    fail(`invalid JSON: ${error.message}`);
  }
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "monomaxos-publish-"));
  const postsDir = path.join(root, "posts");
  fs.mkdirSync(postsDir);
  const category = { id: 19, name: "ΥΓΕΙΑ &amp; ΔΙΑΤΡΟΦΗ", slug: "ygeia-diatrofi", count: 2, parent: 0, description: "" };
  const other = { id: 1, name: "Uncategorized", slug: "uncategorized", count: 0, parent: 0, description: "" };
  writeJson(path.join(root, "categories.json"), [category, other], true);
  writeJson(path.join(root, "pages.json"), [{ id: 3, slug: "privacy-policy", title: { rendered: "Πολιτική" } }]);
  const existing = [
    {
      id: 10,
      slug: "palio-arthro",
      title: { rendered: "Παλιό άρθρο για τη διατροφή" },
      content: { rendered: "<p>Παλιό.</p>" },
      excerpt: { rendered: "<p>Παλιό.</p>" },
      date: "2026-11-01T10:00:00",
      modified: "2026-11-01T10:00:00",
      link: `${SITE_ORIGIN}/palio-arthro/`,
      categories: [19],
      tags: [],
      featured_media: 11,
      featured_image: { url: "https://media.example.test/wp-content/uploads/old.jpg", alt: "old" },
      meta_description: "Παλιά μοναδική περιγραφή για το υπάρχον άρθρο διατροφής που δεν πρέπει να επαναληφθεί.",
    },
  ];
  writeJson(path.join(postsDir, "posts-001.json"), existing);
  writeJson(path.join(root, "posts-index.json"), [
    {
      id: 10,
      slug: "palio-arthro",
      date: "2026-11-01T10:00:00",
      title: "Παλιό άρθρο για τη διατροφή",
      categories: [19],
      image: existing[0].featured_image.url,
      file: "posts-001.json",
    },
  ]);

  assert.equal(
    slugify("«Τραμπ και Μελάνια: Αποκαλύψεις για τη σχέση τους και το χιούμορ του»"),
    "tramp-kai-melania-apokalypseis-gia-ti-schesi-toys-kai-to-chioymor-toy",
  );
  assert.equal(
    slugify("Μπίρα, κρασί ή ποτό: Ποιο προκαλεί καρκίνο και πώς;"),
    "mpira-krasi-i-poto-poio-prokalei-karkino-kai-pos",
  );
  assert.equal(slugify("Τριχόπτωση στις Γυναίκες: Σίδηρος, Θυρεοειδής & Εμμηνόπαυση"), "trichoptosi-stis-gynaikes-sidiros-thyreoeidis-emminopaysi");

  const catalog = readJson(path.join(defaultContentDir(), "categories.json"));
  const editorial = [
    {
      id: 406,
      slug: "eortologio",
      name: "Εορτολόγιο",
      description: "Ποιοι γιορτάζουν σήμερα και τις επόμενες μέρες. Ορθόδοξο εορτολόγιο με ονόματα και σύντομες σημειώσεις.",
    },
    {
      id: 407,
      slug: "zodia-simera",
      name: "Ζώδια σήμερα",
      description: "Ημερήσιες προβλέψεις για όλα τα ζώδια. Ψυχαγωγικό περιεχόμενο, όχι απόλυτη πρόβλεψη.",
    },
  ];
  const catalogIds = catalog.map((category) => category.id);
  assert.equal(new Set(catalogIds).size, catalogIds.length);
  for (const expected of editorial) {
    const match = catalog.find((category) => category.slug === expected.slug);
    assert.ok(match, expected.slug);
    assert.equal(match.id, expected.id);
    assert.equal(match.name, expected.name);
    assert.equal(match.parent, 0);
    assert.equal(match.description, expected.description);
    assert.equal(resolveCategories({ category: expected.slug }, catalog).ids[0], expected.id);
    assert.equal(resolveCategories({ category_id: String(expected.id) }, catalog).ids[0], expected.id);
  }

  const body = [
    "<h2>Γιατί έχει σημασία</h2>",
    "<p>Ένας σύντομος περίπατος μετά το γεύμα είναι μια απλή συνήθεια που πολλοί εντάσσουν στη μέρα τους όταν θέλουν πιο σταθερή ενέργεια το απόγευμα. Δεν αντικαθιστά γεύμα, φάρμακο ή εξέταση.</p>",
    `<p>Δείτε επίσης το <a href="${SITE_ORIGIN}/perpatima-pos-na-veltiosete-ta-apotelesmata-sas-me-ligotera-vimata/">οδηγό για το περπάτημα</a>.</p>`,
    "<h2>Πώς να το δοκιμάσετε</h2>",
    "<p>Δέκα έως είκοσι ήρεμα λεπτά μετά το φαγητό αρκούν ως αφετηρία. Σταματήστε αν ζαλίζεστε και συζητήστε το με τον γιατρό σας όταν έχετε χρόνια πάθηση.</p>",
  ].join("\n");
  const payload = {
    original: true,
    title: "Σύντομος περίπατος μετά το γεύμα και η απογευματινή ενέργεια",
    content: body,
    excerpt: "Σύντομος περίπατος μετά το γεύμα, χωρίς να υπόσχεται θεραπεία.",
    category: "ygeia-diatrofi",
    meta_description: "Τι αλλάζει ένας σύντομος περίπατος μετά το γεύμα στην απογευματινή ενέργεια και πότε να ρωτήσετε τον γιατρό σας.",
    image: "/wp-content/uploads/2026/11/peripatos.jpg",
    image_alt: "Άτομο που περπατά ήρεμα σε πεζόδρομο μετά το μεσημεριανό",
    image_width: 1200,
    image_height: 675,
    date: "2026-11-04T12:00:00",
  };

  const dry = publishArticle(payload, { contentDir: root, dryRun: true, mediaBase: "https://media.example.test", strict: true });
  assert.equal(dry.dry_run, true);
  assert.equal(dry.id, 12);
  assert.equal(dry.featured_media, 13);
  assert.equal(dry.file, "posts-001.json");
  assert.equal(dry.index_position, 0);
  assert.equal(dry.image.url, "https://media.example.test/wp-content/uploads/2026/11/peripatos.jpg");
  assert.equal(dry.disclaimer_added, true);
  assert.equal(dry.wrote.length, 0);
  assert.equal(fs.readFileSync(path.join(postsDir, "posts-001.json"), "utf8").includes("Σύντομος περίπατος"), false);

  const already = publishArticle(
    {
      ...payload,
      slug: "me-dilosi",
      title: "Περίπατος με ήδη γραμμένη αποποίηση ευθύνης στο σώμα",
      meta_description: "Δοκιμή που επιβεβαιώνει ότι η αποποίηση ευθύνης δεν μπαίνει δεύτερη φορά στο ίδιο άρθρο.",
      content: `${body}\n${DISCLAIMER}`,
    },
    { contentDir: root, dryRun: true, mediaBase: "https://media.example.test", strict: true },
  );
  assert.equal(already.disclaimer_added, false);
  assert.equal((already.post.content.rendered.match(/Αποποίηση ευθύνης/g) || []).length, 1);

  const fromWww = publishArticle(
    {
      ...payload,
      slug: "eikona-apo-www",
      title: "Περίπατος με εικόνα που δόθηκε ως παλιό www URL",
      meta_description: "Η εικόνα από το παλιό www URL αποθηκεύεται στο media base χωρίς εγγραφή στο media-map.",
      image: "https://www.monomaxos.gr/wp-content/uploads/2026/11/peripatos.jpg",
    },
    { contentDir: root, dryRun: true, mediaBase: "https://media.example.test", strict: true },
  );
  assert.equal(fromWww.image.url, "https://media.example.test/wp-content/uploads/2026/11/peripatos.jpg");
  assert.equal(fromWww.media_map_updated, false);

  const written = publishArticle(payload, { contentDir: root, mediaBase: "https://media.example.test", strict: true });
  assert.equal(written.dry_run, false);
  const shard = readJson(path.join(postsDir, "posts-001.json"));
  assert.equal(shard[0].slug, written.slug);
  assert.equal(shard[0].link, `${SITE_ORIGIN}/${written.slug}/`);
  assert.equal(shard[1].id, 10);
  assert.match(shard[0].content.rendered, /Αποποίηση ευθύνης/);
  const cats = readJson(path.join(root, "categories.json"));
  assert.equal(cats[0].count, 3);
  assert.equal(cats[0].name, "ΥΓΕΙΑ &amp; ΔΙΑΤΡΟΦΗ");

  assert.throws(() => publishArticle(payload, { contentDir: root, dryRun: true, mediaBase: "https://media.example.test" }), /slug/);
  assert.throws(() => publishArticle({ ...payload, original: false, slug: "allo" }, { contentDir: root, dryRun: true, mediaBase: "x" }), /original/);
  assert.throws(
    () => publishArticle({ ...payload, slug: "allo-arthro", source_url: "https://example.com/a" }, { contentDir: root, dryRun: true, mediaBase: "x" }),
    /source_url/,
  );

  const full = Array.from({ length: 100 }, (_, i) => ({
    id: 200 + i,
    slug: `gemato-${i}`,
    title: { rendered: `Γεμάτο ${i}` },
    content: { rendered: "<p>κείμενο</p>" },
    excerpt: { rendered: "<p>κείμενο</p>" },
    date: "2026-10-01T00:00:00",
    modified: "2026-10-01T00:00:00",
    link: `${SITE_ORIGIN}/gemato-${i}/`,
    categories: [19],
    tags: [],
    featured_media: 0,
    featured_image: null,
    meta_description: `μοναδική περιγραφή ${i} για το γεμάτο αρχείο δοκιμής δημοσίευσης`,
  }));
  const fullRoot = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "monomaxos-publish-full-"));
  fs.mkdirSync(path.join(fullRoot, "posts"));
  writeJson(path.join(fullRoot, "categories.json"), [{ ...category, count: 100 }], true);
  writeJson(path.join(fullRoot, "pages.json"), []);
  writeJson(path.join(fullRoot, "posts", "posts-001.json"), full);
  writeJson(
    path.join(fullRoot, "posts-index.json"),
    full.map((post) => ({
      id: post.id,
      slug: post.slug,
      date: post.date,
      title: post.title.rendered,
      categories: post.categories,
      image: null,
      file: "posts-001.json",
    })),
  );
  const rolled = publishArticle(
    { ...payload, title: "Νέο άρθρο μετά το γεμάτο αρχείο για τη διατροφή", slug: "neo-arthro-meta-to-gemato", date: "2026-11-03T08:00:00" },
    { contentDir: fullRoot, dryRun: true, mediaBase: "https://media.example.test", strict: true },
  );
  assert.equal(rolled.file, "posts-002.json");
  assert.equal(rolled.shard_created, true);
  assert.equal(rolled.id, 300);

  const backdated = publishArticle(
    {
      ...payload,
      title: "Παλαιότερη σημείωση για τον περίπατο μετά το φαγητό",
      slug: "palaioteri-simeiosi",
      date: "2026-10-15T08:00:00",
      meta_description: "Παλαιότερη πρωτότυπη σημείωση για τον περίπατο μετά το φαγητό, με διαφορετική περιγραφή.",
    },
    { contentDir: root, dryRun: true, mediaBase: "https://media.example.test", strict: true },
  );
  assert.ok(backdated.index_position > 0);

  assert.equal(DISCLAIMER.includes("\u2014"), false);
  const zodia = publishArticle(
    { ...payload, slug: "zodia-dokimi", title: "Ζώδια δοκιμής με ψυχαγωγική σημείωση", meta_description: "Ψυχαγωγική δοκιμή ζωδίων χωρίς ιατρική αποποίηση στο τέλος του κειμένου.", disclaimer: "entertainment" },
    { contentDir: root, dryRun: true, mediaBase: "https://media.example.test" },
  );
  assert.match(zodia.post.content.rendered, /ψυχαγωγικό και ενημερωτικό χαρακτήρα/);
  assert.doesNotMatch(zodia.post.content.rendered, /ιατρική συμβουλή/);
  const plainDay = publishArticle(
    { ...payload, slug: "xoris-dilosi", title: "Εορτολόγιο δοκιμής χωρίς καμία σημείωση", meta_description: "Δοκιμή εορτολογίου χωρίς αποποίηση ευθύνης στο τέλος του κειμένου.", disclaimer: "none" },
    { contentDir: root, dryRun: true, mediaBase: "https://media.example.test" },
  );
  assert.equal(plainDay.disclaimer_added, false);
  assert.throws(() => publishArticle({ ...payload, slug: "lathos", title: "Άρθρο με λάθος τύπο σημείωσης", meta_description: "Μοναδική περιγραφή για τη δοκιμή με λάθος τύπο σημείωσης στο τέλος.", disclaimer: "legal" }, { contentDir: root, dryRun: true, mediaBase: "x" }), /disclaimer/);
  const credited = publishArticle(
    {
      ...payload,
      slug: "me-credit",
      title: "Άρθρο με φωτογραφία από το Unsplash",
      meta_description: "Δοκιμή που κρατά το credit του φωτογράφου μαζί με την κεντρική εικόνα.",
      featured_image: { url: "https://images.unsplash.com/photo-1?ixid=abc", alt: "Φωτογραφία", width: 1080, height: 720, credit: { name: "Jane Doe", url: "https://unsplash.com/@jane?utm_source=monomaxos&utm_medium=referral" } },
    },
    { contentDir: root, dryRun: true, mediaBase: "https://media.example.test" },
  );
  assert.equal(credited.post.featured_image.credit.name, "Jane Doe");
  assert.throws(() => publishArticle({ ...payload, slug: "kako-credit", title: "Άρθρο με λάθος σύνδεσμο φωτογράφου", meta_description: "Μοναδική περιγραφή για τη δοκιμή με λάθος σύνδεσμο φωτογράφου εικόνας.", featured_image: { url: "https://images.unsplash.com/x", alt: "x", credit: { name: "A", url: "http://x" } } }, { contentDir: root, dryRun: true, mediaBase: "x" }), /credit/);
  assert.equal(readJson(path.join(root, "posts-index.json"))[0].modified, written.date);
  const updated = updateArticle(
    { original: true, content: `${body}\n<p>Νέα χρονιά.</p>`, meta_description: "Ανανεωμένη περιγραφή για το ίδιο άρθρο που ενημερώθηκε τη νέα χρονιά.", modified: "2027-11-04T09:00:00" },
    { contentDir: root, slug: written.slug, mediaBase: "https://media.example.test" },
  );
  assert.equal(updated.id, written.id);
  assert.equal(updated.date, written.date);
  const afterUpdate = readJson(path.join(postsDir, "posts-001.json")).find((entry) => entry.slug === written.slug);
  assert.equal(afterUpdate.modified, "2027-11-04T09:00:00");
  assert.match(afterUpdate.content.rendered, /Νέα χρονιά/);
  assert.equal(readJson(path.join(root, "posts-index.json")).find((entry) => entry.slug === written.slug).modified, "2027-11-04T09:00:00");
  assert.throws(() => updateArticle({ original: true, content: body, meta_description: "x" }, { contentDir: root, slug: "den-yparxei" }), /does not exist/);

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(fullRoot, { recursive: true, force: true });
  console.log("self-test ok");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.selfTest) {
    selfTest();
    return;
  }
  if (args.slugify != null) {
    console.log(slugify(args.slugify));
    return;
  }
  if (!args.file && process.stdin.isTTY) {
    printHelp();
    fail("pass --file or pipe JSON on stdin");
  }
  const payload = readPayload(args.file);
  const run = args.update ? updateArticle : publishArticle;
  const result = run(payload, {
    slug: args.slug,
    dryRun: args.dryRun,
    strict: args.strict,
    contentDir: args.content ? path.resolve(args.content) : undefined,
    mediaBase: args.mediaBase,
  });
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    if (error instanceof PublishError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
