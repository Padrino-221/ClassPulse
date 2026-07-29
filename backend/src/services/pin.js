const crypto = require('crypto');

const PIN_DIGITS = 6;
const STEP_SECONDS = 60;

/**
 * Generate a TOTP-style numeric code from a seed + time step.
 * Uses HMAC-SHA1 truncation per RFC 4226.
 */
function generatePinFromSeed(seed, timeStep) {
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUint64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', seed);
  hmac.update(timeBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const pin = binary % Math.pow(10, PIN_DIGITS);
  return pin.toString().padStart(PIN_DIGITS, '0');
}

/**
 * Get the current valid PIN for a given seed.
 */
function getCurrentPin(seed) {
  const timeStep = Math.floor(Date.now() / (STEP_SECONDS * 1000));
  return generatePinFromSeed(seed, timeStep);
}

/**
 * Get the PIN for the previous time window (to handle clock drift).
 */
function getPreviousPin(seed) {
  const timeStep = Math.floor(Date.now() / (STEP_SECONDS * 1000)) - 1;
  return generatePinFromSeed(seed, timeStep);
}

/**
 * Validate a submitted PIN against a seed.
 * Accepts current and previous time window pins to handle clock drift.
 */
function validatePin(seed, submittedPin) {
  if (!seed || !submittedPin) return false;
  return submittedPin === getCurrentPin(seed) || submittedPin === getPreviousPin(seed);
}

/**
 * Generate a cryptographically random seed string.
 */
function generateSeed() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Derive a time-independent static PIN from a seed.
 * Uses SHA-256 of the seed so the result is always the same for the same seed.
 */
function staticPinFromSeed(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const num = ((hash[0] & 0x7f) << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3];
  return (num % 1000000).toString().padStart(PIN_DIGITS, '0');
}

module.exports = {
  generatePinFromSeed,
  getCurrentPin,
  getPreviousPin,
  validatePin,
  generateSeed,
  staticPinFromSeed,
  PIN_DIGITS,
  STEP_SECONDS,
};
