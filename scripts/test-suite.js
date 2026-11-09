const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

console.log('====================================================');
console.log('       RUNNING SKYDECK SECURITY & AUTH TESTS        ');
console.log('====================================================\n');

// 1. Password Hashing (bcrypt cost 12)
console.log('[Test 1] Testing Master Password Hashing (bcrypt cost 12)...');
const masterPassword = 'MySecureMasterPassword!123';
const salt = bcrypt.genSaltSync(12);
const hash = bcrypt.hashSync(masterPassword, salt);

assert(bcrypt.compareSync(masterPassword, hash), 'Master password verification failed');
assert(!bcrypt.compareSync('WrongPassword', hash), 'Wrong password was incorrectly accepted');
console.log('  ✓ Password hashing & verification succeeded.\n');

// 2. Lockout Logic (5 failed attempts -> 30s lockout)
console.log('[Test 2] Testing Lockout Counter & Expiration...');
let failedAttempts = 0;
let lockedUntil = 0;

function attemptLogin(pass) {
  const now = Date.now();
  if (now < lockedUntil) {
    return { success: false, locked: true, remaining: Math.ceil((lockedUntil - now) / 1000) };
  }
  const match = bcrypt.compareSync(pass, hash);
  if (!match) {
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockedUntil = Date.now() + 30000;
      return { success: false, locked: true, remaining: 30 };
    }
    return { success: false, locked: false, attempts: failedAttempts };
  }
  failedAttempts = 0;
  lockedUntil = 0;
  return { success: true };
}

// 4 wrong attempts
for (let i = 1; i <= 4; i++) {
  const res = attemptLogin('badpass');
  assert.strictEqual(res.locked, false);
  assert.strictEqual(res.attempts, i);
}
// 5th wrong attempt triggers lockout
const res5 = attemptLogin('badpass');
assert.strictEqual(res5.locked, true);
assert(res5.remaining > 0);

// Even correct password should be rejected during lockout
const resDuringLockout = attemptLogin(masterPassword);
assert.strictEqual(resDuringLockout.locked, true);
console.log('  ✓ Lockout triggered at 5 attempts and enforced properly.\n');

// 3. Profile Encryption (AES-256-GCM + PBKDF2)
console.log('[Test 3] Testing AES-256-GCM Profile Encryption & Decryption...');

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

function encryptProfiles(profiles, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(profiles);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  });
}

function decryptProfiles(encryptedRaw, password) {
  const data = JSON.parse(encryptedRaw);
  const salt = Buffer.from(data.salt, 'hex');
  const iv = Buffer.from(data.iv, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  const ciphertext = Buffer.from(data.ciphertext, 'hex');

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

const testProfiles = [
  { id: '1', name: 'Web Server', host: '192.168.1.100', port: 22, username: 'ubuntu', auth_type: 'key', key_path: 'C:/keys/id_rsa' },
  { id: '2', name: 'DB Server', host: '10.0.0.5', port: 2222, username: 'admin', auth_type: 'password' }
];

const encryptedData = encryptProfiles(testProfiles, masterPassword);
const decryptedProfiles = decryptProfiles(encryptedData, masterPassword);

assert.deepStrictEqual(decryptedProfiles, testProfiles, 'Decrypted profiles do not match original');

// Test that wrong password throws decryption error
let failedDecryption = false;
try {
  decryptProfiles(encryptedData, 'WrongMasterPassword');
} catch (e) {
  failedDecryption = true;
}
assert(failedDecryption, 'Decryption with wrong password should fail');
console.log('  ✓ AES-256-GCM encryption, decryption and authentication tag verified.\n');

console.log('====================================================');
console.log('          ALL SECURITY TESTS PASSED!                ');
console.log('====================================================');
