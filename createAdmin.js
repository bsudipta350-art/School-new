/**
 * Pathshala Mitra — create (or reset) an Admin login account.
 *
 * Usage:
 *   node createAdmin.js <loginId> <password> "<full name>"
 *
 * Example:
 *   node createAdmin.js ADMIN-01 "MySecurePass123" "Sudipta Biswas"
 *
 * Run this once after deploying the backend to create your first admin
 * account, or again any time to reset an admin's password (it overwrites
 * the existing account with the same loginId). The same script works for
 * teacher/student accounts too — just change the role at the bottom, or
 * copy this file as createTeacher.js / createStudent.js if you'll be
 * creating many of them by hand.
 */

const bcrypt = require('bcrypt');
const { upsertUser, findByLoginId } = require('./db');

async function main() {
  const [, , loginId, password, name] = process.argv;

  if (!loginId || !password || !name) {
    console.error('Usage: node createAdmin.js <loginId> <password> "<full name>"');
    console.error('Example: node createAdmin.js ADMIN-01 "MySecurePass123" "Sudipta Biswas"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password should be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await findByLoginId(loginId);

  await upsertUser({
    id: existing ? existing.id : loginId,
    loginId,
    passwordHash,
    role: 'ADMIN',
    name,
    active: true,
  });

  console.log(`${existing ? 'Updated' : 'Created'} admin account.`);
  console.log(`  Login ID: ${loginId}`);
  console.log(`  Name:     ${name}`);
  console.log(`  Password: (the one you just typed — it is hashed in Firestore, not stored in plain text)`);
  console.log('\nYou can now log in at /login with this Login ID and password.');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
