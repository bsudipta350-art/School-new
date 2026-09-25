/**
 * Pathshala Mitra — Firestore connection.
 *
 * Reads the Google Cloud service account key from the
 * FIREBASE_SERVICE_ACCOUNT environment variable (the whole key file's
 * JSON, pasted as one line) instead of a committed key file, so nothing
 * sensitive ever sits in the repo. See README.md → "Using Firestore" for
 * how to get this value from the Firebase console and set it on Render.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Paste your Firebase service account key JSON (as one line) into it — see README.md.'
    );
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON — paste the whole key file contents as one line.');
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

module.exports = { db, admin };
