import Link from "next/link";
import CategoryNav, { type NavCategory } from "@/components/CategoryNav";
import MobileNav from "@/components/MobileNav";
import { displayName } from "@/components/editorial";

export default function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const items = categories.map((category) => ({ ...category, name: displayName(category.name) }));
  return (
    <header className="nav-wash sticky top-0 z-40 border-b border-pine/15">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex min-h-12 items-center">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-pine">
            <span className="grid size-8 place-items-center rounded-md bg-pine font-serif text-lg leading-none text-paper" aria-hidden>
              M
            </span>
            <span className="font-serif text-[1.65rem] leading-none tracking-tight">Monomaxos</span>
          </Link>
          <div className="ml-auto lg:hidden">
            <MobileNav categories={items} />
          </div>
        </div>
        <CategoryNav
          categories={items}
          className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-2 border-t border-pine/15 pt-3 lg:flex"
          itemClassName="text-base font-medium leading-snug"
        />
      </div>
    </header>
  );
}
