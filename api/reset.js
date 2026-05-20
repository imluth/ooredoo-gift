// ============================================================
// POST /api/reset
// Header: Authorization: Bearer <ADMIN_TOKEN>
// Clears all inventory + claims and re-seeds.
//
// Set the ADMIN_TOKEN env var in Vercel project settings to a
// long random string. WITHOUT this var set the endpoint refuses
// to run, so leaving it unset is the safest default.
// ============================================================

import { redis } from '../lib/redis.js';
import { INITIAL_INVENTORY, K } from '../lib/items.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(503).json({ error: 'reset_disabled', message: 'ADMIN_TOKEN env var not configured.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== adminToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    await redis.del(K.ITEMS, K.CLAIMS, K.SEED_FLAG);
    await redis.set(K.SEED_FLAG, '1');
    await redis.hset(K.ITEMS, INITIAL_INVENTORY);
    return res.status(200).json({ ok: true, message: 'Vault reset and re-seeded.' });
  } catch (err) {
    console.error('reset error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
