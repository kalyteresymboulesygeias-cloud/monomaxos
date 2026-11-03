import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Pagination from "@/components/Pagination";
import PostList from "@/components/PostList";
import { decode, getCategories, getCategory, getPostsByCategory } from "@/lib/content";
import { displayName, primaryCategory } from "@/components/editorial";

const PER_PAGE = 24;

export function generateStaticParams() {
  return getCategories().map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = getCategory((await params).slug);
  return {
    title: category ? displayName(category.name) : undefined,
    description: category?.description ? decode(category.description) : undefined,
    alternates: { canonical: `/category/${category?.slug}/` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = getCategory((await params).slug);
  if (!category) notFound();
  const posts = getPostsByCategory(category.id);
  const categories = getCategories();
  const featured = posts[0];
  const intro = category.description ? decode(category.description) : "";
  return (
    <>
      <header className="mb-10 max-w-3xl border-b border-line pb-8">
        <p className="text-[11px] tracking-[0.16em] text-pine">Κατηγορία</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">{displayName(category.name)}</h1>
        {intro ? <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p> : null}
        <p className="mt-3 text-sm text-muted">{posts.length} άρθρα</p>
      </header>
      {featured ? (
        <div className="mb-12">
          <ArticleCard post={featured} category={primaryCategory(featured, categories) ?? category} variant="featured" priority />
        </div>
      ) : (
        <p className="text-muted">Δεν υπάρχουν άρθρα.</p>
      )}
      {posts.length > 1 ? <PostList posts={posts.slice(1, PER_PAGE)} ads /> : null}
      <Pagination base={`/category/${category.slug}`} page={1} pages={Math.ceil(posts.length / PER_PAGE)} />
    </>
  );
}
