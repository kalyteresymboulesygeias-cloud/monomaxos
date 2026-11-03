import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Pagination from "@/components/Pagination";
import PostList from "@/components/PostList";
import { displayName } from "@/components/editorial";
import { getCategories, getCategory, getPostsByCategory } from "@/lib/content";

const PER_PAGE = 24;

export function generateStaticParams() {
  return getCategories().flatMap((category) => {
    const pages = Math.ceil(getPostsByCategory(category.id).length / PER_PAGE);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ slug: category.slug, n: String(i + 2) }));
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; n: string }> }): Promise<Metadata> {
  const { slug, n } = await params;
  const category = getCategory(slug);
  return {
    title: category ? `${displayName(category.name)} — σελίδα ${n}` : undefined,
    alternates: { canonical: `/category/${slug}/page/${n}/` },
  };
}

export default async function CategoryArchivePage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n: pageParam } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const posts = getPostsByCategory(category.id);
  const pages = Math.ceil(posts.length / PER_PAGE);
  const n = Number(pageParam);
  if (!(n >= 2 && n <= pages)) notFound();
  return (
    <>
      <header className="mb-10 border-b border-line pb-6">
        <p className="text-[11px] tracking-[0.16em] text-pine">Κατηγορία</p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">{displayName(category.name)}</h1>
        <p className="mt-3 text-muted">Σελίδα {n} από {pages}</p>
      </header>
      <PostList posts={posts.slice((n - 1) * PER_PAGE, n * PER_PAGE)} ads />
      <Pagination base={`/category/${category.slug}`} page={n} pages={pages} />
    </>
  );
}
