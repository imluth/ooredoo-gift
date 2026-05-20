// ============================================================
// POST /api/admin-verify
// Header: Authorization: Bearer <ADMIN_TOKEN>
// Returns: { ok: true } on 200, or 401/503 on auth failure.
//
// Used by the admin dashboard login screen to validate the
// password before rendering the dashboard. Cheaper than calling
// /api/audit (which generates and returns a full CSV).
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(503).json({ error: 'admin_disabled', message: 'ADMIN_TOKEN env var not configured.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== adminToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  return res.status(200).json({ ok: true });
}
