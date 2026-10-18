try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch (_) {}
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const TIERS = require('./tiers');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const VERIFY_SECRET = process.env.VERIFY_SECRET || '';
const COOKIE_NAME = 'fw_admin';

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.ADMIN_SESSION_SECRET || 'fw-dev-secret'));
app.use(express.static(path.join(__dirname, '..', 'public')));

function signToken() {
  const t = Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
  return t;
}

function isAdmin(req) {
  return req.signedCookies && req.signedCookies[COOKIE_NAME] === '1';
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  }
  return res.redirect('/admin/login');
}

// ---- public API (executor) ----
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fw-keysite' });
});

app.post('/v1/verify', (req, res) => {
  if (VERIFY_SECRET) {
    const sec = req.headers['x-fw-secret'];
    if (sec !== VERIFY_SECRET) {
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
    }
  }
  const { key, hwid } = req.body || {};
  const result = store.verify({ key, hwid });
  res.status(result.ok ? 200 : 403).json(result);
});
// alias
app.post('/verify', (req, res) => {
  req.url = '/v1/verify';
  app._router.handle(req, res);
});

// ---- public pages data ----
app.get('/api/tiers', (_req, res) => {
  res.json(TIERS);
});

app.post('/api/status', (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, message: 'key required' });
  const e = store.findKey(key);
  if (!e) return res.json({ ok: false, code: 'INVALID', message: 'key not found' });
  const now = Date.now();
  const active = !e.revoked && (!e.expiresAt || e.expiresAt > now);
  res.json({
    ok: true,
    tier: e.tier,
    revoked: e.revoked,
    redeemed: !!e.redeemedAt,
    expiresAt: e.expiresAt,
    active,
    hwidBound: !!e.hwid,
  });
});

// ---- admin auth ----
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'wrong password' });
  }
  res.cookie(COOKIE_NAME, '1', {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ ok: isAdmin(req) });
});

// ---- admin key ops ----
app.post('/api/admin/keys', requireAdmin, (req, res) => {
  try {
    const { tier, note, buyerTag } = req.body || {};
    if (!TIERS[tier]) return res.status(400).json({ ok: false, message: 'invalid tier' });
    const entry = store.createKey({
      tier,
      note: note || '',
      buyerTag: buyerTag || '',
      createdBy: 'web-admin',
    });
    res.json({ ok: true, key: entry.key, entry });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.get('/api/admin/keys', requireAdmin, (req, res) => {
  const keys = store.listKeys({}).slice().reverse();
  res.json({ ok: true, keys });
});

app.post('/api/admin/revoke', requireAdmin, (req, res) => {
  const { key } = req.body || {};
  const r = store.revoke(key, 'web-admin');
  res.json(r);
});

app.post('/api/admin/reset', requireAdmin, (req, res) => {
  const { key } = req.body || {};
  const r = store.resetHwid(key, 'web-admin');
  res.json(r);
});

// SPA-ish routes
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('/admin/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FW KeySite on :${PORT}`);
  console.log(`verify → POST /v1/verify`);
  console.log(`admin  → /admin`);
});
