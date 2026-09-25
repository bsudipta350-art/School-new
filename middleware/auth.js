/**
 * Pathshala Mitra — auth middleware.
 *
 * requireRole(...roles) protects a route so only a signed-in user whose JWT
 * carries one of the given roles can reach it. Used to lock the Super Admin
 * endpoints (school + subscription management) down to role: 'SUPERADMIN'
 * so a school Admin/Teacher/Student token can never call them.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function requireRole(...roles) {
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not logged in.' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!roles.includes(payload.role)) {
        return res.status(403).json({ message: 'Not allowed for this account type.' });
      }
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
  };
}

module.exports = { requireRole };
