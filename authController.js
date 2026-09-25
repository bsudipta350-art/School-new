/**
 * Pathshala Mitra — unified login authentication controller.
 *
 * Handles POST /api/auth/login for every user type (admin, teacher, student).
 * There is no role selector on the frontend: the role comes only from the
 * user record in the store and is embedded in the JWT, and the frontend
 * redirects based on that role alone.
 *
 * This version reads/writes accounts through db.js (a JSON file store) so
 * it works out of the box with zero external database setup. See db.js for
 * why that's fine for now and what to change before this handles real,
 * permanent student/teacher data.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findByLoginId } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with `undefined`.
  throw new Error('JWT_SECRET environment variable is not set.');
}

const VALID_ROLES = ['SUPERADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];

/**
 * POST /api/auth/login
 * Body: { loginId: string, password: string }
 * Success (200): { token: string, role: 'ADMIN'|'TEACHER'|'STUDENT', user: { id, name } }
 * Failure (400/401/500): { message: string }
 */
async function login(req, res) {
  try {
    const loginId = String(req.body.loginId || '').trim();
    const password = String(req.body.password || '');

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Login ID and password are required.' });
    }

    // Login IDs are treated case-insensitively (S26-0001 and s26-0001 are the
    // same account) since people retype them from a printed slip.
    const user = await findByLoginId(loginId);

    // Same generic message whether the ID doesn't exist or the password is
    // wrong — never reveal which one failed, that just helps someone guess
    // valid Login IDs.
    const genericError = { message: 'That Login ID or password is incorrect.' };

    if (!user || user.active === false) {
      return res.status(401).json(genericError);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json(genericError);
    }

    if (!VALID_ROLES.includes(user.role)) {
      // Data problem, not a credentials problem — worth its own message so
      // whoever's debugging doesn't chase the wrong thing.
      return res.status(500).json({ message: 'This account has no valid role assigned. Contact the school office.' });
    }

    const token = jwt.sign(
      { sub: user.id, loginId: user.loginId, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      token,
      role: user.role,
      user: { id: user.id, name: user.name },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

module.exports = { login };
