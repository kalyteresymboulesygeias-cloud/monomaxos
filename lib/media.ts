import fs from "node:fs";
import path from "node:path";

// Render-time media rewrite. content/media-map.json is written by scripts/migrate-images.mjs
// ({ "https://www.monomaxos.gr/wp-content/uploads/..": "/wp-content/uploads/.." }).
// Only migrated URLs are rewritten; others stay pointing at www.monomaxos.gr.
// NEXT_PUBLIC_MEDIA_BASE prefixes rewritten /wp-content/uploads/... paths (Cloudflare R2).
// empty = serve those paths from this app's /public. Unmapped URLs are left unchanged.
let _map: Record<string, string> | null = null;
function getMap() {
  if (_map) return _map;
  const f = path.join(process.cwd(), "content", "media-map.json");
  const raw: Record<string, string> = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  // keys normalized (decoded), values URL-encoded so non-ASCII (Greek) filenames resolve
  _map = Object.fromEntries(Object.entries(raw).map(([k, v]) => [norm(k), encodeURI(safeDecode(v))]));
  return _map;
}
const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || "").replace(/\/$/, "");
const UPLOADS = "/wp-content/uploads";
/** Some mobile networks refuse *.r2.dev, so R2 files are served same-origin via the /media rewrite. */
export const R2_ORIGIN = BASE || "https://pub-6eb02a9bf9ab4841b691105e6721ab5e.r2.dev";
export const MEDIA_PROXY = "/media";
const R2_URL = /https:\/\/pub-[a-z0-9]+\.r2\.dev\/wp-content\/uploads\/[^\s"'<>),]+/g;

function proxied(u: string) {
  try {
    const url = new URL(u);
    const r2 = url.hostname.endsWith(".r2.dev") || (BASE !== "" && url.origin === new URL(BASE).origin);
    if (r2 && url.pathname.startsWith(`${UPLOADS}/`)) return MEDIA_PROXY + url.pathname.slice(UPLOADS.length) + url.search;
  } catch {
    /* not an absolute URL */
  }
  return u;
}
const safeDecode = (u: string) => { try { return decodeURI(u); } catch { return u; } };
const norm = (u: string) => safeDecode(u.replace(/^http:/, "https:").replace("://monomaxos", "://www.monomaxos"));

export function mediaUrl(u: string): string;
export function mediaUrl(u: string | null | undefined): string | undefined;
export function mediaUrl(u: string | null | undefined) {
  if (!u) return undefined;
  const rel = getMap()[norm(u)];
  if (rel) return rel.startsWith(`${UPLOADS}/`) ? MEDIA_PROXY + rel.slice(UPLOADS.length) : rel;
  return proxied(u);
}
export function rewriteMedia(html: string) {
  return html
    .replace(/https?:\/\/(?:www\.)?monomaxos\.gr\/wp-content\/uploads\/[^\s"'<>),]+/g, (m) => mediaUrl(m) ?? m)
    .replace(R2_URL, proxied);
}
