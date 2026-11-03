import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-[11px] tracking-[0.16em] text-pine">404</p>
      <h1 className="mt-3 font-serif text-4xl text-ink">Η σελίδα δεν βρέθηκε</h1>
      <p className="mt-3 text-muted">Το άρθρο μπορεί να άλλαξε διεύθυνση ή να μην υπάρχει πια.</p>
      <Link href="/" className="mt-6 inline-flex rounded-full bg-pine px-5 py-2.5 text-sm text-paper hover:bg-pine-deep">
        Επιστροφή στην αρχική
      </Link>
    </div>
  );
}
