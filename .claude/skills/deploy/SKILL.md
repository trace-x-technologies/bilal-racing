---
name: deploy
description: Build and deploy the Bilal Racing site to Cloudflare Workers (static assets) with the Wrangler CLI, then verify it live at https://bilal.tracex.tech. Use when asked to deploy, publish, ship, redeploy or roll back the site, or to check why a deploy failed.
---

# Deploy Bilal Racing to Cloudflare (Wrangler CLI)

The site is fully static: `astro build` writes `dist/`, and `wrangler deploy` uploads it as a
Worker with static assets (config: `wrangler.jsonc`). There is no server code and no secrets
in the repo. Production = the `main` branch.

## 0. Preconditions (check, don't assume)

```bash
node -v                      # must be >= 22.12 (see .nvmrc / package.json engines)
git status --short           # clean tree
git rev-parse --abbrev-ref HEAD   # normally `main`; say so if deploying another branch
npm ci                       # exact lockfile install
```

## 1. Cloudflare auth

```bash
npx wrangler whoami
```

- **Not logged in** → the human runs `npx wrangler login` (opens a browser for OAuth). Don't
  try to automate the browser step; ask them to run it (they can type `! npx wrangler login`).
- **Non-interactive alternative**: export `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID` if
  the token sees several accounts). Token template "Edit Cloudflare Workers" is enough; the
  custom domain additionally needs Zone → DNS: Edit and Workers Routes: Edit on `tracex.tech`.
  Never write a token into the repo, `.env` files, or command output you echo back.
- `whoami` lists the accounts. The one you deploy to **must also own the `tracex.tech` zone**
  (the `routes` entry uses `custom_domain: true`). If it doesn't, stop and ask: either add the
  zone to that account, or deploy to `*.workers.dev` only by removing the `routes` block.

## 2. Validate without publishing

```bash
npm run deploy:dry   # astro check → astro build → wrangler deploy --dry-run
```

Expect `0 errors` from `astro check`, `[build] Complete!`, and
`✨ Read ~390 files from the assets directory …/dist` with `--dry-run: exiting now.`
Optional local look at the real Workers asset behaviour (404 page, `_headers`):

```bash
npm run preview:cf   # http://localhost:8787 — try / and /this-does-not-exist
```

## 3. Deploy (production — confirm first)

This publishes to the public internet. Unless the user already explicitly asked to deploy in
this conversation, confirm before running:

```bash
npm run deploy       # astro check → astro build → wrangler deploy
```

Wrangler prints the deployment ID, the `*.workers.dev` URL and `bilal.tracex.tech` as a custom
domain. The first custom-domain deploy can take a few minutes for DNS + certificate.

Common failures:
- *"Hostname already has externally managed DNS records"* → an existing DNS record for
  `bilal.tracex.tech` is in the way. Ask the owner before deleting it in the dashboard, then redeploy.
- *"Could not find zone for bilal.tracex.tech"* / auth error 10000 → wrong account or token
  permissions (step 1).
- Asset limits: max 20,000 files and 25 MiB per file — the build is ~390 files, largest < 1 MB.

## 4. Verify live

```bash
curl -sSI https://bilal.tracex.tech/ | head -n 20          # 200, content-type text/html,
                                                          # x-robots-tag: noindex, nofollow
curl -sSI https://bilal.tracex.tech/og.png | head -n 5     # 200 image/png (link previews)
curl -sS -o /dev/null -w "%{http_code}\n" https://bilal.tracex.tech/definitely-missing   # 404
curl -sS https://bilal.tracex.tech/robots.txt
```

Optionally screenshot it: `node tools/shoot.mjs --url https://bilal.tracex.tech/ --out /tmp/live/home`
(needs `npx playwright-core install chromium` once, or `CHROME_PATH`). The page must log no
console errors.

## 5. Roll back

```bash
npx wrangler deployments list
npx wrangler rollback            # previous version; or `npx wrangler rollback <version-id>`
```

## Rules

- Deploy only what is committed on `main` (or what the user explicitly names). Never deploy a
  dirty tree.
- Don't change `wrangler.jsonc` routes, the Worker `name`, or DNS without asking.
- Privacy: the site is intentionally `noindex` (meta tag, `X-Robots-Tag` in `public/_headers`,
  `robots.txt`). Keep it that way.
- After a deploy that changes the preview image, WhatsApp may cache the old one; share the link
  with a query string (e.g. `?v=2`) to refresh it.
