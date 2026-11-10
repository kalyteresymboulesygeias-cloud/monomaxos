import fs from "node:fs";
import path from "node:path";

// Render-time media rewrite. content/media-map.json is written by scripts/migrate-images.mjs
// ({ "https://www.monomaxos.gr/wp-content/uploads/..": "/wp-content/uploads/.." }).
// Migrated uploads are served from media.monomaxos.gr (R2 custom domain), so the
// browser does not fetch them through Vercel. /media remains a fallback rewrite
// to the r2.dev host for links already in the wild.
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
/** Public R2 hostname. A normal domain, so it is not blocked the way r2.dev is. */
const PUBLIC_MEDIA = "https://media.monomaxos.gr";
const BUCKET_R2_DEV = "https://pub-6eb02a9bf9ab4841b691105e6721ab5e.r2.dev";
/** Legacy /media rewrite target. New pages do not use this path. */
export const R2_ORIGIN = BUCKET_R2_DEV;
export const MEDIA_PROXY = "/media";
const R2_URL = /https:\/\/pub-[a-z0-9]+\.r2\.dev\/wp-content\/uploads\/[^\s"'<>),]+/g;

function publicUpload(pathname: string, search = "") {
  return `${PUBLIC_MEDIA}${pathname}${search}`;
}

function proxied(u: string) {
  try {
    const url = new URL(u);
    const onBucket = url.origin === BUCKET_R2_DEV || url.origin === PUBLIC_MEDIA;
    if (onBucket && url.pathname.startsWith(`${UPLOADS}/`)) {
      if (url.origin === PUBLIC_MEDIA) return u;
      return publicUpload(url.pathname, url.search);
    }
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
