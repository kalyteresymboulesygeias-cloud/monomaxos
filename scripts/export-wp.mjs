// Export monomaxos.gr content from public WP REST API
import fs from 'node:fs/promises';
import path from 'node:path';
const BASE = process.env.WP_BASE || 'https://www.monomaxos.gr/wp-json/wp/v2';
const OUT = path.resolve('content');
const failures = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'monomaxos-export/1.0' } });
      if (r.ok) return { data: await r.json(), total: +r.headers.get('x-wp-total'), pages: +r.headers.get('x-wp-totalpages') };
      if (r.status !== 429 && r.status < 500) throw Object.assign(new Error('HTTP ' + r.status), { fatal: true });
      console.warn(`  ${r.status} on ${url}, retry ${i + 1}`);
    } catch (e) { if (e.fatal) throw e; console.warn(`  ${e.message}, retry ${i + 1}`); }
    await sleep(Math.min(60000, 1000 * 2 ** i));
  }
  throw new Error('Gave up: ' + url);
}
async function all(endpoint, map, onPage) {
  const out = []; let page = 1, pages = 1, total = 0;
  do {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${BASE}/${endpoint}${sep}per_page=100&page=${page}`;
    try {
      const r = await get(url); pages = r.pages || 1; total = r.total;
      const items = r.data.map(map); out.push(...items);
      if (onPage) await onPage(page, items);
      console.log(`${endpoint.split('?')[0]} page ${page}/${pages} (${out.length}/${total})`);
    } catch (e) { failures.push({ url, error: e.message }); console.error(e.message); }
    page++; await sleep(300);
  } while (page <= pages);
  return { out, total };
}
const fm = (p) => { const m = p._embedded?.['wp:featuredmedia']?.[0]; return m?.source_url ? { url: m.source_url, alt: m.alt_text || '', width: m.media_details?.width, height: m.media_details?.height } : null; };
await fs.mkdir(path.join(OUT, 'posts'), { recursive: true });
const cats = await all('categories', c => ({ id: c.id, name: c.name, slug: c.slug, count: c.count, parent: c.parent, description: c.description }));
await fs.writeFile(path.join(OUT, 'categories.json'), JSON.stringify(cats.out, null, 2));
const pages = await all('pages?_embed=wp:featuredmedia', p => ({ id: p.id, slug: p.slug, title: p.title, content: { rendered: p.content.rendered }, date: p.date, modified: p.modified, link: p.link, featured_media: p.featured_media, featured_image: fm(p), meta_description: p.yoast_head_json?.description || null }));
await fs.writeFile(path.join(OUT, 'pages.json'), JSON.stringify(pages.out, null, 2));
const index = [];
const posts = await all('posts?_embed=wp:featuredmedia', p => ({
  id: p.id, slug: p.slug, title: p.title, content: { rendered: p.content.rendered }, excerpt: { rendered: p.excerpt.rendered },
  date: p.date, modified: p.modified, link: p.link, categories: p.categories, tags: p.tags, featured_media: p.featured_media,
  featured_image: fm(p), meta_description: p.yoast_head_json?.description || null, og_image: p.yoast_head_json?.og_image?.[0]?.url || null,
}), async (n, items) => {
  await fs.writeFile(path.join(OUT, 'posts', `posts-${String(n).padStart(3, '0')}.json`), JSON.stringify(items));
  for (const p of items) index.push({ id: p.id, slug: p.slug, date: p.date, title: p.title.rendered, categories: p.categories, image: p.featured_image?.url || null, file: `posts-${String(n).padStart(3, '0')}.json` });
});
index.sort((a, b) => b.date.localeCompare(a.date));
await fs.writeFile(path.join(OUT, 'posts-index.json'), JSON.stringify(index));
const ts = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Athens' }) + ' Europe/Athens';
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ source: BASE, exported_at: ts, totals: { posts: posts.out.length, posts_reported: posts.total, pages: pages.out.length, categories: cats.out.length }, failures }, null, 2));
console.log('done', posts.out.length, pages.out.length, cats.out.length, 'failures', failures.length);
