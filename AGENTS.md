<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- `npm ci` installs dependencies. Copy `.env.example` to `.env.local` when that file is missing. Those values are a public AdSense client and a public media base; the site still renders if they are absent.
- `npm run dev` serves the app on port 3000. Articles come from the JSON under `content/`. There is no database and no automated test suite.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` are the checks. The production build prerenders archive pages and the newest 200 articles.
