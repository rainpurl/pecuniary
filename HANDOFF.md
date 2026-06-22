# Pecuniary — Project Handoff

**Purpose of this file:** hand it to a new chat (along with the zip) if the current
conversation fills up. It captures the goal, decisions already made, current state, and
what's next, so a new assistant can continue without re-litigating settled questions.

---

## 1. What this is
A private, single-user net-worth dashboard for the owner. It pulls balances from the
banks Plaid supports and lets the owner manually enter everything Plaid can't reach.
Hosted on **Cloudflare Pages** at **`pecuniary.katr.es`**; source lives in **GitHub**.

## 2. Owner's priorities (in the order that settled the design)
1. Secure / private — data stays on infrastructure the owner controls.
2. Low/no ongoing dollar cost.
3. Low effort to use.
4. Track balances, net worth, and eventually what each holding earns / growth over time.

## 3. Decisions already made (don't re-open these without a reason)
- **Build vs. buy:** The owner chose to **build** this rather than use a hosted app
  (Empower/Monarch/Simplifi) specifically for privacy + control. Empower was the strong
  "free + zero-effort" option but was rejected because it hands account access to a third
  party. Don't keep re-pitching Empower.
- **Hosting:** GitHub Pages can't run a backend (static only, can't hold the Plaid secret).
  So: code in GitHub, **deployed via Cloudflare Pages**, which serves the static frontend
  AND runs the backend (Pages Functions) on the same domain. No separate server, no CORS.
- **Aggregator:** Plaid (free **Trial plan covers ≤10 linked items**, which fits the list).
  SimpleFIN (~$15/yr, MX-backed) was considered as a cheaper-coverage alternative and set
  aside in favor of a pure-Plaid build + manual entry.
- **Storage:** Cloudflare KV for v1 (tokens + manual accounts). D1 is the planned upgrade
  for historical tracking.
- **Auth:** Cloudflare Access (Zero Trust) gates the whole domain to the owner's email.
  Single-user app; no in-app login system.

## 4. Account inventory and how each connects
- **Plaid (automatic):** Chase, Capital One, Chime, Discover, PayPal.
- **Manual (no aggregator reaches them — confirmed):**
  - **Fidelity Roth** — Plaid dropped Fidelity entirely; MX/SimpleFIN also can't reliably.
    (Note: Empower *can* connect Fidelity via Yodlee, but we're not using Empower.)
  - **Public.com** — walled brokerage; not reliably aggregatable.
  - **Gainbridge** — an annuity/insurance product (issued by Gainbridge Life). Never
    aggregatable by anyone, in any tool. Always manual.
  - **Alphaeon (Alphaeon Credit)** — healthcare credit card issued by Comenity/Bread
    Financial; Comenity cards aggregate unreliably. Treat as manual (a liability).
- **Verify in Plaid Link:** Forbright Bank — if it doesn't appear, make it manual.
- Previously dropped from scope by the owner: Venmo, University Federal Credit Union,
  PatientFi, Klarna.

## 5. Current state — v0.1.0 (this zip)
Working scaffold, **sandbox-only** (not yet pointed at real accounts).

Files:
- `public/index.html` — UI: Plaid Link connect, net-worth hero, ledger grouped into
  assets/liabilities, manual-account add/edit. Vanilla JS + CSS, no build step.
- `functions/api/create_link_token.js` — starts Plaid Link.
- `functions/api/exchange_token.js` — swaps public_token → access_token, stores in KV.
- `functions/api/data.js` — pulls live balances for all linked items + merges manual
  accounts + computes net worth.
- `functions/api/manual.js` — CRUD for manual accounts.
- `wrangler.toml` — KV binding (`PECUNIARY_KV`) + Pages output dir (`public`).
- `.dev.vars.example`, `.gitignore`, `README.md` (full deploy steps).

Config facts:
- Domain: `pecuniary.katr.es`.
- KV binding name: `PECUNIARY_KV`.
- Secrets (Cloudflare Pages env, not in repo): `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`.
- Plaid REST is called directly via `fetch` (no Plaid SDK — avoids Workers-runtime issues).
  Base URLs: sandbox `https://sandbox.plaid.com`, production `https://production.plaid.com`.

## 6. What the owner still needs to do
- [ ] Create a Plaid account; get sandbox client_id + secret.
- [ ] Push repo to GitHub; connect Cloudflare Pages (output dir `public`).
- [ ] Create + bind KV namespace `PECUNIARY_KV`; set the three secrets.
- [ ] Add custom domain `pecuniary.katr.es`.
- [ ] **Set up Cloudflare Access** (without it the URL is public). REQUIRED.
- [ ] Test in sandbox (`user_good` / `pass_good`) before going to production.

## 7. Roadmap (next iterations)
- **v0.2.0 — Production:** flip `PLAID_ENV=production`; register
  `https://pecuniary.katr.es/` as a Plaid allowed redirect URI; uncomment `redirect_uri`
  in `create_link_token.js`; add OAuth-return handling in `index.html`
  (re-init Link with `receivedRedirectUri`) — needed for Chase/Capital One/Discover.
  Watch cost: `transactions`/`investments` are subscription-billed per item on paid plans.
- **v0.3.0 — Holdings:** add `investments` product + `/investments/holdings/get` to show
  positions and returns for any Plaid-linked brokerage.
- **v0.4.0 — History/growth:** migrate KV → D1 (SQLite); add a Pages **Cron Trigger** that
  writes a daily net-worth + per-account snapshot, so net worth and growth can be charted
  over time. (This is the "what's each thing earning over time" feature the owner wants.)

## 8. Delivery convention (keep doing this)
- Deliver **all** files as one clean **.zip** each iteration.
- **Rename the zip per iteration** with the version, e.g. `pecuniary-v0.1.0.zip`,
  `pecuniary-v0.2.0.zip`, so the owner can track history.
- Always include an updated copy of **this HANDOFF.md** inside the zip.

## 9. Version log
- **v0.1.0** — first packaged build: Plaid Link + balances + manual accounts + net worth,
  Cloudflare Pages/Functions/KV, behind Cloudflare Access, sandbox-only.
