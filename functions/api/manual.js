// Manual accounts — anything Plaid can't reach (Fidelity, Public.com,
// Gainbridge, Alphaeon, ...). Stored in KV under "manual".
//   GET    /api/manual            -> list
//   POST   /api/manual            -> add or update { id?, name, kind, value }
//   DELETE /api/manual?id=...     -> remove

async function readManual(env) {
  const raw = await env.PECUNIARY_KV.get("manual");
  return raw ? JSON.parse(raw) : [];
}
async function writeManual(env, list) {
  await env.PECUNIARY_KV.put("manual", JSON.stringify(list));
}

export async function onRequestGet(context) {
  return Response.json({ manual: await readManual(context.env) });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();
  const list = await readManual(env);

  const entry = {
    id: body.id || crypto.randomUUID(),
    name: (body.name || "").trim() || "Untitled",
    kind: body.kind === "liability" ? "liability" : "asset",
    value: Number(body.value) || 0,
    updated: new Date().toISOString(),
  };

  const idx = list.findIndex((m) => m.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);

  await writeManual(env, list);
  return Response.json({ ok: true, entry });
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const id = new URL(request.url).searchParams.get("id");
  const list = (await readManual(env)).filter((m) => m.id !== id);
  await writeManual(env, list);
  return Response.json({ ok: true });
}
