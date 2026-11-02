import Link from "next/link";
export default function Pagination({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base || "/" : `${base}/page/${n}`);
  return (
    <nav className="mt-10 flex justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)}>← Νεότερα</Link> : <span />}
      <span className="text-gray-500">Σελίδα {page} / {pages}</span>
      {page < pages ? <Link href={href(page + 1)}>Παλαιότερα →</Link> : <span />}
    </nav>
  );
}
