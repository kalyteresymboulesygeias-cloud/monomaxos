# Μονομάχος — Next.js (monomaxos.gr)

Rebuild του monomaxos.gr (WordPress) σε Next.js 16 App Router + TypeScript + Tailwind, για deploy στο Vercel.

## Τοπικά
```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-1970116766825015
npm run dev                  # http://localhost:3000
npm run build && npm start
```

## Περιεχόμενο (`content/`)
Εξήχθη από το δημόσιο WP REST API με `node scripts/export-wp.mjs` (ξανατρέξ' το για ανανέωση).
- `categories.json` — 13 κατηγορίες
- `pages.json` — 3 σελίδες
- `posts/posts-001..040.json` — 3.975 άρθρα (100/αρχείο), με content, excerpt, κατηγορίες, tags (ids), featured image URL, Yoast meta description
- `posts-index.json` — ελαφρύ ευρετήριο για λίστες
- `manifest.json` — σύνολα, ώρα εξαγωγής, αποτυχίες

Οι εικόνες παραμένουν απομακρυσμένες (`https://www.monomaxos.gr/wp-content/...`).

## Routes
- `/` και `/page/N/` — τελευταία άρθρα
- `/[slug]/` — άρθρο ή σελίδα (ίδιο slug με WordPress, με κάθετο στο τέλος)
- `/category/[slug]/` και `/category/[slug]/page/N/`

Κανονικός host: `https://monomaxos.gr`. Το `www.monomaxos.gr` κάνει μόνιμη ανακατεύθυνση εκεί. Τα canonical, το sitemap και τα `link` των νέων άρθρων χρησιμοποιούν το apex.

## AdSense
Auto ads χρειάζεται μόνο `NEXT_PUBLIC_ADSENSE_CLIENT`. Το `app/layout.tsx` φορτώνει το `adsbygoogle.js` όταν αυτό είναι ορισμένο· οι θέσεις τις αποφασίζει το AdSense.
Τα `NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD`, `_INFEED`, `_ARTICLE` και `_SIDEBAR` είναι προαιρετικά και αφορούν χειροκίνητες μονάδες. Χωρίς slot id, και με ορισμένο client, δεν ζωγραφίζεται κενό πλαίσιο «Διαφήμιση». Αν λείπει και το client id, τα πλαίσια μένουν ως οδηγός διάταξης.

## Επόμενα βήματα για Vercel
1. Push σε GitHub → Import στο Vercel.
2. Env var `NEXT_PUBLIC_ADSENSE_CLIENT` στο Vercel (αρκεί για Auto ads· τα slot ids είναι προαιρετικά).
3. Πριν αλλάξει το DNS: μεταφορά εικόνων (αλλιώς σπάνε όταν κλείσει το Hostinger), `ads.txt` στο `public/` (ήδη υπάρχει), redirects από παλιά URLs. Το `app/sitemap.ts` και το `app/robots.ts` βγαίνουν στο build.
4. Domain monomaxos.gr στο Vercel → αλλαγή DNS.

## Αυτόματη δημοσίευση

Καθημερινά, ο εξωτερικός operator (ρουτίνα Grok / Cursor agent) γράφει **πρωτότυπο ελληνικό** άρθρο και το περνάει από το script. Το script δεν καλεί API τεχνητής νοημοσύνης, δεν κρατά μυστικά και δεν κατεβάζει κείμενα από άλλους ιστότοπους.

**Το περιεχόμενο πρέπει να είναι πρωτότυπα ελληνικά. Όχι αντιγραφή, όχι scrape, όχι spin/rewrite ξένων άρθρων.** Original Greek only — do not scrape or rewrite third-party articles.

```bash
node scripts/publish-post.mjs --dry-run --file article.json
node scripts/publish-post.mjs --file article.json          # γράφει content/
npm run publish:check                                      # ελέγχοι χωρίς άρθρα στο repo
```

Το JSON (αρχείο ή stdin) χρειάζεται `original: true`, `title`, HTML `content`, `category` (slug ή id), `meta_description`, `image` και `image_alt`. Προαιρετικά: `slug`, `excerpt`, `tags` (μόνο αριθμητικά id — δεν υπάρχει ευρετήριο ονομάτων), `date` (`YYYY-MM-DDTHH:mm:ss`, ώρα Αθήνας), `image_width`, `image_height`.

Μετά από επιτυχές publish: commit στα `content/posts/posts-NNN.json`, `content/posts-index.json`, `content/categories.json` και deploy. Το sitemap ξαναχτίζεται στο `next build` και πιάνει όλα τα άρθρα, τις κατηγορίες με άρθρα και τις στατικές σελίδες. Το `robots.txt` δείχνει στο `https://monomaxos.gr/sitemap.xml` και δεν μπλοκάρει το AdSense.

### Τι γράφει
- Έλεγχος μοναδικού slug (ευρετήριο + σελίδες) και μοναδικού τίτλου/meta.
- Id: μέγιστο υπάρχον id (άρθρο ή `featured_media`) + 1. Το `featured_media` παίρνει το επόμενο νούμερο, οπότε τα id άρθρων ανεβαίνουν ανά 2, όπως στο export (π.χ. 12063 / 12064).
- Shard 100 άρθρων, νεότερο πρώτο. Το `posts-001.json` είναι γεμάτο· το επόμενο άρθρο ανοίγει `posts-041.json`. Το ευρετήριο μένει νεότερο-πρώτο.
- `link`: `https://monomaxos.gr/{slug}/`.
- Αν λείπει η αποποίηση, προστίθεται η παράγραφος που ήδη χρησιμοποιούν τα πρόσφατα άρθρα (`<p><em>Αποποίηση ευθύνης: …</em></p>`).
- Αυξάνει το `count` μόνο της κατηγορίας του άρθρου. Ο γονέας «Υγεία» μένει στο 0, όπως στο export.

### Εικόνες και R2
Το `lib/media.ts` αλλάζει URL μόνο αν υπάρχει ήδη ως κλειδί στο `content/media-map.json`. Νέα αρχεία **δεν** καταχωρούνται εκεί. Ανέβασε το αρχείο στο R2 στο `wp-content/uploads/...` και δώσε απόλυτο URL (`NEXT_PUBLIC_MEDIA_BASE` + το path). Σχετικό `/wp-content/uploads/...` γίνεται απόλυτο μόνο αν οριστεί `--media-base` ή `NEXT_PUBLIC_MEDIA_BASE`.

### Checklist SEO
- Μοναδικός τίτλος και μοναδικό meta description (περίπου 50–160 χαρακτήρες).
- Σώμα με ενότητες `<h2>` (ο τίτλος της σελίδας είναι ήδη το μοναδικό H1).
- Τουλάχιστον ένας εσωτερικός σύνδεσμος προς σχετικό άρθρο ή κατηγορία του monomaxos.gr.
- Μοναδικό slug· το script απορρίπτει διπλότυπο.
- Ρυθμός: 1–2 πρωτότυπα άρθρα την ημέρα. Από το τρίτο την ίδια ημερομηνία το script προειδοποιεί.
- Featured image με alt. Χωρίς script, iframe ή inline handlers στο HTML.

Το `--dry-run` τυπώνει το άρθρο και τα αρχεία που θα έγραφε, χωρίς να αγγίζει το `content/`. Τρέξτε μία δημοσίευση τη φορά: το script ξαναγράφει ολόκληρο το ευρετήριο.

## Καθαρισμός περιεχομένου
`node scripts/clean-content.mjs` — αποκωδικοποιεί HTML entities (κρατά τα `&lt; &gt; &amp; &quot;`) και αφαιρεί αρχικό `<h1>` μόνο αν ταυτίζεται με τον τίτλο. Τα πρωτότυπα σώζονται στο `content-orig/`· επαναφορά με `--restore`. Μετά από νέο export: σβήσε το `content-orig/` και ξανατρέξε το.

## Εικόνες / Media migration
**Γιατί:** οι εικόνες φορτώνονται ακόμα από `https://www.monomaxos.gr/wp-content/uploads/...` (Hostinger). Αν κλείσει το Hostinger ή αλλάξει το DNS του domain προς Vercel, σπάνε.
**Why:** images are still hot-linked from Hostinger; they break once the domain points to Vercel.

- Μέγεθος: ~4.100 μοναδικά URLs, ~1,8 GB (εκτίμηση από δείγμα 200, μέσος όρος ~450 KB). Πλήρης λήψη: ~15–40 λεπτά με concurrency 6.
- Dry-run (μόνο μέτρηση): `node scripts/migrate-images.mjs`
- Δείγμα: `node scripts/migrate-images.mjs --download --limit 20`
- Πλήρες: `node scripts/migrate-images.mjs --download` (ξανατρέχει με skip-if-exists· αποτυχίες στο `content/media-failures.json`)
- Αρχεία → `public/wp-content/uploads/...` (ίδια διαδρομή με WP), χάρτης → `content/media-map.json`.
- Το rewrite γίνεται **κατά το render** (`lib/media.ts`): περιεχόμενο, featured image, λίστες, OG. Μόνο όσα URL υπάρχουν στο map αλλάζουν· τα υπόλοιπα μένουν στο Hostinger. Το JSON δεν αλλάζει.
- `NEXT_PUBLIC_MEDIA_BASE` (π.χ. `https://media.monomaxos.gr`): αν οριστεί, τα rewritten paths γίνονται `${MEDIA_BASE}/wp-content/uploads/...`.

### Σύσταση (το πιο εύκολο, δωρεάν)
**Cloudflare R2** (10 GB δωρεάν, χωρίς χρέωση egress): ανέβασε τον φάκελο `public/wp-content` σε bucket (π.χ. με `rclone copy public/wp-content r2:monomaxos-media/wp-content`), σύνδεσε custom domain `media.monomaxos.gr`, όρισε `NEXT_PUBLIC_MEDIA_BASE=https://media.monomaxos.gr` στο Vercel, και **μην** κάνεις commit το `public/wp-content` (πρόσθεσέ το στο `.gitignore`).
Γιατί όχι στο ίδιο repo/Vercel: ~1,8 GB βαραίνει το git και τα deploys, και το Vercel Hobby έχει όριο bandwidth (~100 GB/μήνα) και image optimization — με traffic από AdSense άρθρα οι εικόνες είναι το μεγαλύτερο κόστος. Εναλλακτικά: κράτα προσωρινά το Hostinger μόνο για media σε subdomain.

## PageSpeed: μέγεθος εικόνας και cache

Οι κάρτες, το εξώφυλλο και οι `<img>` μέσα στο άρθρο περνούν από το Next.js Image Optimization (`/_next/image`). Ο browser παίρνει WebP ή AVIF στο πλάτος του `sizes`· lazy παντού εκτός από την εικόνα LCP (`preload` + `fetchpriority="high"`). Τα πρωτότυπα στο R2 δεν ξανασυμπιέζονται.

Τα hashed αρχεία στο `/_next/static` έχουν ήδη `Cache-Control: public, max-age=31536000, immutable` από το Next.js. Το `headers()` στο `next.config` δεν μπορεί να το αλλάξει.

Οι απαντήσεις του `/_next/image` χρησιμοποιούν `images.minimumCacheTTL` (1 χρόνος: `public, max-age=31536000, must-revalidate`), επειδή το public R2 host δεν στέλνει Cache-Control. Ο browser δεν ζητά πια το αρχείο του R2 για αυτές τις εικόνες· το optimizer το κατεβάζει server-side.

Για απευθείας αιτήματα (OG, παλιά URL) το header μπαίνει στα αντικείμενα του bucket, όχι από αυτή την εφαρμογή (δεν υπάρχουν Cloudflare credentials εδώ):

```
Cache-Control: public, max-age=31536000, immutable
```

Νέο ανέβασμα με rclone (δεν ξανακωδικοποιεί τα bytes):

```bash
rclone copy public/wp-content r2:BUCKET/wp-content \
  --header-upload "Cache-Control: public, max-age=31536000, immutable"
```

Για το ήδη ανεβασμένο corpus, το ίδιο header χωρίς νέο encode γίνεται με S3 `CopyObject` (`MetadataDirective=REPLACE`, ίδιο key) ή με Worker μπροστά από το custom domain του bucket:

```js
export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    const key = new URL(request.url).pathname.replace(/^\//, "");
    const object = await env.MEDIA.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    return new Response(object.body, { headers });
  },
};
```
