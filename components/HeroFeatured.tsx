import Link from "next/link";
import type { Category, IndexItem } from "@/lib/content";
import { fmtDate } from "@/lib/content";
import ArticleCard from "@/components/ArticleCard";
import CoverImage from "@/components/CoverImage";
import { displayName, primaryCategory } from "@/components/editorial";
import { IMAGE_SIZES } from "@/lib/images";
import { mediaUrl } from "@/lib/media";

export default function HeroFeatured({
  hero,
  secondary,
  categories,
  lead,
}: {
  hero?: IndexItem;
  secondary: IndexItem[];
  categories: Category[];
  lead?: string;
}) {
  if (!hero) return null;
  return (
    <section aria-label="Εξώφυλλο" className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <ArticleCard
          post={hero}
          category={primaryCategory(hero, categories)}
          variant="hero"
          lead={lead}
          priority
        />
      </div>
      <div className="lg:col-span-5">
        <p className="border-b border-line pb-2 text-xs tracking-[0.16em] text-pine">Επίσης σήμερα</p>
        <ul className="mt-4 divide-y divide-line">
          {secondary.map((post) => {
            const category = primaryCategory(post, categories);
            const src = mediaUrl(post.image);
            return (
              <li key={post.id} className="py-4 first:pt-3">
                <Link href={`/${post.slug}`} className="group grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                  <CoverImage src={src} alt="" sizes={IMAGE_SIZES.thumb} className="aspect-square rounded-lg" />
                  <div>
                    {category ? <span className="text-xs font-medium text-pine">{displayName(category.name)}</span> : null}
                    <h2 className="mt-1 text-balance font-serif text-lg leading-snug text-ink decoration-coral/80 underline-offset-4 group-hover:underline">
                      {post.title}
                    </h2>
                    <time dateTime={post.date} className="mt-1 block text-xs text-muted">
                      {fmtDate(post.date)}
                    </time>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
