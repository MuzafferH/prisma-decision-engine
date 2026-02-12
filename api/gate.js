// api/gate.js — Client checks this on app.html load to show/hide password modal
// GET → returns {gated: true/false}
// POST with X-Prisma-Auth header → validates password, returns {valid: true/false}

module.exports = function handler(req, res) {
  const gatePassword = (process.env.PRISMA_GATE_PASSWORD || '').trim();

  if (req.method === 'POST') {
    if (!gatePassword) {
      return res.status(200).json({ valid: true });
    }
    const authHeader = req.headers['x-prisma-auth'];
    return res.status(200).json({ valid: authHeader === gatePassword });
  }

  res.status(200).json({ gated: !!gatePassword });
};
