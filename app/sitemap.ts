import type { MetadataRoute } from "next";
import { getCategories, getIndex, getPages, getPostsByCategory } from "@/lib/content";
import { eortologioRedirectMap } from "@/lib/eortologio";
import { siteUrl } from "@/lib/site";

function day(stamp: string | undefined) {
  return stamp ? stamp.slice(0, 10) : undefined;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const index = getIndex();
  const pages = getPages();
  const categories = getCategories();
  const newest = day(index[0]?.date);
  const redirected = eortologioRedirectMap(index.map((post) => post.slug));
  const seen = new Set<string>();
  const urls: MetadataRoute.Sitemap = [];

  const add = (entry: MetadataRoute.Sitemap[number]) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    urls.push(entry);
  };

  add({ url: siteUrl("/"), lastModified: newest, changeFrequency: "daily", priority: 1 });

  for (const page of pages) {
    add({
      url: siteUrl(`/${page.slug}`),
      lastModified: day(page.modified || page.date),
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  for (const category of categories) {
    const posts = getPostsByCategory(category.id);
    if (!posts.length) continue;
    add({
      url: siteUrl(`/category/${category.slug}`),
      lastModified: day(posts[0]?.date) ?? newest,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  for (const post of index) {
    if (redirected.has(post.slug)) continue;
    add({
      url: siteUrl(`/${post.slug}`),
      lastModified: day(post.modified ?? post.date),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return urls;
}
