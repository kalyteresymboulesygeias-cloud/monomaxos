import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import { getCategories, getCategory, getPostsByCategory } from "@/lib/content";
const PER_PAGE = 24;
export function generateStaticParams() { return getCategories().map(c => ({ slug: c.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCategory((await params).slug); return { title: c?.name, alternates: { canonical: `/category/${c?.slug}/` } };
}
export default async function Cat({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCategory((await params).slug); if (!c) notFound();
  const posts = getPostsByCategory(c.id);
  return (<><h1 className="mb-6 text-xl font-bold">{c.name}</h1>
    {posts.length ? <PostList posts={posts.slice(0, PER_PAGE)} /> : <p>Δεν υπάρχουν άρθρα.</p>}
    <Pagination base={`/category/${c.slug}`} page={1} pages={Math.ceil(posts.length / PER_PAGE)} /></>);
}
