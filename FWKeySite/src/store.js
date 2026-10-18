const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const TIERS = require('./tiers');

const FILE = process.env.KEYS_FILE || path.join(__dirname, '..', 'data', 'keys.json');

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { keys: [] };
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function genKey(tier) {
  const body = crypto.randomBytes(12).toString('hex').toUpperCase();
  // FW-DAY-XXXXXXXXXXXX style
  const prefix = { day: 'DAY', week: 'WEEK', month: 'MONTH' }[tier] || 'KEY';
  const chunks = body.match(/.{1,4}/g).join('-');
  return `FW-${prefix}-${chunks}`;
}

function createKey({ tier, buyerId, buyerTag, createdBy, note }) {
  if (!TIERS[tier]) throw new Error('invalid tier');
  const db = load();
  const key = genKey(tier);
  const now = Date.now();
  const entry = {
    key,
    tier,
    durationMs: TIERS[tier].durationMs,
    createdAt: now,
    expiresAt: null, // set on first redeem
    redeemedAt: null,
    hwid: null,
    buyerId: buyerId || null,
    buyerTag: buyerTag || null,
    createdBy: createdBy || null,
    note: note || null,
    resetsUsed: 0,
    maxResets: tier === 'month' ? 1 : 0,
    revoked: false,
  };
  db.keys.push(entry);
  save(db);
  return entry;
}

function findKey(keyStr) {
  const db = load();
  return db.keys.find((k) => k.key.toUpperCase() === String(keyStr).toUpperCase()) || null;
}

function updateKey(keyStr, patch) {
  const db = load();
  const i = db.keys.findIndex((k) => k.key.toUpperCase() === String(keyStr).toUpperCase());
  if (i < 0) return null;
  db.keys[i] = { ...db.keys[i], ...patch };
  save(db);
  return db.keys[i];
}

function listKeys({ buyerId, tier, activeOnly } = {}) {
  let keys = load().keys;
  if (buyerId) keys = keys.filter((k) => k.buyerId === buyerId);
  if (tier) keys = keys.filter((k) => k.tier === tier);
  if (activeOnly) {
    const now = Date.now();
    keys = keys.filter((k) => !k.revoked && (!k.expiresAt || k.expiresAt > now));
  }
  return keys;
}

/**
 * Verify for executor.
 * body: { key, hwid }
 * returns { ok, code, message, tier, expiresAt }
 */
function verify({ key, hwid }) {
  const entry = findKey(key);
  if (!entry) return { ok: false, code: 'INVALID', message: 'key not found' };
  if (entry.revoked) return { ok: false, code: 'REVOKED', message: 'key revoked' };

  const now = Date.now();

  // First redeem binds HWID and starts the clock
  if (!entry.redeemedAt) {
    if (!hwid || String(hwid).length < 4) {
      return { ok: false, code: 'HWID_REQUIRED', message: 'hwid required on first redeem' };
    }
    const expiresAt = now + entry.durationMs;
    updateKey(key, {
      redeemedAt: now,
      expiresAt,
      hwid: String(hwid),
    });
    return {
      ok: true,
      code: 'REDEEMED',
      message: 'key activated',
      tier: entry.tier,
      expiresAt,
    };
  }

  if (entry.expiresAt && now > entry.expiresAt) {
    return { ok: false, code: 'EXPIRED', message: 'key expired', tier: entry.tier, expiresAt: entry.expiresAt };
  }

  if (entry.hwid && hwid && entry.hwid !== String(hwid)) {
    return { ok: false, code: 'HWID_MISMATCH', message: 'hwid locked to another machine' };
  }

  return {
    ok: true,
    code: 'OK',
    message: 'valid',
    tier: entry.tier,
    expiresAt: entry.expiresAt,
  };
}

function resetHwid(keyStr, by) {
  const entry = findKey(keyStr);
  if (!entry) return { ok: false, message: 'key not found' };
  if (entry.revoked) return { ok: false, message: 'key revoked' };
  if (entry.resetsUsed >= (entry.maxResets || 0)) {
    return { ok: false, message: `no resets left (${entry.resetsUsed}/${entry.maxResets})` };
  }
  const updated = updateKey(keyStr, {
    hwid: null,
    resetsUsed: (entry.resetsUsed || 0) + 1,
    lastResetBy: by || null,
    lastResetAt: Date.now(),
  });
  return { ok: true, message: 'hwid cleared', entry: updated };
}

function revoke(keyStr, by) {
  const updated = updateKey(keyStr, { revoked: true, revokedBy: by || null, revokedAt: Date.now() });
  return updated ? { ok: true, entry: updated } : { ok: false, message: 'key not found' };
}

module.exports = {
  createKey,
  findKey,
  updateKey,
  listKeys,
  verify,
  resetHwid,
  revoke,
  TIERS,
};
