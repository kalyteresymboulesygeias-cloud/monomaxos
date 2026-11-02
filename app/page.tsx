import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import { getIndex } from "@/lib/content";
export const PER_PAGE = 24;
export default function Home() {
  const all = getIndex();
  return (<><h1 className="mb-6 text-xl font-bold">Τελευταία άρθρα</h1>
    <PostList posts={all.slice(0, PER_PAGE)} />
    <Pagination base="" page={1} pages={Math.ceil(all.length / PER_PAGE)} /></>);
}
