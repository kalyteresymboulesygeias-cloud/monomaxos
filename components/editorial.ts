import type { Category } from "@/lib/content";
import { decode } from "@/lib/content";

const CATEGORY_LABELS: Record<string, string> = {
  "ΕΙΔΗΣΕΙΣ ΓΙΑ ΤΗΝ ΥΓΕΙΑ": "Ειδήσεις για την υγεία",
  "ΟΜΟΡΦΙΑ & ΥΓΕΙΑ": "Ομορφιά & υγεία",
  "ΣΕΞΟΥΑΛΙΚΟΤΗΤΑ": "Σεξουαλικότητα",
  "ΥΓΕΙΑ & ΔΙΑΤΡΟΦΗ": "Υγεία & διατροφή",
  "ΨΥΧΙΚΗ ΥΓΕΙΑ": "Ψυχική υγεία",
  "ΑΣΘΕΝΕΙΕΣ & ΑΝΤΙΜΕΤΩΠΙΣΗ": "Ασθένειες & αντιμετώπιση",
  "ΕΥΕΞΙΑ & ΨΥΧΙΚΗ ΙΣΟΡΡΟΠΙΑ": "Ευεξία & ψυχική ισορροπία",
  "ΥΓΕΙΑ": "Υγεία",
};

export function displayName(name: string) {
  const trimmed = name.trim();
  return CATEGORY_LABELS[trimmed] ?? trimmed;
}

export function imageLabel(alt: string | undefined, title: string) {
  const value = (alt || "").trim();
  const fileish = /\b(jpe?g|png|webp|gif|avif|svg)\b/i.test(value) || /\d{3,4}x\d{3,4}/.test(value) || /\b(scaled|cropped)\b/i.test(value);
  if (!value || fileish || value === title) return { alt: "", caption: "" };
  return { alt: value, caption: value };
}

export function stripHtml(value: string) {
  return decode(value.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function primaryCategory(post: { categories: number[] }, categories: Category[]) {
  return (
    categories.find((c) => c.parent === 0 && c.count > 0 && post.categories.includes(c.id)) ??
    categories.find((c) => post.categories.includes(c.id))
  );
}

export type ArticleSegment = { kind: "html"; html: string } | { kind: "ad" };

const DEPTH_TAGS = new Set(["div", "li", "ul", "ol", "blockquote", "table", "figure", "section", "article"]);

/** Split top-level paragraphs so an ad can sit between blocks, never inside a list or heading. */
export function segmentArticle(html: string, every = 4, maxAds = 3): ArticleSegment[] {
  const out: ArticleSegment[] = [];
  const re = /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g;
  let depth = 0;
  let paras = 0;
  let ads = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const tag = match[1].toLowerCase();
    const isClose = html[match.index + 1] === "/";
    const selfClosing = match[0].endsWith("/>") || tag === "br" || tag === "img" || tag === "hr" || tag === "wbr";
    if (selfClosing) continue;
    if (!isClose && DEPTH_TAGS.has(tag)) depth += 1;
    if (isClose && DEPTH_TAGS.has(tag)) depth = Math.max(0, depth - 1);
    if (!(isClose && tag === "p" && depth === 0)) continue;
    paras += 1;
    if (paras % every !== 0 || ads >= maxAds) continue;
    const end = match.index + match[0].length;
    if (!html.slice(end).trim()) continue;
    const chunk = html.slice(last, end);
    if (chunk.trim()) out.push({ kind: "html", html: chunk });
    out.push({ kind: "ad" });
    ads += 1;
    last = end;
  }
  const tail = html.slice(last);
  if (tail.trim()) out.push({ kind: "html", html: tail });
  if (!out.length && html.trim()) out.push({ kind: "html", html });
  return out;
}
