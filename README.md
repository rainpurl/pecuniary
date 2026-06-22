# Pecuniary

A private, single-user net-worth dashboard. Plaid pulls balances for the banks it
supports; everything else (Fidelity, Public.com, Gainbridge, Alphaeon) you enter
manually. Hosted on Cloudflare Pages at `pecuniary.katr.es`, code lives in GitHub.

## How it's wired

```
Browser (pecuniary.katr.es)
   │   served by Cloudflare Pages  ← static files in /public
   │   gated by Cloudflare Access  ← only you can load it
   ▼
Pages Functions (/functions/api/*)  ← backend, holds the Plaid secret
   │
   ├── Plaid REST API   (balances for linked banks)
   └── Cloudflare KV    (stores access tokens + manual accounts)
```

GitHub Pages can't do this (it's static-only and can't hold the Plaid secret or
call Plaid). Cloudflare Pages serves the same static files **and** runs the backend
(Functions) on the same domain — so you still keep code in GitHub, Cloudflare just
deploys it.

## Files

```
pecuniary/
├── public/index.html              # the whole UI (Plaid Link + dashboard + manual entry)
├── functions/api/
│   ├── create_link_token.js        # POST  start Plaid Link
│   ├── exchange_token.js           # POST  public_token -> access_token, store in KV
│   ├── data.js                     # GET   live balances + manual accounts + net worth
│   └── manual.js                   # GET/POST/DELETE  manual accounts
├── wrangler.toml                   # Cloudflare config (KV binding, output dir)
├── .dev.vars.example               # template for local secrets
└── .gitignore
```

## Setup

### 1. Plaid keys (sandbox first)
- Sign up at dashboard.plaid.com. Sandbox is free.
- Copy your **client_id** and **Sandbox secret** from Team Settings → Keys.

### 2. Push this folder to GitHub
```
git init && git add . && git commit -m "pecuniary v1"
git branch -M main
git remote add origin git@github.com:YOU/pecuniary.git
git push -u origin main
```

### 3. Create the Cloudflare Pages project
- Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
- Build settings: **Framework preset = None**, **Build command = empty**, **Build output directory = `public`**. Deploy.
- Functions in `/functions` are detected automatically.

### 4. Create + bind KV
```
npx wrangler kv namespace create PECUNIARY_KV
```
- Paste the returned `id` into `wrangler.toml`.
- In the dashboard: Pages project → **Settings → Functions → KV namespace bindings** → add
  **Variable name `PECUNIARY_KV`** → select the namespace. Add it for **Production** (and Preview).

### 5. Set the secrets
Pages project → **Settings → Variables and Secrets** → add three, for Production:
| Name | Value |
|------|-------|
| `PLAID_CLIENT_ID` | your client_id |
| `PLAID_SECRET` | your **sandbox** secret (mark as a Secret) |
| `PLAID_ENV` | `sandbox` |

Redeploy after adding bindings/secrets (Deployments → Retry deployment) so they take effect.

### 6. Custom domain
- Pages project → **Custom domains → Set up a domain** → `pecuniary.katr.es`.
- Easiest if `katr.es` is on Cloudflare (add the site to your Cloudflare account and point its
  nameservers to Cloudflare). Cloudflare then creates the DNS record automatically, and it's
  also what makes Access (next step) work cleanly.

### 7. Cloudflare Access — REQUIRED security gate
Without this, `pecuniary.katr.es` is a public URL showing your finances. Lock it to just you:
- Cloudflare **Zero Trust** dashboard → **Access → Applications → Add an application → Self-hosted**.
- Application domain: `pecuniary.katr.es`.
- Add a policy: **Action = Allow**, **Include → Emails →** your email address.
- Save. Now loading the site (and every `/api/*` call) requires you to authenticate
  (one-time code to your email, or Google login). Free for personal use.

### 8. Test (sandbox)
- Open `pecuniary.katr.es`, pass the Access login.
- Click **Connect an account**, search any bank, and use Plaid's sandbox credentials:
  username `user_good`, password `pass_good` (MFA code `1234` if asked).
- Fake balances appear in the ledger. Add a **manual account** to confirm that path.

## Going to production (real accounts)

1. In Plaid, complete your **application + company profile** (required before some banks connect),
   and request **Production** access.
2. Add your Production secret and set `PLAID_ENV = production` in the Pages secrets.
3. **OAuth banks** (Chase, Capital One, Discover, etc. — most of yours): in the Plaid dashboard
   add `https://pecuniary.katr.es/` to **Allowed redirect URIs**, then uncomment the `redirect_uri`
   line in `create_link_token.js`. Returning from a bank's OAuth screen also needs Link to be
   re-initialized with `receivedRedirectUri` — add that to `index.html` when you switch to prod
   (Plaid's "OAuth guide" has the ~10-line snippet).
4. **Cost control:** `transactions` and `investments` are billed as monthly subscriptions per
   linked item on paid plans; `balance` is per-request. The free **Trial plan covers up to 10
   linked items**, which fits your list. If you only want balances, narrow the `products` array
   in `create_link_token.js`.

## Your accounts

- **Plaid (automatic):** Chase, Capital One, Chime, Discover, PayPal.
- **Manual (no aggregator reaches them):** Fidelity Roth, Public.com, Gainbridge (annuity — never
  aggregatable anywhere), Alphaeon (Comenity/Bread card).
- **Verify in Plaid Link:** Forbright — if it doesn't appear, add it as a manual account.

## Security model

- Only you can reach the site or the API — Cloudflare Access enforces login at the edge.
- Your Plaid secret and access tokens live only in Cloudflare (encrypted env var + KV, which is
  encrypted at rest). They are never in the repo or sent to the browser.
- You never type bank credentials into this app — Plaid Link handles bank login; the app only
  ever holds a read-only token, which you can revoke anytime at my.plaid.com.
- HTTPS is automatic.
- Optional hardening later: envelope-encrypt the stored tokens with a key kept in secrets.

## Roadmap (easy next steps)

- **Holdings**: add `investments` and call `/investments/holdings/get` to show positions/returns
  for any Plaid-linked brokerage.
- **History/growth**: switch KV → D1 (SQLite) and write a daily snapshot via a Pages **Cron
  Trigger**, so you can chart net worth and per-account growth over time.
- **Auto-refresh**: a Cron Trigger that pre-warms balances so the page loads instantly.
