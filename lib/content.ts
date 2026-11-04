import fs from "node:fs";
import path from "node:path";
import { decode as heDecode } from "he";

const DIR = path.join(process.cwd(), "content");
const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

export type Category = { id: number; name: string; slug: string; count: number; parent: number; description?: string };
export type IndexItem = { id: number; slug: string; date: string; title: string; categories: number[]; image: string | null; file: string };
export type Post = {
  id: number; slug: string; title: { rendered: string }; content: { rendered: string }; excerpt: { rendered: string };
  date: string; modified: string; link: string; categories: number[]; tags: number[]; featured_media: number;
  featured_image: { url: string; alt: string; width?: number; height?: number } | null; meta_description: string | null;
};
export type Page = { id: number; slug: string; title: { rendered: string }; content: { rendered: string }; date: string; modified: string; link: string; meta_description: string | null };

let _cats: Category[] | null = null, _idx: IndexItem[] | null = null;
export const decode = (s: string) => heDecode(s);
export function getCategories() { return (_cats ??= read<Category[]>("categories.json").map(c => ({ ...c, name: decode(c.name), description: c.description == null ? c.description : decode(c.description) }))); }
export function getNavCategories() { return getCategories().filter(c => c.parent === 0 && c.count > 0); }
export function getCategory(slug: string) { return getCategories().find(c => c.slug === slug); }
export function getIndex() { return (_idx ??= read<IndexItem[]>("posts-index.json").map(p => ({ ...p, title: decode(p.title) }))); }
export function getPostsByCategory(id: number) {
  const ids = new Set([id, ...getCategories().filter(c => c.parent === id).map(c => c.id)]);
  return getIndex().filter(p => p.categories.some(c => ids.has(c)));
}
export function getPost(slug: string): Post | undefined {
  const item = getIndex().find(p => p.slug === slug);
  if (!item) return undefined;
  return read<Post[]>(path.join("posts", item.file)).find(p => p.slug === slug);
}
export function getPages() { return read<Page[]>("pages.json"); }
export function getPage(slug: string) { return getPages().find(p => p.slug === slug); }
export const fmtDate = (d: string) => new Date(d).toLocaleDateString("el-GR", { year: "numeric", month: "long", day: "numeric" });

// Display-time transform: drop leading <br>s and demote the first leading <h1> to <h2>
// (the page already renders the post title as its <h1>). Later h1s are untouched.
export function prepareContent(html: string) {
  return html.replace(/^(?:\s|<br\s*\/?>)*(?:<h1(\b[^>]*)>([\s\S]*?)<\/h1>)?/i,
    (_m, attrs?: string, inner?: string) => (inner !== undefined ? `<h2${attrs ?? ""}>${inner}</h2>` : ""));
}
