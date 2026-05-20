// ============================================================
// GET /api/state
// Returns: { items: { item_id: remaining_qty }, claims: { staff_id: {...} } }
// Auto-seeds the inventory on first call (idempotent).
// ============================================================

import { redis } from '../lib/redis.js';
import { INITIAL_INVENTORY, K } from '../lib/items.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    // Atomic-ish seed: only one process wins the SETNX. Others skip.
    const seeded = await redis.set(K.SEED_FLAG, '1', { nx: true });
    if (seeded === 'OK') {
      // First boot — populate the inventory hash.
      await redis.hset(K.ITEMS, INITIAL_INVENTORY);
    }

    const [items, claims] = await Promise.all([
      redis.hgetall(K.ITEMS),
      redis.hgetall(K.CLAIMS),
    ]);

    // Upstash returns hash values as parsed JSON when they look like JSON,
    // and as strings otherwise. Normalize both sides.
    const itemsOut = {};
    for (const [id, qty] of Object.entries(items || {})) {
      itemsOut[id] = typeof qty === 'number' ? qty : parseInt(qty, 10);
    }
    const claimsOut = {};
    for (const [sid, val] of Object.entries(claims || {})) {
      claimsOut[sid] = typeof val === 'string' ? JSON.parse(val) : val;
    }

    // Don't cache — state changes every claim.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ items: itemsOut, claims: claimsOut });
  } catch (err) {
    console.error('state error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
