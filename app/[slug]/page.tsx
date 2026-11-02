import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decode, fmtDate, prepareContent, getCategories, getIndex, getPage, getPages, getPost } from "@/lib/content";
import { mediaUrl, rewriteMedia } from "@/lib/media";

// Pre-render the most recent posts + all pages at build; the rest render on first request.
export function generateStaticParams() {
  return [...getPages().map(p => ({ slug: p.slug })), ...getIndex().slice(0, 200).map(p => ({ slug: p.slug }))];
}
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const p = getPost(slug) ?? getPage(slug); if (!p) return {};
  const img = mediaUrl((p as { featured_image?: { url: string } | null }).featured_image?.url);
  return { title: decode(p.title.rendered), description: p.meta_description ?? undefined,
    alternates: { canonical: `/${p.slug}/` }, openGraph: { images: img ? [img] : undefined } };
}

export default async function Entry({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const post = getPost(slug);
  if (!post) {
    const page = getPage(slug); if (!page) notFound();
    return (<article className="prose prose-lg mx-auto"><h1>{decode(page.title.rendered)}</h1>
      <div dangerouslySetInnerHTML={{ __html: page.content.rendered }} /></article>);
  }
  const cats = getCategories().filter(c => post.categories.includes(c.id));
  return (
    <article className="prose prose-lg mx-auto">
      <h1>{decode(post.title.rendered)}</h1>
      <p className="text-sm text-gray-500"><time>{fmtDate(post.date)}</time>{" · "}
        {cats.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={`/category/${c.slug}`}>{c.name}</Link></span>)}</p>
      {post.featured_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(post.featured_image.url)} alt={post.featured_image.alt} width={post.featured_image.width} height={post.featured_image.height} />
      )}
      {/* AdSense slot placeholder: <ins className="adsbygoogle" data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT} ... /> */}
      <div dangerouslySetInnerHTML={{ __html: rewriteMedia(prepareContent(post.content.rendered)) }} />
    </article>
  );
}
