import fs from "node:fs";
import path from "node:path";

const YEARLY_SLUG = /^poioi-giortazoyn-simera-[a-z]+-(\d{1,2})-([a-z]+)-\d{4}$/;

/** Permanent nameday slug for a yearly one, e.g. ...-kyriaki-8-noemvrioy-2026 -> eortologio-8-noemvrioy. */
export function permanentEortologioSlug(slug: string): string | null {
  const match = YEARLY_SLUG.exec(slug);
  return match ? `eortologio-${match[1]}-${match[2]}` : null;
}

/** Yearly nameday slugs whose permanent article exists, mapped to that permanent slug. */
export function eortologioRedirectMap(slugs: string[]): Map<string, string> {
  const known = new Set(slugs);
  const map = new Map<string, string>();
  for (const slug of slugs) {
    const target = permanentEortologioSlug(slug);
    if (target && known.has(target)) map.set(slug, target);
  }
  return map;
}

export function eortologioRedirects(contentDir = path.join(process.cwd(), "content")) {
  const index = JSON.parse(fs.readFileSync(path.join(contentDir, "posts-index.json"), "utf8")) as { slug: string }[];
  return [...eortologioRedirectMap(index.map((item) => item.slug))].map(([from, to]) => ({
    source: `/${from}/`,
    destination: `/${to}/`,
    statusCode: 301 as const,
  }));
}
