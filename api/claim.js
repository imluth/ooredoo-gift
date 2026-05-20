// ============================================================
// POST /api/claim
// Body: { staffId: string, itemId: string }
// Returns: { ok: true, claim: {...} }
//       or { ok: false, error: 'already_claimed'|'sold_out'|'invalid_item'|'bad_request', claim?: {...} }
//
// Uses a Lua script so the read-check-decrement-record sequence
// is atomic on the Redis server. No race conditions even with
// thousands of staff hitting the same item simultaneously.
// ============================================================

import { redis } from '../lib/redis.js';
import { ITEM_BY_ID, K } from '../lib/items.js';

// KEYS[1] = items hash, KEYS[2] = claims hash
// ARGV[1] = staff_id, ARGV[2] = item_id, ARGV[3] = claim_json
const CLAIM_LUA = `
local existing = redis.call('HGET', KEYS[2], ARGV[1])
if existing then
  return {'already_claimed', existing}
end
local remaining = redis.call('HGET', KEYS[1], ARGV[2])
if not remaining then
  return {'invalid_item', ''}
end
remaining = tonumber(remaining)
if remaining == nil or remaining <= 0 then
  return {'sold_out', ''}
end
redis.call('HINCRBY', KEYS[1], ARGV[2], -1)
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
return {'ok', ''}
`;

const STAFF_ID_RE = /^[A-Z0-9-]{3,20}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const staffId = String(body?.staffId || '').trim().toUpperCase();
  const itemId  = String(body?.itemId  || '').trim();

  if (!STAFF_ID_RE.test(staffId)) {
    return res.status(400).json({ ok: false, error: 'bad_request', message: 'Invalid staff ID' });
  }
  const item = ITEM_BY_ID[itemId];
  if (!item) {
    return res.status(400).json({ ok: false, error: 'invalid_item' });
  }

  const claimRecord = {
    itemId,
    itemName: item.name,
    ts: Date.now(),
  };

  try {
    const result = await redis.eval(
      CLAIM_LUA,
      [K.ITEMS, K.CLAIMS],
      [staffId, itemId, JSON.stringify(claimRecord)]
    );
    const [status, payload] = Array.isArray(result) ? result : [result, ''];

    if (status === 'ok') {
      return res.status(200).json({ ok: true, claim: claimRecord });
    }
    if (status === 'already_claimed') {
      const existing = typeof payload === 'string' && payload ? JSON.parse(payload) : null;
      return res.status(200).json({ ok: false, error: 'already_claimed', claim: existing });
    }
    if (status === 'sold_out') {
      return res.status(200).json({ ok: false, error: 'sold_out' });
    }
    return res.status(200).json({ ok: false, error: 'invalid_item' });
  } catch (err) {
    console.error('claim error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}
