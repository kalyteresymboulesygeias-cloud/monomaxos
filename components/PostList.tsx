import type { IndexItem } from "@/lib/content";
import { getCategories } from "@/lib/content";
import AdSlot from "@/components/AdSlot";
import ArticleCard from "@/components/ArticleCard";
import { primaryCategory } from "@/components/editorial";
import { adSlotVisible } from "@/lib/ads";

export default function PostList({ posts, ads = false }: { posts: IndexItem[]; ads?: boolean }) {
  const categories = getCategories();
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFEED;
  const showInfeed = Boolean(ads && adSlotVisible(slot));
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post, index) => (
        <div key={post.id} className="contents">
          <ArticleCard post={post} category={primaryCategory(post, categories)} />
          {showInfeed && (index === 2 || index === 5) ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <AdSlot format="infeed" slot={slot} className="my-0" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
