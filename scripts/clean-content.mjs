// One-time cleanup of exported WP content. Reversible: originals backed up to content-orig/
// (restore: node scripts/clean-content.mjs --restore). Idempotent: always cleans from the backup.
import fs from 'node:fs';
import path from 'node:path';
import { decode } from 'he';
const C = path.resolve('content'), B = path.resolve('content-orig');
const files = ['pages.json', 'posts-index.json', ...fs.readdirSync(path.join(C, 'posts')).map(f => 'posts/' + f)];
if (process.argv.includes('--restore')) { for (const f of files) fs.copyFileSync(path.join(B, f), path.join(C, f)); console.log('restored'); process.exit(0); }
if (!fs.existsSync(B)) { fs.mkdirSync(path.join(B, 'posts'), { recursive: true }); for (const f of files) fs.copyFileSync(path.join(C, f), path.join(B, f)); }

// Decode entities but keep HTML-significant ones (&lt; &gt; &amp; &quot; &apos;) encoded,
// so markup stays valid and nothing is double-decoded. Single pass over the original string.
const KEEP = new Set(['<', '>', '&', '"', "'"]);
const safeDecode = s => typeof s !== 'string' ? s : s.replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, m => { const d = decode(m); return KEEP.has(d) ? m : d; });
const norm = s => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim().toLowerCase();
// Leading <br>s/whitespace/empty <p>, then <h1>..</h1> matching the title (+ following <br>s)
const LEAD = /^(?:\s|<br\s*\/?>|<p>\s*(?:&nbsp;|\u00a0)?\s*<\/p>)*<h1\b[^>]*>([\s\S]*?)<\/h1>(?:\s|<br\s*\/?>)*/i;
let stats = { decoded: 0, stripped: 0, h1NoMatch: [] };
function clean(p) {
  const before = JSON.stringify(p);
  p.title.rendered = safeDecode(p.title.rendered);
  p.content.rendered = safeDecode(p.content.rendered);
  if (p.excerpt) p.excerpt.rendered = safeDecode(p.excerpt.rendered);
  if (p.meta_description) p.meta_description = safeDecode(p.meta_description);
  if (JSON.stringify(p) !== before) stats.decoded++;
  const m = p.content.rendered.match(LEAD);
  if (m) {
    if (norm(m[1]) === norm(p.title.rendered)) { p.content.rendered = p.content.rendered.slice(m[0].length); stats.stripped++; }
    else stats.h1NoMatch.push(p.slug);
  }
  return p;
}
for (const f of files) {
  let data = JSON.parse(fs.readFileSync(path.join(B, f), 'utf8'));
  if (f === 'posts-index.json') data = data.map(i => ({ ...i, title: safeDecode(i.title) }));
  else data = data.map(clean);
  fs.writeFileSync(path.join(C, f), f.startsWith('posts/') || f === 'posts-index.json' ? JSON.stringify(data) : JSON.stringify(data, null, 2));
}
console.log({ decoded: stats.decoded, stripped: stats.stripped, leadingH1NotMatchingTitle: stats.h1NoMatch.length, sample: stats.h1NoMatch.slice(0, 5) });
