import AdSlot from "@/components/AdSlot";
import { segmentArticle } from "@/components/editorial";

export default function ArticleBody({ html }: { html: string }) {
  const parts = segmentArticle(html);
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE;
  return (
    <div className="mt-8 space-y-2">
      {parts.map((part, index) =>
        part.kind === "ad" ? (
          <AdSlot key={`ad-${index}`} format="article" slot={slot} />
        ) : (
          <div
            key={`html-${index}`}
            className="article-prose prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-medium prose-headings:text-pine-deep prose-p:text-ink prose-a:text-pine prose-blockquote:border-coral prose-blockquote:font-serif"
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        ),
      )}
    </div>
  );
}
