// GET /api/data
// Pulls live balances for every linked Plaid item, merges in your manual
// accounts (Fidelity, Public.com, Gainbridge, Alphaeon, etc.), and returns
// one normalized list plus a net-worth summary.

const PLAID_HOSTS = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

// Plaid account types that are debts rather than assets.
const LIABILITY_TYPES = new Set(["credit", "loan"]);

export async function onRequestGet(context) {
  const { env } = context;
  const host = PLAID_HOSTS[env.PLAID_ENV] || PLAID_HOSTS.sandbox;

  const itemsRaw = await env.PECUNIARY_KV.get("items");
  const items = itemsRaw ? JSON.parse(itemsRaw) : [];

  const accounts = [];
  const errors = [];

  // One Plaid call per linked institution.
  for (const item of items) {
    try {
      const res = await fetch(`${host}/accounts/balance/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.PLAID_CLIENT_ID,
          secret: env.PLAID_SECRET,
          access_token: item.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // A broken connection (re-auth needed) shows up here without killing the page.
        errors.push({ institution: item.institution, error: data.error_code || "error" });
        continue;
      }
      for (const a of data.accounts) {
        const isLiability = LIABILITY_TYPES.has(a.type);
        accounts.push({
          source: "plaid",
          institution: item.institution,
          name: a.name,
          mask: a.mask,
          type: a.subtype || a.type,
          kind: isLiability ? "liability" : "asset",
          value: a.balances.current ?? 0,
        });
      }
    } catch (e) {
      errors.push({ institution: item.institution, error: "fetch_failed" });
    }
  }

  // Manual accounts.
  const manualRaw = await env.PECUNIARY_KV.get("manual");
  const manual = manualRaw ? JSON.parse(manualRaw) : [];
  for (const m of manual) {
    accounts.push({
      source: "manual",
      institution: m.name,
      name: m.name,
      type: "manual",
      kind: m.kind === "liability" ? "liability" : "asset",
      value: Number(m.value) || 0,
      updated: m.updated,
      id: m.id,
    });
  }

  const assets = accounts
    .filter((a) => a.kind === "asset")
    .reduce((s, a) => s + a.value, 0);
  const liabilities = accounts
    .filter((a) => a.kind === "liability")
    .reduce((s, a) => s + a.value, 0);

  return Response.json({
    accounts,
    summary: { assets, liabilities, net_worth: assets - liabilities },
    errors,
  });
}
