// POST /api/create_link_token
// Creates a short-lived Plaid Link token. The browser uses it to open Plaid Link.
// Your Plaid secret stays here on the server and is never sent to the browser.

const PLAID_HOSTS = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

export async function onRequestPost(context) {
  const { env } = context;
  const host = PLAID_HOSTS[env.PLAID_ENV] || PLAID_HOSTS.sandbox;

  const body = {
    client_id: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    client_name: "Pecuniary",
    user: { client_user_id: "owner" }, // single-user app: one fixed user
    products: ["transactions"],        // see README "Production & cost" before changing
    country_codes: ["US"],
    language: "en",

    // PRODUCTION ONLY — required for OAuth banks (Chase, Capital One, etc.):
    // 1) register this exact URL in the Plaid dashboard's allowed redirect URIs
    // 2) uncomment the next line
    // redirect_uri: "https://pecuniary.katr.es/",
  };

  const res = await fetch(`${host}/link/token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json(
      { error: data.error_message || "Plaid error", detail: data },
      { status: 500 },
    );
  }
  return Response.json({ link_token: data.link_token });
}
