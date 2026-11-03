import Link from "next/link";
import type { NavCategory } from "@/components/CategoryNav";
import { displayName } from "@/components/editorial";

export default function SiteFooter({ categories }: { categories: NavCategory[] }) {
  return (
    <footer className="mt-8 border-t border-line bg-paper-deep/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl text-pine">Μονομάχος</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Περιοδικό για υγεία, ομορφιά, διατροφή και ψυχική ισορροπία. Ήρεμη ανάγνωση, χωρίς θόρυβο.
          </p>
        </div>
        <div>
          <h2 className="text-xs tracking-[0.16em] text-pine">Ενότητες</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/category/${category.slug}`} className="text-ink hover:text-pine">
                  {displayName(category.name)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs tracking-[0.16em] text-pine">Πληροφορίες</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/privacy-policy" className="hover:text-pine">
                Πολιτική απορρήτου
              </Link>
            </li>
            <li>
              <Link href="/terms-conditions" className="hover:text-pine">
                Όροι χρήσης
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">© {new Date().getFullYear()} Μονομάχος</p>
      </div>
    </footer>
  );
}
