const crypto = require('crypto');

function hashDeviceFingerprint(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { hashDeviceFingerprint };
