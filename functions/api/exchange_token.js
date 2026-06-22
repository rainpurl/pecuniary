// POST /api/exchange_token   body: { public_token, institution }
// After you finish the bank login inside Plaid Link, the browser sends the
// returned public_token here. We swap it for a long-lived access_token and
// store that in KV. We never receive or store your bank username/password.

const PLAID_HOSTS = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

export async function onRequestPost(context) {
  const { env, request } = context;
  const host = PLAID_HOSTS[env.PLAID_ENV] || PLAID_HOSTS.sandbox;
  const { public_token, institution } = await request.json();

  const res = await fetch(`${host}/item/public_token/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.PLAID_CLIENT_ID,
      secret: env.PLAID_SECRET,
      public_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return Response.json(
      { error: data.error_message || "Plaid error", detail: data },
      { status: 500 },
    );
  }

  // Append this institution to the stored list of linked items.
  const raw = await env.PECUNIARY_KV.get("items");
  const items = raw ? JSON.parse(raw) : [];
  items.push({
    item_id: data.item_id,
    access_token: data.access_token,
    institution: institution || "Bank",
    added: new Date().toISOString(),
  });
  await env.PECUNIARY_KV.put("items", JSON.stringify(items));

  return Response.json({ ok: true });
}
