/**
 * Pathshala Mitra — user (login account) store, backed by Firestore.
 *
 * Collection: "users". Each account (Super Admin, a school's Admin,
 * Teacher, or Student) is one document, keyed by its lowercased loginId
 * so a lookup is a direct doc read (fast, and naturally makes loginId
 * case-insensitive/unique — "S26-0001" and "s26-0001" are the same doc).
 *
 * This has nothing to do with the student/teacher records managed inside
 * the dashboard itself — those still live in the browser's memory in
 * uniform-scms-dashboard.html. This store is only login credentials.
 *
 * Document shape (unchanged from the original JSON-file version):
 *   { id, loginId, passwordHash, role, name, active }
 */

const { db } = require('./firestore');

const USERS = db.collection('users');
const docId = loginId => String(loginId).toLowerCase();

async function readUsers() {
  const snap = await USERS.get();
  return snap.docs.map(d => d.data());
}

async function findByLoginId(loginId) {
  const doc = await USERS.doc(docId(loginId)).get();
  return doc.exists ? doc.data() : null;
}

async function upsertUser(user) {
  await USERS.doc(docId(user.loginId)).set(user, { merge: true });
  return user;
}

module.exports = { readUsers, findByLoginId, upsertUser };
