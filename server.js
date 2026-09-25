/**
 * Pathshala Mitra — backend entry point.
 *
 * Run locally:   npm install && JWT_SECRET=some-long-random-string npm start
 * Then create your first admin:
 *                npm run create-admin -- ADMIN-01 "MySecurePass123" "Your Name"
 * Or your first Super Admin (to manage schools/subscriptions):
 *                npm run create-superadmin -- SUPER-01 "MySecurePass123" "Your Name"
 *
 * See README.md for deploying this (Render/Railway) and wiring it to the
 * Netlify-hosted frontend.
 */

const express = require('express');
const cors = require('cors');
const { login } = require('./authController');
const { requireRole } = require('./middleware/auth');
const schools = require('./schoolsController');

const app = express();

app.use(cors());          // frontend and backend live on different domains
app.use(express.json());  // parse JSON request bodies

app.post('/api/auth/login', login);

// --- Super Admin: school + subscription management -----------------------
// Everything below is locked to role SUPERADMIN — a school's own Admin,
// Teacher or Student token cannot reach any of it.
const superAdminOnly = requireRole('SUPERADMIN');
app.get('/api/schools', superAdminOnly, schools.listSchools);
app.post('/api/schools', superAdminOnly, schools.createSchool);
app.put('/api/schools/:id', superAdminOnly, schools.updateSchoolDetails);
app.post('/api/schools/:id/reset-password', superAdminOnly, schools.resetPassword);
app.post('/api/schools/:id/toggle-active', superAdminOnly, schools.toggleActive);
app.put('/api/schools/:id/subscription', superAdminOnly, schools.updateSubscription);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'pathshala-mitra-backend' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Pathshala Mitra backend listening on port ${PORT}`);
});
