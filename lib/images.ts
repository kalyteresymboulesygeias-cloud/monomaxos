/** Hosts allowed through the Next.js image optimizer. Keep in sync with next.config.ts. */
const STATIC_MEDIA_HOSTS = [
  "pub-6eb02a9bf9ab4841b691105e6721ab5e.r2.dev",
  "media.monomaxos.gr",
  "www.monomaxos.gr",
  "monomaxos.gr",
];

const UPLOAD_PREFIX = "/wp-content/uploads/";

/** Hotlinked stock photos (Unsplash requires hotlinking the returned URL). */
const STOCK_HOSTS = ["images.unsplash.com"];

export const IMAGE_SIZES = {
  /** Homepage LCP: lg column is about 7/12 of the 72rem shell. */
  hero: "(min-width: 1024px) 40rem, 100vw",
  /** Article hero, same column width as the 72ch measure. */
  article: "(min-width: 1024px) 42rem, 100vw",
  /** First card in a 4-column rail, spanning two tracks from sm up. */
  featured: "(min-width: 1024px) 36rem, 100vw",
  /** sm: 16rem column, full content width below that. */
  horizontal: "(min-width: 640px) 16rem, 100vw",
  /** 2-col from sm, 3- or 4-col from lg. */
  compact: "(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw",
  /** "Επίσης σήμερα" thumb: 5.5rem, 6.5rem from sm. */
  thumb: "(min-width: 640px) 6.5rem, 5.5rem",
} as const;

export function mediaHostnames(): string[] {
  const hosts = new Set(STATIC_MEDIA_HOSTS);
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE;
  if (base) {
    try {
      hosts.add(new URL(base).hostname);
    } catch {
      /* ignore a malformed media base */
    }
  }
  return [...hosts];
}

export function imageRemotePatterns() {
  return [
    ...mediaHostnames().map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/wp-content/uploads/**",
    })),
    ...STOCK_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
  ];
}

function isUploadPath(pathname: string) {
  const path = pathname.split("?")[0] ?? pathname;
  return path.startsWith(UPLOAD_PREFIX) && !/\.(?:svg|gif)$/i.test(path);
}

/** True when next/image can resize this URL (remotePatterns or a local upload). */
export function isOptimizableImageSrc(src: string): boolean {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (src.startsWith("/") && !src.startsWith("//")) return isUploadPath(src);
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    if (STOCK_HOSTS.includes(url.hostname)) return true;
    if (!isUploadPath(url.pathname)) return false;
    return mediaHostnames().includes(url.hostname);
  } catch {
    return false;
  }
}

/** Pixel width to request from Unsplash for each cover slot. */
export const STOCK_MAX_WIDTH = {
  hero: 960,
  article: 1200,
  featured: 960,
  horizontal: 640,
  compact: 640,
  thumb: 256,
} as const;

/**
 * Unsplash hotlinks are full-size unless `w` is set. The Vercel optimizer is
 * off (402), so ask the CDN for a display-sized WebP/AVIF instead.
 * Other hosts are left untouched.
 */
export function displayImageSrc(src: string, maxWidth: number): string {
  const upgraded = upgradeMediaSrc(src);
  const width = Math.round(maxWidth);
  if (!Number.isFinite(width) || width < 64 || width > 2000) return upgraded;
  let url: URL;
  try {
    url = new URL(upgraded);
  } catch {
    return upgraded;
  }
  if (!STOCK_HOSTS.includes(url.hostname)) return upgraded;
  const current = Number(url.searchParams.get("w"));
  url.searchParams.set("w", String(Number.isFinite(current) && current > 0 ? Math.min(current, width) : width));
  const quality = Number(url.searchParams.get("q"));
  url.searchParams.set("q", String(Number.isFinite(quality) && quality > 0 ? Math.min(quality, 70) : 70));
  url.searchParams.delete("fm");
  url.searchParams.set("auto", "format");
  if (!url.searchParams.get("fit")) url.searchParams.set("fit", "max");
  return url.href;
}

/** WordPress leftovers sometimes use http://. The optimizer allowlist is https only. */
export function upgradeMediaSrc(src: string): string {
  try {
    const url = new URL(src);
    if (
      url.protocol === "http:" &&
      mediaHostnames().includes(url.hostname) &&
      isUploadPath(url.pathname)
    ) {
      url.protocol = "https:";
      return url.href;
    }
  } catch {
    /* relative src */
  }
  return src;
}
