// Starting Foyer: "npm start" (SiteGround runs this too).
//
//   1. bring the database up to date (db/migrate.js)
//   2. make the first admin from ADMIN_* if they're set (firstAdmin.js)
//   3. start the web server on the PORT the host gives
//
// Requests that arrive in the few seconds while it starts wait for it,
// instead of being told "starting up" (hosts like SiteGround start a
// fresh copy of the app now and then, e.g. after it's been idle).
//
// If the database can't be reached (wrong password, not created...),
// the server still starts, but only to show it's not ready: the site
// says "Starting up" and /api/health says why (with SHOW_ERRORS=on, the
// page does too). It tries again every 30 seconds and opens by itself
// as soon as the database works.
import http from "node:http";
import "./config.js";
import { migrateDatabase } from "./db/migrate.js";
import { closeDb } from "./db/index.js";

const RETRY_EVERY = 30 * 1000;
const SHOW_ERRORS = /^(on|yes|true|1)$/i.test(process.env.SHOW_ERRORS ?? "");

function listenTarget() {
  const port = process.env.PORT;
  // Some hosts hand over a socket file instead of a port number
  if (port && !/^\d+$/.test(port)) return [port];
  return [Number(port) || 4100];
}

const escape = (s) =>
  s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

function waitingPage(reason) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30"><title>Foyer is starting</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f8fc;color:#0f1b2d;margin:0;display:grid;place-items:center;min-height:100vh;padding:16px}
main{background:#fff;border:1px solid #e3e8f0;border-radius:16px;padding:24px;max-width:520px}
h1{font-size:20px;margin:0 0 8px}p{color:#5f6b7d;line-height:1.5}
code{display:block;background:#fef2f2;color:#b91c1c;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word}</style></head>
<body><main><h1>Starting up</h1>
${SHOW_ERRORS ? `<code>${escape(reason)}</code>` : ""}
<p>${SHOW_ERRORS ? "Fix the setting, then restart the app (or wait: it tries again every 30 seconds, and this page reloads by itself)." : "It'll be ready in a moment. This page reloads by itself."}</p></main></body></html>`;
}

let reason = "";
let server = null;
// "starting" (the first try is running), "ready" or "failed"
let state = "starting";
const waiting = new Set(); // requests that came in while starting
const WAIT_AT_MOST = 25 * 1000;

function park(req, res) {
  const entry = { req, res };
  entry.timer = setTimeout(() => {
    waiting.delete(entry);
    refuse(req, res);
  }, WAIT_AT_MOST);
  waiting.add(entry);
}

function letThrough() {
  for (const entry of waiting) {
    clearTimeout(entry.timer);
    handler(entry.req, entry.res);
  }
  waiting.clear();
}

function notReady(req, res) {
  if (state === "starting") return park(req, res);
  refuse(req, res);
}

// While the database isn't working, every address answers "not ready"
function refuse(req, res) {
  if (req.url.startsWith("/api/")) {
    res.writeHead(503, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        server: "ok",
        database: "not connected",
        ...(SHOW_ERRORS ? { error: reason } : {}),
      }),
    );
  }
  res.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
  res.end(waitingPage(reason));
}

let handler = notReady;
server = http.createServer((req, res) => handler(req, res));
server.listen(...listenTarget(), () => {
  const where = server.address();
  console.log(
    `Foyer is listening on ${typeof where === "string" ? where : `port ${where.port}`}`,
  );
});

async function attempt() {
  try {
    await migrateDatabase();
    const { makeFirstAdmin } = await import("./firstAdmin.js");
    await makeFirstAdmin();
    const { makeApp } = await import("./app.js");
    handler = makeApp();
    state = "ready";
    letThrough();
    console.log("✓ Foyer is ready");
  } catch (err) {
    reason = err.message;
    state = "failed";
    letThrough();
    console.error(`The database isn't ready: ${reason}`);
    await closeDb().catch(() => {});
    setTimeout(attempt, RETRY_EVERY);
  }
}

attempt();

// Stopping cleanly (the host restarts or redeploys the app)
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close();
    closeDb().finally(() => process.exit(0));
  });
