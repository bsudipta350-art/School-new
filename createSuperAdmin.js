/**
 * Pathshala Mitra — create (or reset) a Super Admin login account.
 *
 * The Super Admin is a separate, higher account than any school's Admin —
 * it can create schools, generate their Admin credentials, and manage
 * every school's subscription. Run this once to bootstrap the first one.
 *
 * Usage:
 *   node createSuperAdmin.js <loginId> <password> "<full name>"
 *
 * Example:
 *   node createSuperAdmin.js SUPER-01 "MySecurePass123" "Sudipta Biswas"
 */

const bcrypt = require('bcrypt');
const { upsertUser, findByLoginId } = require('./db');

async function main() {
  const [, , loginId, password, name] = process.argv;

  if (!loginId || !password || !name) {
    console.error('Usage: node createSuperAdmin.js <loginId> <password> "<full name>"');
    console.error('Example: node createSuperAdmin.js SUPER-01 "MySecurePass123" "Sudipta Biswas"');
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
    role: 'SUPERADMIN',
    name,
    active: true,
  });

  console.log(`${existing ? 'Updated' : 'Created'} Super Admin account.`);
  console.log(`  Login ID: ${loginId}`);
  console.log(`  Name:     ${name}`);
  console.log('\nLog in at /login with this Login ID and password — you will land on the Super Admin dashboard.');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to create Super Admin:', err);
  process.exit(1);
});
