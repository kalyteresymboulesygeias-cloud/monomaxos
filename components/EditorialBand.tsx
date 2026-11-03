import Link from "next/link";

export default function EditorialBand() {
  return (
    <section className="rounded-2xl bg-pine px-6 py-10 text-paper sm:px-10 sm:py-12">
      <p className="text-[11px] tracking-[0.18em] text-foam">Η ματιά του Μονομάχου</p>
      <h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight sm:text-4xl">
        Καθαρή ανάγνωση για υγεία, διατροφή και ευεξία.
      </h2>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-foam">
        Χωρίς κραυγαλέους τίτλους. Διαλέξτε μια ενότητα και μείνετε σε ό,τι σας αφορά.
      </p>
      <Link
        href="/category/ygeia-diatrofi"
        className="mt-6 inline-flex rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-pine transition-colors hover:bg-foam"
      >
        Υγεία & διατροφή
      </Link>
    </section>
  );
}
