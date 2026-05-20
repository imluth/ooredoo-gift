// ============================================================
// Upstash Redis client — auto-configured from env vars.
// Vercel's Upstash Marketplace integration sets KV_REST_API_*.
// Falling back to UPSTASH_REDIS_REST_* if you wired it manually.
// ============================================================

import { Redis } from '@upstash/redis';

const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  // This will surface as a 500 in the function logs — easy to debug.
  console.error('Upstash Redis env vars missing. Install Upstash from Vercel Marketplace.');
}

export const redis = new Redis({ url, token });
