/** Canonical origin. https://www.monomaxos.gr permanently redirects to the apex. */
export const SITE_ORIGIN = "https://monomaxos.gr";

/** Absolute URL with the trailing slash used by every public route. */
export function siteUrl(pathname = "/"): string {
  if (!pathname || pathname === "/") return `${SITE_ORIGIN}/`;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${path.endsWith("/") ? path : `${path}/`}`;
}
