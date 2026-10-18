# FW KeySite

Web key system for FW Executor — no Discord bot required.

## Features

- Public pricing page (Day $3 / Week $12 / Month $30)
- Key status check
- Admin panel: create / list / revoke / reset HWID
- `POST /v1/verify` for the executor (same contract as the Discord bot)

## Quick start (PC)

```bash
cd FWKeySite
cp .env.example .env
# set ADMIN_PASSWORD to something strong
npm install
npm start
```

Open:
- http://localhost:3000 — public
- http://localhost:3000/admin — create keys (password from `.env`)

## Free host (Render)

1. Push this folder to a GitHub repo
2. Render → New Web Service → that repo
3. Build: `npm install` · Start: `node src/server.js` · Plan: Free
4. Env vars:
   - `ADMIN_PASSWORD=...`
   - `ADMIN_SESSION_SECRET=randomlongstring`
5. After deploy, open `https://your-service.onrender.com/admin`

Executor:
```
FW_VERIFY_URL=https://your-service.onrender.com/v1/verify
```

Use a free cron ping on `/health` so free tier does not sleep.

## Flow

1. Buyer pays (PayPal / crypto / whatever you use)
2. You open `/admin` → Create key (week/day/month) → copy key
3. Send key to buyer
4. Buyer pastes in FW Settings → Verify key
5. First redeem starts the clock + locks HWID
