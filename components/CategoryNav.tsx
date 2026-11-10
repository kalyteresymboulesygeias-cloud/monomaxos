"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavCategory = { id: number; name: string; slug: string };

function isActive(path: string, slug: string) {
  const current = path.replace(/\/$/, "") || "/";
  return current === `/category/${slug}`;
}

export default function CategoryNav({
  categories,
  onNavigate,
  className = "",
  itemClassName = "",
  tone = "ink",
}: {
  categories: NavCategory[];
  onNavigate?: () => void;
  className?: string;
  itemClassName?: string;
  tone?: "ink" | "paper";
}) {
  const path = usePathname() || "/";
  const idle = tone === "paper" ? "text-paper/80 hover:text-paper" : "text-ink hover:text-pine";
  const current = tone === "paper" ? "text-paper" : "text-pine";
  return (
    <nav aria-label="Κατηγορίες" className={className}>
      {categories.map((category) => {
        const active = isActive(path, category.slug);
        return (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`transition-colors ${active ? current : idle} ${itemClassName}`}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
