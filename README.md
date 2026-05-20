# Ooredoo Staff Rewards Vault

Single-page web app for distributing electronic items to Ooredoo Maldives staff on a first-come-first-serve basis. Deployed as a static frontend + serverless functions on Vercel, with Upstash Redis as the atomic state store.

## What it does

- Staff log in with a Staff ID
- They see a gamified grid of 25 electronic items (Legendary / Epic / Rare / Common rarity tiers based on scarcity)
- Clicking **Claim** reserves one unit of that item to their Staff ID
- The decrement is atomic on the Redis server via a Lua script, so even thousands of concurrent claims are race-safe
- Each Staff ID can claim exactly one item, forever
- Stock zero → big animated "Sold Out" stamp
- Live polling means other staff's claims appear in your UI within ~4 seconds
- ICT team can download a CSV audit log of all claims

## Project structure

```
.
├── index.html            # frontend (static, ~328 KB with embedded images)
├── api/
│   ├── state.js          # GET  /api/state   → inventory + claims; auto-seeds on first call
│   ├── claim.js          # POST /api/claim   → atomic FCFS claim (Lua script)
│   ├── reset.js          # POST /api/reset   → admin-only, clears + re-seeds the vault
│   └── audit.js          # GET  /api/audit   → admin-only, downloads claims as CSV
├── lib/
│   ├── items.js          # ESM module — constants + Redis key names
│   ├── items-data.json   # 25-item catalog (IDs + names + initial qty)
│   └── redis.js          # Upstash Redis client factory
├── package.json
├── vercel.json
└── README.md
```

## Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial deploy: Ooredoo Staff Rewards Vault"
git push origin main
```

### 2. Import in Vercel

- Go to **vercel.com → Add New → Project → Import** your `imluth/ooredoo-gift` repo
- **Application Preset:** `Other` (the very last option, alphabetically near the bottom)
- Leave all build settings blank — Vercel auto-detects the `api/` folder as Serverless Functions and serves `index.html` as static
- Click **Deploy** (it will fail or work without Redis — that's fine, we add it next)

### 3. Add Upstash Redis

> Vercel KV was retired in December 2024 and migrated to Upstash. New projects use Upstash directly via the Vercel Marketplace.

- In your Vercel project → **Storage → Marketplace → Upstash → Redis**
- Click **Add Integration**, select your project, accept defaults
- Vercel auto-creates these env vars on your project:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- The free Upstash plan covers ~10k commands/day, more than enough for staff distribution

### 4. (Optional) Add the admin token

For the `/api/reset` and `/api/audit` endpoints to work:

- **Vercel project → Settings → Environment Variables → Add**
- Key: `ADMIN_TOKEN`
- Value: a long random string (`openssl rand -hex 32` is fine)
- Apply to: Production, Preview, Development

Without this env var set, both admin endpoints refuse to run — a safe default.

### 5. Redeploy

- **Vercel project → Deployments → … → Redeploy** the latest commit so the new env vars are picked up

You're live. Open the production URL, log in with any Staff ID, and claim.

## Admin operations

### Reset the vault (clears all claims)

```bash
curl -X POST https://ooredoo-gift.vercel.app/api/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Download the audit CSV

```bash
curl -O -J https://ooredoo-gift.vercel.app/api/audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Opens as `ooredoo-vault-claims-<timestamp>.csv` with columns: staff_id, item_id, item_name, claimed_at_iso, claimed_at_ts.

## Customizing the catalog

To change items or quantities:

1. Edit `lib/items-data.json` (IDs and quantities — backend uses these to seed and validate)
2. Edit the `ITEMS` array inside `index.html` (the frontend has its own embedded copy with image data URLs — both lists must stay in sync on `id`)
3. After deploy, hit `/api/reset` (with the admin token) to re-seed Redis with the new quantities

## Local development

```bash
npm install
npx vercel dev
```

Then open `http://localhost:3000`. You'll need a `.env.local` file with the Upstash credentials (`npx vercel env pull .env.local` after linking the project).

## Tech notes

- **Atomicity:** the claim endpoint runs a Lua script via `redis.eval(...)`. Lua runs single-threaded on the Redis server, so the read-check-decrement-record sequence cannot interleave with another claim — no race window.
- **Items list source of truth:** `lib/items-data.json` for backend, embedded `ITEMS` array in `index.html` for frontend. Both reference items by `id`. If you change one without the other, the API will return items the frontend doesn't know how to render (or vice versa).
- **Polling cost:** the frontend polls `/api/state` every 4 seconds while the tab is focused, 15 seconds when hidden. For 100 concurrent staff this is ~1,500 reads/minute, well within Upstash free tier.
- **Cold starts:** first request after idle may take 1–2 seconds (Vercel function cold start + Upstash cold start). Subsequent requests are fast.

## Author

Looth Ibrahim · Ooredoo Maldives ICT · 2026
