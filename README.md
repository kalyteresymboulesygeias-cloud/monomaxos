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
- `/[slug]/` — άρθρο ή σελίδα (ίδιο slug με WordPress)
- `/category/[slug]/` και `/category/[slug]/page/N/`

## AdSense
Auto ads χρειάζεται μόνο `NEXT_PUBLIC_ADSENSE_CLIENT`. Το `app/layout.tsx` φορτώνει το `adsbygoogle.js` όταν αυτό είναι ορισμένο· οι θέσεις τις αποφασίζει το AdSense.
Τα `NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD`, `_INFEED`, `_ARTICLE` και `_SIDEBAR` είναι προαιρετικά και αφορούν χειροκίνητες μονάδες. Χωρίς slot id, και με ορισμένο client, δεν ζωγραφίζεται κενό πλαίσιο «Διαφήμιση». Αν λείπει και το client id, τα πλαίσια μένουν ως οδηγός διάταξης.

## Επόμενα βήματα για Vercel
1. Push σε GitHub → Import στο Vercel.
2. Env var `NEXT_PUBLIC_ADSENSE_CLIENT` στο Vercel (αρκεί για Auto ads· τα slot ids είναι προαιρετικά).
3. Πριν αλλάξει το DNS: μεταφορά εικόνων (αλλιώς σπάνε όταν κλείσει το Hostinger), `ads.txt` στο `public/`, sitemap/robots, redirects από παλιά URLs.
4. Domain monomaxos.gr στο Vercel → αλλαγή DNS.

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
