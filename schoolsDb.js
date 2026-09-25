/**
 * Pathshala Mitra — school + subscription store, backed by Firestore.
 *
 * Collection: "schools". Each document is one school the Super Admin has
 * onboarded: the school's own details, its Admin login (which points at
 * the matching document in the "users" collection), and its subscription.
 *
 * Record shape (unchanged from the original JSON-file version):
 *   {
 *     id: String,            // "SCH-0001"
 *     schoolName: String,
 *     adminName: String,
 *     email: String,
 *     phone: String,
 *     address: String,
 *     loginId: String,       // matches a users/ doc, role: 'ADMIN'
 *     active: Boolean,       // false = access revoked, login blocked
 *     createdAt: String,     // ISO date
 *     subscription: {
 *       plan: 'monthly' | 'yearly' | 'custom' | 'trial',
 *       startDate: String,   // 'YYYY-MM-DD'
 *       expiryDate: String,  // 'YYYY-MM-DD'
 *       price: Number,
 *       paymentStatus: 'paid' | 'pending',
 *       suspended: Boolean,  // manual override, independent of dates
 *       note: String,
 *     }
 *   }
 *
 * Note: nextId() reads every school to find the highest existing number,
 * same as the original JSON-file version. Fine at the scale one Super
 * Admin onboarding schools by hand actually runs at; if two schools were
 * ever created in the same instant this could collide — not a real risk
 * here, but worth knowing before scripting bulk school creation.
 */

const { db } = require('./firestore');

const SCHOOLS = db.collection('schools');

async function readSchools() {
  const snap = await SCHOOLS.get();
  return snap.docs.map(d => d.data());
}

async function findById(id) {
  const doc = await SCHOOLS.doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function nextId() {
  const schools = await readSchools();
  const nums = schools
    .map(s => parseInt(String(s.id).replace(/\D/g, ''), 10))
    .filter(n => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SCH-${String(next).padStart(4, '0')}`;
}

async function createSchool(data) {
  const id = await nextId();
  const school = { id, createdAt: new Date().toISOString(), ...data };
  await SCHOOLS.doc(id).set(school);
  return school;
}

async function updateSchool(id, patch) {
  const doc = await SCHOOLS.doc(id).get();
  if (!doc.exists) return null;
  const updated = { ...doc.data(), ...patch };
  await SCHOOLS.doc(id).set(updated);
  return updated;
}

/** Derive the display status badge from a subscription record + today's date. */
function subscriptionStatus(sub) {
  if (!sub) return 'Expired';
  if (sub.suspended) return 'Suspended';
  if (sub.plan === 'trial') return 'Custom Trial';
  const today = new Date().toISOString().slice(0, 10);
  if (sub.expiryDate && sub.expiryDate < today) return 'Expired';
  return 'Active';
}

module.exports = { readSchools, findById, createSchool, updateSchool, subscriptionStatus };
