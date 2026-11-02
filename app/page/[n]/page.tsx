import { notFound } from "next/navigation";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import { getIndex } from "@/lib/content";
const PER_PAGE = 24;
export function generateStaticParams() {
  return Array.from({ length: Math.ceil(getIndex().length / PER_PAGE) - 1 }, (_, i) => ({ n: String(i + 2) }));
}
export default async function P({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n); const all = getIndex(); const pages = Math.ceil(all.length / PER_PAGE);
  if (!(n >= 2 && n <= pages)) notFound();
  return (<><PostList posts={all.slice((n - 1) * PER_PAGE, n * PER_PAGE)} /><Pagination base="" page={n} pages={pages} /></>);
}
