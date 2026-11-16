import fs from "node:fs";
import path from "node:path";
import { SITE_ORIGIN } from "./site";

// Render-time media rewrite. content/media-map.json is written by scripts/migrate-images.mjs
// ({ "https://www.monomaxos.gr/wp-content/uploads/..": "/wp-content/uploads/.." }).
// Migrated uploads are served same-origin via the /media rewrite to the R2 bucket:
// some Greek mobile networks refuse *.r2.dev, and media.monomaxos.gr has no DNS record
// (an R2 custom domain needs the zone on Cloudflare). Old media.monomaxos.gr URLs are
// rewritten to /media as well.
let _map: Record<string, string> | null = null;
function getMap() {
  if (_map) return _map;
  const f = path.join(process.cwd(), "content", "media-map.json");
  const raw: Record<string, string> = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  // keys normalized (decoded), values URL-encoded so non-ASCII (Greek) filenames resolve
  _map = Object.fromEntries(Object.entries(raw).map(([k, v]) => [norm(k), encodeURI(safeDecode(v))]));
  return _map;
}
const UPLOADS = "/wp-content/uploads";
/** Former R2 custom domain. Not resolvable; kept so stored URLs on it are rewritten. */
const PUBLIC_MEDIA = "https://media.monomaxos.gr";
const BUCKET_R2_DEV = "https://pub-6eb02a9bf9ab4841b691105e6721ab5e.r2.dev";
export const R2_ORIGIN = BUCKET_R2_DEV;
export const MEDIA_PROXY = "/media";
const R2_URL = /https:\/\/pub-[a-z0-9]+\.r2\.dev\/wp-content\/uploads\/[^\s"'<>),]+/g;

function publicUpload(pathname: string, search = "") {
  return `${SITE_ORIGIN}${MEDIA_PROXY}${pathname.slice(UPLOADS.length)}${search}`;
}

function proxied(u: string) {
  try {
    const url = new URL(u);
    const onBucket = url.origin === BUCKET_R2_DEV || url.origin === PUBLIC_MEDIA;
    if (onBucket && url.pathname.startsWith(`${UPLOADS}/`)) return publicUpload(url.pathname, url.search);
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
  if (rel?.startsWith(`${UPLOADS}/`)) return publicUpload(rel);
  return proxied(u);
}
export function rewriteMedia(html: string) {
  return html
    .replace(/https?:\/\/(?:www\.)?monomaxos\.gr\/wp-content\/uploads\/[^\s"'<>),]+/g, (m) => mediaUrl(m) ?? m)
    .replace(R2_URL, proxied);
}
