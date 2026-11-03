import Link from "next/link";
import type { Category, IndexItem } from "@/lib/content";
import { fmtDate } from "@/lib/content";
import AdSlot from "@/components/AdSlot";
import ArticleCard from "@/components/ArticleCard";
import { primaryCategory } from "@/components/editorial";
import { adSlotVisible } from "@/lib/ads";

export default function SectionRail({
  kicker,
  title,
  href,
  posts,
  categories,
  layout = "grid",
  ads = false,
}: {
  kicker?: string;
  title: string;
  href?: string;
  posts: IndexItem[];
  categories: Category[];
  layout?: "grid" | "feature-list";
  ads?: boolean;
}) {
  if (!posts.length) return null;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFEED;
  const sideSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR;
  const showInfeed = Boolean(ads && adSlotVisible(slot));
  const showSide = Boolean(ads && adSlotVisible(sideSlot));
  const withRail = posts.length > 6 || showSide;

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div>
          <span className="mb-2 block h-px w-10 bg-coral" aria-hidden />
          {kicker ? <p className="text-[11px] tracking-[0.16em] text-pine">{kicker}</p> : null}
          <h2 className="font-serif text-3xl leading-tight text-ink">{title}</h2>
        </div>
        {href ? (
          <Link href={href} className="shrink-0 text-sm text-pine underline-offset-4 hover:underline">
            Δείτε όλα
          </Link>
        ) : null}
      </div>

      {layout === "feature-list" ? (
        <div className={withRail ? "grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.7fr)]" : "space-y-8"}>
          <div className="space-y-8">
            <ArticleCard post={posts[0]} category={primaryCategory(posts[0], categories)} variant="horizontal" />
            {posts.length > 1 ? (
              <ul className="grid gap-6 sm:grid-cols-2">
                {posts.slice(1, 3).map((post) => (
                  <li key={post.id}>
                    <ArticleCard post={post} category={primaryCategory(post, categories)} />
                  </li>
                ))}
              </ul>
            ) : null}
            {showInfeed ? <AdSlot format="infeed" slot={slot} className="my-0" /> : null}
            {posts.length > 3 ? (
              <ul className="grid gap-6 sm:grid-cols-2">
                {posts.slice(3, 6).map((post) => (
                  <li key={post.id}>
                    <ArticleCard post={post} category={primaryCategory(post, categories)} />
                  </li>
                ))}
              </ul>
            ) : null}
            {showInfeed && posts.length > 5 ? <AdSlot format="infeed" slot={slot} className="my-0" /> : null}
          </div>
          {withRail ? (
          <aside>
            <h3 className="font-serif text-xl text-ink">Συνεχίστε την ανάγνωση</h3>
            <ol className="mt-4 divide-y divide-line">
              {posts.slice(6).map((post, index) => (
                <li key={post.id}>
                  <Link href={`/${post.slug}`} className="group flex gap-3 py-3">
                    <span className="font-serif text-lg text-coral" aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block font-serif text-lg leading-snug text-ink group-hover:underline group-hover:decoration-coral/80 group-hover:underline-offset-4">
                        {post.title}
                      </span>
                      <time dateTime={post.date} className="text-xs text-muted">
                        {fmtDate(post.date)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {showSide ? <AdSlot format="sidebar" slot={sideSlot} className="mt-6" /> : null}
          </aside>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((post, index) => (
            <li key={post.id} className={index === 0 ? "sm:col-span-2" : undefined}>
              <ArticleCard
                post={post}
                category={primaryCategory(post, categories)}
                variant={index === 0 ? "featured" : "compact"}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
