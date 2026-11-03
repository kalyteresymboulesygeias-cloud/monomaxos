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
const safeDecode = (u: string) => { try { return decodeURI(u); } catch { return u; } };
const norm = (u: string) => safeDecode(u.replace(/^http:/, "https:").replace("://monomaxos", "://www.monomaxos"));

export function mediaUrl(u: string): string;
export function mediaUrl(u: string | null | undefined): string | undefined;
export function mediaUrl(u: string | null | undefined) {
  if (!u) return undefined;
  const rel = getMap()[norm(u)];
  return rel ? BASE + rel : u;
}
export function rewriteMedia(html: string) {
  if (!Object.keys(getMap()).length) return html;
  return html.replace(/https?:\/\/(?:www\.)?monomaxos\.gr\/wp-content\/uploads\/[^\s"'<>),]+/g, (m) => mediaUrl(m) ?? m);
}
