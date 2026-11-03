import Link from "next/link";
import type { IndexItem } from "@/lib/content";
import { fmtDate } from "@/lib/content";
import CoverImage from "@/components/CoverImage";
import { displayName } from "@/components/editorial";
import { IMAGE_SIZES } from "@/lib/images";
import { mediaUrl } from "@/lib/media";

export type CardVariant = "hero" | "featured" | "compact" | "horizontal";

export default function ArticleCard({
  post,
  category,
  variant = "compact",
  lead,
  priority = false,
}: {
  post: IndexItem;
  category?: { name: string; slug: string };
  variant?: CardVariant;
  lead?: string;
  priority?: boolean;
}) {
  const src = mediaUrl(post.image);
  const sizes =
    variant === "hero"
      ? IMAGE_SIZES.hero
      : variant === "featured"
        ? IMAGE_SIZES.featured
        : variant === "horizontal"
          ? IMAGE_SIZES.horizontal
          : IMAGE_SIZES.compact;
  const kicker = category ? (
    <span className="text-xs font-medium text-pine">{displayName(category.name)}</span>
  ) : null;
  const date = (
    <time dateTime={post.date} className="text-xs text-muted">
      {fmtDate(post.date)}
    </time>
  );

  if (variant === "hero") {
    return (
      <article>
        <Link href={`/${post.slug}`} className="group block">
          <CoverImage src={src} alt="" priority={priority} sizes={sizes} className="aspect-[4/3] rounded-2xl sm:aspect-[16/10]" />
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {kicker}
            {date}
          </div>
          <h1 className="mt-3 text-balance font-serif text-4xl leading-[1.12] text-ink decoration-coral/80 decoration-1 underline-offset-[6px] group-hover:underline sm:text-5xl">
            {post.title}
          </h1>
          {lead ? <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{lead}</p> : null}
        </Link>
      </article>
    );
  }

  if (variant === "horizontal" || variant === "featured") {
    const titleClass =
      variant === "featured"
        ? "font-serif text-3xl leading-tight sm:text-4xl"
        : "font-serif text-2xl leading-snug";
    return (
      <article>
        <Link href={`/${post.slug}`} className="group grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-center sm:gap-6">
          <CoverImage src={src} alt="" priority={priority} sizes={sizes} className="aspect-[16/10] rounded-xl" />
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {kicker}
              {date}
            </div>
            <h2 className={`mt-2 text-balance text-ink decoration-coral/80 decoration-1 underline-offset-4 group-hover:underline ${titleClass}`}>
              {post.title}
            </h2>
            {lead ? <p className="mt-3 line-clamp-3 text-muted">{lead}</p> : null}
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="h-full">
      <Link href={`/${post.slug}`} className="group flex h-full flex-col">
        <CoverImage src={src} alt="" sizes={sizes} className="aspect-[3/2] rounded-xl" />
        <div className="mt-3 flex flex-1 flex-col">
          {kicker}
          <h2 className="mt-1.5 text-balance font-serif text-xl leading-snug text-ink decoration-coral/80 decoration-1 underline-offset-4 group-hover:underline">
            {post.title}
          </h2>
          <div className="mt-auto pt-3">{date}</div>
        </div>
      </Link>
    </article>
  );
}
