import Link from "next/link";

export default function Pagination({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base || "/" : `${base}/page/${n}`);
  const linkClass = "rounded-full border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-pine hover:text-pine";
  return (
    <nav aria-label="Σελιδοποίηση" className="mt-12 flex items-center justify-between gap-3 border-t border-line pt-6">
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          Νεότερα
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Σελίδα {page} από {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          Παλαιότερα
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
