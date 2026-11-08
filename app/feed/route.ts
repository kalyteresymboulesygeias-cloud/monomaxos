import { decode, getPost, getIndex } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Content dates are Athens wall-clock time without an offset. */
function rfc822(stamp: string) {
  const [day, time = "00:00:00"] = stamp.split("T");
  const month = Number(day.slice(5, 7));
  const offset = month >= 4 && month <= 10 ? "+03:00" : "+02:00";
  return new Date(`${day}T${time}${offset}`).toUTCString();
}

export function GET() {
  const items = getIndex()
    .slice(0, 50)
    .map((entry) => {
      const post = getPost(entry.slug);
      const link = siteUrl(`/${entry.slug}/`);
      const summary = post?.meta_description ?? decode(post?.excerpt.rendered.replace(/<[^>]+>/g, " ") ?? "").trim();
      const image = mediaUrl(post?.featured_image?.url ?? entry.image ?? undefined);
      return [
        "<item>",
        `<title>${xml(entry.title)}</title>`,
        `<link>${xml(link)}</link>`,
        `<guid isPermaLink="true">${xml(link)}</guid>`,
        `<pubDate>${rfc822(entry.date)}</pubDate>`,
        summary ? `<description>${xml(summary)}</description>` : "",
        image ? `<enclosure url="${xml(image)}" type="image/${/\.png(\?|$)/i.test(image) ? "png" : /\.webp(\?|$)/i.test(image) ? "webp" : "jpeg"}" length="0"/>` : "",
        "</item>",
      ].join("");
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Μονομάχος</title>
<link>${siteUrl("/")}</link>
<description>Ενημέρωση για υγεία, διατροφή και ευεξία.</description>
<language>el</language>
<atom:link href="${siteUrl("/feed/")}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
