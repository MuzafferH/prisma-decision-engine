// api/gate.js — Client checks this on app.html load to show/hide password modal

module.exports = function handler(req, res) {
  res.status(200).json({ gated: !!process.env.PRISMA_GATE_PASSWORD });
};
