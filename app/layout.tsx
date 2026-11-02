import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { getNavCategories } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.monomaxos.gr"),
  title: { default: "Μονομάχος", template: "%s | Μονομάχος" },
  description: "Ενημέρωση για υγεία, διατροφή και ευεξία.",
};

const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // e.g. ca-pub-1970116766825015

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = getNavCategories();
  return (
    <html lang="el">
      <body className="bg-white text-gray-900 antialiased">
        {ADSENSE && (
          <Script async strategy="afterInteractive" crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} />
        )}
        <header className="border-b border-gray-200">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <Link href="/" className="text-2xl font-bold text-emerald-700">Μονομάχος</Link>
            <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {nav.map(c => <Link key={c.id} href={`/category/${c.slug}`} className="hover:text-emerald-700">{c.name}</Link>)}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">© {new Date().getFullYear()} Μονομάχος</footer>
      </body>
    </html>
  );
}
