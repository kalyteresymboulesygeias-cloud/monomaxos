import { decode, getPost, getIndex } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const athensParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Athens",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function athensOffsetMs(instant: number) {
  const parts = Object.fromEntries(athensParts.formatToParts(instant).map((p) => [p.type, p.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - instant;
}

/** Content dates are Athens wall-clock time without an offset. */
function rfc822(stamp: string) {
  const [day, time = "00:00:00"] = stamp.split("T");
  const wall = Date.parse(`${day}T${time}Z`);
  let instant = wall - athensOffsetMs(wall);
  instant = wall - athensOffsetMs(instant);
  return new Date(instant).toUTCString();
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
