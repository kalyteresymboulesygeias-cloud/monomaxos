import { notFound } from "next/navigation";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import { getCategories, getCategory, getPostsByCategory } from "@/lib/content";
const PER_PAGE = 24;
export function generateStaticParams() {
  return getCategories().flatMap(c => {
    const pages = Math.ceil(getPostsByCategory(c.id).length / PER_PAGE);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ slug: c.slug, n: String(i + 2) }));
  });
}
export default async function CatPage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n: ns } = await params; const c = getCategory(slug); if (!c) notFound();
  const posts = getPostsByCategory(c.id); const pages = Math.ceil(posts.length / PER_PAGE); const n = Number(ns);
  if (!(n >= 2 && n <= pages)) notFound();
  return (<><h1 className="mb-6 text-xl font-bold">{c.name}</h1>
    <PostList posts={posts.slice((n - 1) * PER_PAGE, n * PER_PAGE)} />
    <Pagination base={`/category/${c.slug}`} page={n} pages={pages} /></>);
}
