// api/_auth.js — Password gate for Prisma API endpoints
// Set PRISMA_GATE_PASSWORD env var to enable. Remove to disable.

function checkGate(req, res) {
  const gatePassword = (process.env.PRISMA_GATE_PASSWORD || '').trim();
  if (gatePassword) {
    const authHeader = req.headers['x-prisma-auth'];
    if (authHeader !== gatePassword) {
      res.status(401).json({ error: 'Access restricted. Password required.' });
      return false;
    }
  }
  return true; // gate OFF or password correct
}

module.exports = { checkGate };
