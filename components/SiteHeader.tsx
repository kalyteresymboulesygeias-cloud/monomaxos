import Link from "next/link";
import CategoryNav, { type NavCategory } from "@/components/CategoryNav";
import MobileNav from "@/components/MobileNav";
import { displayName } from "@/components/editorial";

function mastheadDate(now = new Date()) {
  const formatted = new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(now);
  return formatted.charAt(0).toLocaleUpperCase("el") + formatted.slice(1);
}

export default function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const items = categories.map((category) => ({ ...category, name: displayName(category.name) }));
  return (
    <header className="border-b border-pine/15">
      <div className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 text-center">
          <p className="text-xs font-medium tracking-[0.16em] text-muted">{mastheadDate()}</p>
          <Link href="/" className="mt-3 inline-flex items-center gap-3 text-pine">
            <span className="grid size-11 place-items-center rounded-md bg-pine font-serif text-2xl leading-none text-paper" aria-hidden>
              M
            </span>
            <span className="font-serif text-5xl leading-none tracking-tight sm:text-6xl">Monomaxos</span>
          </Link>
          <p className="mt-3 text-sm text-muted">Περιοδικό υγείας και ευεξίας</p>
          <p className="mt-1 text-xs tracking-[0.14em] text-pine/75">Υγεία · Ομορφιά · Διατροφή · Ψυχική υγεία</p>
        </div>
      </div>
      <div className="sticky top-0 z-40 border-t border-pine/20 bg-pine text-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 py-2.5 font-serif text-lg leading-none tracking-tight">
            <span className="grid size-7 place-items-center rounded bg-paper font-serif text-base leading-none text-pine" aria-hidden>
              M
            </span>
            Monomaxos
          </Link>
          <CategoryNav
            categories={items}
            tone="paper"
            className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-5 gap-y-2 py-3 lg:flex"
            itemClassName="text-[0.95rem] font-medium leading-snug"
          />
          <div className="ml-auto py-2.5 lg:hidden">
            <MobileNav categories={items} />
          </div>
        </div>
      </div>
    </header>
  );
}
