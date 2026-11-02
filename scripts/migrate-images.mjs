// Migrate WP media off Hostinger.
// Usage:
//   node scripts/migrate-images.mjs                 # dry-run: count URLs, sample sizes (HEAD)
//   node scripts/migrate-images.mjs --download --limit 20
//   node scripts/migrate-images.mjs --download      # full run (all URLs)
// Options: --concurrency 6  --out public  --sample 200
// Files go to <out>/wp-content/uploads/... (same path as WP). Map: content/media-map.json {absUrl: "/wp-content/uploads/..."}
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]); };
const DOWNLOAD = !!arg('download', false), LIMIT = +arg('limit', 0) || Infinity, CONC = +arg('concurrency', 6), OUT = path.resolve(arg('out', 'public')), SAMPLE = +arg('sample', 200);
const C = path.resolve('content'), MAP = path.join(C, 'media-map.json');
const RE = /https?:\/\/(?:www\.)?monomaxos\.gr\/wp-content\/uploads\/[^\s"'<>),]+?\.(?:jpe?g|png|gif|webp|avif|svg)/gi;
const urls = new Set();
const add = (s) => { for (const m of (s || '').matchAll(RE)) urls.add(m[0].replace(/^http:/, 'https:').replace('://monomaxos', '://www.monomaxos')); };
for (const f of fs.readdirSync(path.join(C, 'posts'))) for (const p of JSON.parse(fs.readFileSync(path.join(C, 'posts', f)))) { add(p.featured_image?.url); add(p.og_image); add(p.content.rendered); }
for (const p of JSON.parse(fs.readFileSync(path.join(C, 'pages.json')))) add(p.content.rendered);
const list = [...urls].sort();
const local = (u) => decodeURIComponent(new URL(u).pathname);
const featured = list.filter(u => !/-\d+x\d+\.\w+$/.test(u)).length;
console.log(`unique image URLs: ${list.length} (originals: ${featured}, resized variants: ${list.length - featured})`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function pool(items, fn) { let i = 0; await Promise.all(Array.from({ length: CONC }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

if (!DOWNLOAD) {
  const step = Math.max(1, Math.floor(list.length / SAMPLE)); const sample = list.filter((_, i) => i % step === 0).slice(0, SAMPLE);
  let bytes = 0, ok = 0;
  await pool(sample, async (u) => { try { const r = await fetch(u, { method: 'HEAD' }); const n = +r.headers.get('content-length'); if (r.ok && n) { bytes += n; ok++; } } catch {} });
  const avg = ok ? bytes / ok : 0;
  console.log(`sampled ${ok}/${sample.length}: avg ${(avg / 1024).toFixed(0)} KB -> est. total ${(avg * list.length / 1024 ** 3).toFixed(2)} GB`);
  console.log('dry-run only. Add --download [--limit N] to fetch.');
  process.exit(0);
}
const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP)) : {};
const todo = list.slice(0, LIMIT); let done = 0, skipped = 0, failed = [];
await pool(todo, async (u) => {
  const rel = local(u), dest = path.join(OUT, rel);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { map[u] = rel; skipped++; return; }
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(u);
      if (r.ok) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); map[u] = rel; done++; break; }
      if (r.status === 404) { failed.push({ u, status: 404 }); break; }
      if (r.status !== 429 && r.status < 500) { failed.push({ u, status: r.status }); break; }
    } catch (e) { if (t === 4) failed.push({ u, error: e.message }); }
    await sleep(1000 * 2 ** t);
  }
  if ((done + skipped) % 50 === 0) console.log(`progress ${done + skipped + failed.length}/${todo.length}`);
});
fs.writeFileSync(MAP, JSON.stringify(map, null, 1));
if (failed.length) fs.writeFileSync(path.join(C, 'media-failures.json'), JSON.stringify(failed, null, 1));
console.log({ downloaded: done, skipped, failed: failed.length, mapEntries: Object.keys(map).length });
