import type { Metadata } from "next";
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
  weight: "400",
  variable: "--font-serif-src",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "Μονομάχος", template: "%s | Μονομάχος" },
  description: "Ενημέρωση για υγεία, διατροφή και ευεξία.",
  alternates: { types: { "application/rss+xml": [{ url: "/feed/", title: "Μονομάχος" }] } },
};

const ADSENSE = adsenseClient();
const LEADERBOARD = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = getNavCategories();
  return (
    <html lang="el" className={`${sans.variable} ${serif.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <Script id="gtm" strategy="lazyOnload">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
          var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
          j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-NSH3BN3V');
        `}</Script>
        {ADSENSE ? (
          <Script
            async
            strategy="lazyOnload"
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
    </html>
  );
}
