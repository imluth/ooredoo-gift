// ============================================================
// GET /api/audit
// Header: Authorization: Bearer <ADMIN_TOKEN>
// Returns: CSV of all claims (staff_id, item_id, item_name, timestamp)
// Useful for the ICT team verifying who collected what.
// ============================================================

import { redis } from '../lib/redis.js';
import { K } from '../lib/items.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(503).json({ error: 'audit_disabled' });
  }
  const header = req.headers.authorization || req.query?.token || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (token !== adminToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const claims = await redis.hgetall(K.CLAIMS) || {};
    const rows = [['staff_id', 'item_id', 'item_name', 'claimed_at_iso', 'claimed_at_ts']];
    for (const [staffId, val] of Object.entries(claims)) {
      const c = typeof val === 'string' ? JSON.parse(val) : val;
      const iso = new Date(c.ts).toISOString();
      const escape = s => `"${String(s).replace(/"/g, '""')}"`;
      rows.push([escape(staffId), escape(c.itemId), escape(c.itemName), escape(iso), c.ts]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ooredoo-vault-claims-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('audit error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
