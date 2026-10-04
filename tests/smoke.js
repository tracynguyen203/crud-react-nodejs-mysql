#!/usr/bin/env node
/**
 * Post-deployment smoke / integration test (zero dependencies, Node >= 18).
 * Usage: node smoke.js <apiBaseUrl> <webBaseUrl>
 * Exercises the full stack: web server -> API -> MySQL (create, read, update, delete).
 */
const [apiUrl, webUrl] = process.argv.slice(2);
if (!apiUrl || !webUrl) {
  console.error("usage: node smoke.js <apiUrl> <webUrl>");
  process.exit(2);
}

let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`);
  if (!cond) failed += 1;
};
const json = (method, path, body) =>
  fetch(apiUrl + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch (_) { /* not up yet */ }
    await sleep(2000);
  }
  return false;
}

(async () => {
  check("API /health reachable (DB connected)", await waitFor(`${apiUrl}/health`));
  check("Web front-end reachable", await waitFor(webUrl));

  const html = await (await fetch(webUrl)).text();
  check("Web serves the React app", html.includes('id="root"'));
  const cfg = await (await fetch(`${webUrl}/config.js`)).text();
  check("Web runtime config (/config.js) is served", cfg.includes("API_URL"), cfg);

  const name = `smoke-${Date.now() % 100000}`;
  const created = await json("POST", "/api/insert", { item: name });
  const insertId = (await created.json()).insertId;
  check("CREATE item", created.ok && Number.isInteger(insertId), `status ${created.status}`);

  const list = await (await json("GET", "/api/get")).json();
  check("READ item back", list.some((r) => r.id === insertId && r.item === name));

  const upd = await json("PUT", "/api/update", { id: insertId, itemU: `${name}-u` });
  const list2 = await (await json("GET", "/api/get")).json();
  check("UPDATE item", upd.ok && list2.some((r) => r.id === insertId && r.item === `${name}-u`));

  const bad = await json("POST", "/api/insert", { item: "" });
  check("Validation rejects empty item (400)", bad.status === 400, `status ${bad.status}`);

  const del = await json("DELETE", `/api/delete/${insertId}`);
  const list3 = await (await json("GET", "/api/get")).json();
  check("DELETE item", del.ok && !list3.some((r) => r.id === insertId));

  console.log(failed ? `\n${failed} smoke check(s) FAILED` : "\nAll smoke checks passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("smoke test crashed:", e);
  process.exit(1);
});
