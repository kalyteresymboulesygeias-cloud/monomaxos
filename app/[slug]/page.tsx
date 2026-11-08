import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import ArticleBody from "@/components/ArticleBody";
import CoverImage from "@/components/CoverImage";
import SectionRail from "@/components/SectionRail";
import { displayName, imageLabel } from "@/components/editorial";
import { adSlotVisible } from "@/lib/ads";
import { decode, fmtDate, prepareContent, getCategories, getIndex, getPage, getPages, getPost, getPostsByCategory } from "@/lib/content";
import { IMAGE_SIZES } from "@/lib/images";
import { mediaUrl, rewriteMedia } from "@/lib/media";
import { optimizeArticleHtml } from "@/lib/optimize-html-images";
import { SITE_ORIGIN, siteUrl } from "@/lib/site";

export function generateStaticParams() {
  return [...getPages().map((page) => ({ slug: page.slug })), ...getIndex().slice(0, 200).map((post) => ({ slug: post.slug }))];
}
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const entry = getPost(slug) ?? getPage(slug);
  if (!entry) return {};
  const image = mediaUrl((entry as { featured_image?: { url: string } | null }).featured_image?.url);
  return {
    title: decode(entry.title.rendered),
    description: entry.meta_description ?? undefined,
    alternates: { canonical: `/${entry.slug}/` },
    openGraph: { images: image ? [image] : undefined },
  };
}

export default async function Entry({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const post = getPost(slug);
  if (!post) {
    const page = getPage(slug);
    if (!page) notFound();
    return (
      <article className="mx-auto max-w-[72ch]">
        <h1 className="text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">{decode(page.title.rendered)}</h1>
        <div
          className="article-prose prose prose-lg mt-8 max-w-none prose-headings:font-serif prose-headings:font-medium prose-headings:text-pine-deep prose-p:text-ink prose-a:text-pine prose-blockquote:border-coral prose-blockquote:font-serif"
          dangerouslySetInnerHTML={{ __html: optimizeArticleHtml(rewriteMedia(page.content.rendered)) }}
        />
      </article>
    );
  }

  const categories = getCategories().filter((category) => post.categories.includes(category.id));
  const primary = categories.find((category) => category.parent === 0) ?? categories[0];
  const related = (primary ? getPostsByCategory(primary.id) : getIndex()).filter((item) => item.slug !== post.slug).slice(0, 4);
  const title = decode(post.title.rendered);
  const image = post.featured_image ? mediaUrl(post.featured_image.url) : undefined;
  const label = imageLabel(post.featured_image?.alt, title);
  const sideSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR;
  const articleSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE;
  const showSideAd = adSlotVisible(sideSlot);
  const showArticleAd = adSlotVisible(articleSlot);
  const credit = post.featured_image?.credit;
  const url = siteUrl(`/${post.slug}/`);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: post.meta_description ?? undefined,
      datePublished: post.date,
      dateModified: post.modified || post.date,
      mainEntityOfPage: url,
      image: image ? [image] : undefined,
      inLanguage: "el",
      publisher: { "@type": "Organization", name: "monomaxos.gr", url: SITE_ORIGIN },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Αρχική", item: siteUrl("/") },
        ...(primary
          ? [{ "@type": "ListItem", position: 2, name: displayName(primary.name), item: siteUrl(`/category/${primary.slug}/`) }]
          : []),
        { "@type": "ListItem", position: primary ? 3 : 2, name: title, item: url },
      ],
    },
  ];

  return (
    <div className="space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className={showSideAd ? "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-12" : undefined}>
        <article className={`mx-auto w-full max-w-[72ch]${showSideAd ? " lg:mx-0" : ""}`}>
          <header>
            {categories.length ? (
              <p className="flex flex-wrap gap-x-3 text-xs font-medium text-pine">
                {categories.map((category) => (
                  <Link key={category.id} href={`/category/${category.slug}`} className="hover:underline">
                    {displayName(category.name)}
                  </Link>
                ))}
              </p>
            ) : null}
            <h1 className="mt-3 text-balance font-serif text-4xl leading-[1.15] text-ink sm:text-5xl">{title}</h1>
            <p className="mt-4 text-sm text-muted">
              <time dateTime={post.date}>{fmtDate(post.date)}</time>
            </p>
          </header>
          {image ? (
            <figure className="mt-8">
              <CoverImage
                src={image}
                alt={label.alt}
                priority
                sizes={IMAGE_SIZES.article}
                className="aspect-[16/9] rounded-2xl"
              />
              {label.caption || credit ? (
                <figcaption className="mt-2 text-sm text-muted">
                  {label.caption}
                  {label.caption && credit ? " · " : null}
                  {credit ? (
                    <>
                      Φωτογραφία:{" "}
                      <a href={credit.url} rel="nofollow noopener" target="_blank" className="underline hover:text-pine">
                        {credit.name}
                      </a>{" "}
                      /{" "}
                      <a
                        href="https://unsplash.com/?utm_source=monomaxos&utm_medium=referral"
                        rel="nofollow noopener"
                        target="_blank"
                        className="underline hover:text-pine"
                      >
                        Unsplash
                      </a>
                    </>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
          {showArticleAd ? <AdSlot format="article" slot={articleSlot} /> : null}
          <ArticleBody html={rewriteMedia(prepareContent(post.content.rendered))} />
        </article>
        {showSideAd ? (
          <aside className="mt-10 hidden lg:mt-0 lg:block" aria-label="Διαφήμιση στη στήλη">
            <AdSlot format="sidebar" slot={sideSlot} />
          </aside>
        ) : null}
      </div>
      <SectionRail
        kicker="Συνέχεια"
        title="Σχετικά άρθρα"
        href={primary ? `/category/${primary.slug}` : undefined}
        posts={related}
        categories={getCategories()}
      />
      {showSideAd ? (
        <div className="lg:hidden">
          <AdSlot format="sidebar" slot={sideSlot} />
        </div>
      ) : null}
    </div>
  );
}
