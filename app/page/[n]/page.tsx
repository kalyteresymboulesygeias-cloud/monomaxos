import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Pagination from "@/components/Pagination";
import PostList from "@/components/PostList";
import { getIndex } from "@/lib/content";

const PER_PAGE = 24;

export function generateStaticParams() {
  return Array.from({ length: Math.ceil(getIndex().length / PER_PAGE) - 1 }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const n = Number((await params).n);
  return { title: `Τελευταία άρθρα — σελίδα ${n}`, alternates: { canonical: `/page/${n}/` } };
}

export default async function ArchivePage({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  const all = getIndex();
  const pages = Math.ceil(all.length / PER_PAGE);
  if (!(n >= 2 && n <= pages)) notFound();
  return (
    <>
      <header className="mb-10 border-b border-line pb-6">
        <p className="text-[11px] tracking-[0.16em] text-pine">Αρχείο</p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">Τελευταία άρθρα</h1>
        <p className="mt-3 text-muted">Σελίδα {n} από {pages}</p>
      </header>
      <PostList posts={all.slice((n - 1) * PER_PAGE, n * PER_PAGE)} ads />
      <Pagination base="" page={n} pages={pages} />
    </>
  );
}
