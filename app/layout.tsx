import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import AdSlot from "@/components/AdSlot";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { adSlotVisible, adsenseClient } from "@/lib/ads";
import { getNavCategories } from "@/lib/content";
import { SITE_ORIGIN } from "@/lib/site";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin", "greek"],
  variable: "--font-sans-src",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin", "greek"],
  style: ["normal", "italic"],
  variable: "--font-serif-src",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "Μονομάχος", template: "%s | Μονομάχος" },
  description: "Ενημέρωση για υγεία, διατροφή και ευεξία.",
};

const ADSENSE = adsenseClient();
const LEADERBOARD = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = getNavCategories();
  return (
    <html lang="el" className={`${sans.variable} ${serif.variable}`}>
      <body className="bg-paper text-ink antialiased">
        {ADSENSE ? (
          <Script
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
          />
        ) : null}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2"
        >
          Μετάβαση στο περιεχόμενο
        </a>
        <div className="hidden bg-pine text-sm text-paper sm:block">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-2.5">
            <p className="font-medium">Περιοδικό υγείας και ευεξίας</p>
            <p className="text-paper/85">Υγεία · Ομορφιά · Διατροφή · Ψυχική υγεία</p>
          </div>
        </div>
        <SiteHeader categories={nav} />
        {adSlotVisible(LEADERBOARD) ? (
          <div className="mx-auto max-w-6xl px-4 pt-4">
            <AdSlot format="leaderboard" slot={LEADERBOARD} />
          </div>
        ) : null}
        <main id="content" className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          {children}
        </main>
        <SiteFooter categories={nav} />
      </body>
      <GoogleAnalytics gaId="G-G672FH8S48" />
    </html>
  );
}
