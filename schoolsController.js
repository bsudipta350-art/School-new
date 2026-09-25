/**
 * Pathshala Mitra — Super Admin: school + subscription management.
 *
 * Every handler here is mounted behind requireRole('SUPERADMIN') in
 * server.js. Creating a school also creates its Admin login account (in
 * the "users" Firestore collection, via db.js) so the school can actually
 * log in at /login — the two collections are kept in sync (reset
 * password / activate-deactivate here update both).
 */

const bcrypt = require('bcrypt');
const schoolsDb = require('./schoolsDb');
const usersDb = require('./db');

function publicSchool(s) {
  return { ...s, subscription: { ...s.subscription, status: schoolsDb.subscriptionStatus(s.subscription) } };
}

/** GET /api/schools */
async function listSchools(req, res) {
  try {
    const schools = (await schoolsDb.readSchools()).map(publicSchool);
    res.json({ schools });
  } catch (err) {
    console.error('listSchools error:', err);
    res.status(500).json({ message: 'Could not load schools. Please try again.' });
  }
}

/**
 * POST /api/schools
 * Body: { schoolName, adminName, email, phone, username, password, address }
 * Creates the school record AND its Admin login account in one step.
 */
async function createSchool(req, res) {
  try {
    const { schoolName, adminName, email, phone, username, password, address } = req.body || {};
    const missing = ['schoolName', 'adminName', 'email', 'phone', 'username', 'password', 'address']
      .filter(k => !String(req.body?.[k] || '').trim());
    if (missing.length) {
      return res.status(400).json({ message: `Missing required field(s): ${missing.join(', ')}` });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password should be at least 8 characters.' });
    }
    if (await usersDb.findByLoginId(username)) {
      return res.status(409).json({ message: 'That username is already taken. Choose another.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const loginId = String(username).trim();

    const school = await schoolsDb.createSchool({
      schoolName: String(schoolName).trim(),
      adminName: String(adminName).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      loginId,
      active: true,
      subscription: {
        plan: 'trial',
        startDate: new Date().toISOString().slice(0, 10),
        expiryDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        price: 0,
        paymentStatus: 'pending',
        suspended: false,
        note: 'Default 14-day trial — set a real plan from Subscriptions.',
      },
    });

    await usersDb.upsertUser({
      id: school.id,
      loginId,
      passwordHash,
      role: 'ADMIN',
      name: adminName,
      active: true,
    });

    res.status(201).json({ school: publicSchool(school) });
  } catch (err) {
    console.error('createSchool error:', err);
    res.status(500).json({ message: 'Could not create the school. Please try again.' });
  }
}

/**
 * PUT /api/schools/:id
 * Body: any of { schoolName, adminName, email, phone, address }
 */
async function updateSchoolDetails(req, res) {
  try {
    const { id } = req.params;
    const patch = {};
    for (const k of ['schoolName', 'adminName', 'email', 'phone', 'address']) {
      if (req.body?.[k] !== undefined) patch[k] = String(req.body[k]).trim();
    }
    const school = await schoolsDb.updateSchool(id, patch);
    if (!school) return res.status(404).json({ message: 'School not found.' });

    // Keep the login account's display name in sync with adminName.
    if (patch.adminName) {
      const account = await usersDb.findByLoginId(school.loginId);
      if (account) await usersDb.upsertUser({ ...account, name: patch.adminName });
    }

    res.json({ school: publicSchool(school) });
  } catch (err) {
    console.error('updateSchoolDetails error:', err);
    res.status(500).json({ message: 'Could not save changes. Please try again.' });
  }
}

/**
 * POST /api/schools/:id/reset-password
 * Body: { password }
 */
async function resetPassword(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: 'Password should be at least 8 characters.' });
    }
    const school = await schoolsDb.findById(id);
    if (!school) return res.status(404).json({ message: 'School not found.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await usersDb.findByLoginId(school.loginId);
    await usersDb.upsertUser({
      ...(account || { id: school.id, loginId: school.loginId, role: 'ADMIN', name: school.adminName, active: school.active }),
      passwordHash,
    });

    res.json({ message: 'Password reset. Share the new password with the school directly.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Could not reset the password. Please try again.' });
  }
}

/**
 * POST /api/schools/:id/toggle-active
 * Body: { active: boolean }
 * Flips whether this school's Admin can log in at all (independent of
 * subscription status — this is a hard access switch).
 */
async function toggleActive(req, res) {
  try {
    const { id } = req.params;
    const { active } = req.body || {};
    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: '"active" must be true or false.' });
    }
    const school = await schoolsDb.updateSchool(id, { active });
    if (!school) return res.status(404).json({ message: 'School not found.' });

    const account = await usersDb.findByLoginId(school.loginId);
    if (account) await usersDb.upsertUser({ ...account, active });

    res.json({ school: publicSchool(school) });
  } catch (err) {
    console.error('toggleActive error:', err);
    res.status(500).json({ message: 'Could not change access. Please try again.' });
  }
}

/**
 * PUT /api/schools/:id/subscription
 * Body: { plan, startDate, expiryDate, price, paymentStatus, suspended, note }
 * The Super Admin's "assign / extend / override" control — every field is
 * a direct, manual override, there is no billing engine behind this.
 */
async function updateSubscription(req, res) {
  try {
    const { id } = req.params;
    const school = await schoolsDb.findById(id);
    if (!school) return res.status(404).json({ message: 'School not found.' });

    const allowed = ['plan', 'startDate', 'expiryDate', 'price', 'paymentStatus', 'suspended', 'note'];
    const patch = {};
    for (const k of allowed) if (req.body?.[k] !== undefined) patch[k] = req.body[k];

    const subscription = { ...school.subscription, ...patch };
    const updated = await schoolsDb.updateSchool(id, { subscription });
    res.json({ school: publicSchool(updated) });
  } catch (err) {
    console.error('updateSubscription error:', err);
    res.status(500).json({ message: 'Could not save the subscription. Please try again.' });
  }
}

module.exports = { listSchools, createSchool, updateSchoolDetails, resetPassword, toggleActive, updateSubscription };
