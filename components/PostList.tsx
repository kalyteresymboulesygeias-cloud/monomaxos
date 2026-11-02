import Link from "next/link";
import { IndexItem, fmtDate } from "@/lib/content";
import { mediaUrl } from "@/lib/media";

export default function PostList({ posts }: { posts: IndexItem[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map(p => (
        <li key={p.id} className="overflow-hidden rounded-lg border border-gray-200">
          <Link href={`/${p.slug}`} className="block hover:opacity-90">
            {p.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(p.image)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
            )}
            <div className="p-4">
              <time className="text-xs text-gray-500">{fmtDate(p.date)}</time>
              <h2 className="mt-1 font-semibold leading-snug">{p.title}</h2>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
