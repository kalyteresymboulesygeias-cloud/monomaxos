const LOCALES = new Set([
  "ga",
  "zh-tw",
  "zh-cn",
  "tr",
  "fa",
  "lb",
  "pl",
  "ru",
  "fr",
  "sv",
  "hi",
  "it",
  "ja",
  "ko",
  "nl",
  "de",
  "en-news-trends",
]);

const OLD_SECTIONS = new Set([
  "endiaferon-themata",
  "video-news-teleftaia-nea-eidiseis",
  "lifestyle",
  "perivallon",
  "kyria-themata",
  "blog",
]);

const TAG_SEGMENTS = new Set([
  "tag",
  "ετικέτα",
  "etiket",
  "etikett",
  "label",
  "taggen",
  "etichetta",
  "тег",
  "برچسب",
]);

/** Old WordPress tags, machine translations and section paths. Not current articles. */
export function isLegacyGone(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  const parts = decoded.split("/").filter(Boolean);
  if (!parts.length) return false;
  const first = parts[0].toLowerCase();
  if (first === "tag" || first === "ετικέτα") return true;
  if (LOCALES.has(first) || OLD_SECTIONS.has(first)) return true;
  if (first === "index.htm" || first === "home" || first === "pages") return true;
  return parts.some((part) => TAG_SEGMENTS.has(part) || TAG_SEGMENTS.has(part.toLowerCase()));
}
