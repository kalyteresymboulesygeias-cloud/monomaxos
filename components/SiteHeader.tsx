import Link from "next/link";
import CategoryNav, { type NavCategory } from "@/components/CategoryNav";
import MobileNav from "@/components/MobileNav";
import { displayName } from "@/components/editorial";

export default function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const items = categories.map((category) => ({ ...category, name: displayName(category.name) }));
  return (
    <header className="nav-wash sticky top-0 z-40 border-b border-pine/15">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-pine">
          <span className="grid size-8 place-items-center rounded-md bg-pine font-serif text-lg leading-none text-paper" aria-hidden>
            M
          </span>
          <span className="font-serif text-[1.65rem] leading-none tracking-tight">Monomaxos</span>
        </Link>
        <CategoryNav
          categories={items}
          className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-1 lg:flex"
          itemClassName="text-[13px] leading-tight tracking-wide"
        />
        <div className="ml-auto lg:hidden">
          <MobileNav categories={items} />
        </div>
      </div>
    </header>
  );
}
