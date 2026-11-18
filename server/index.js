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
// On a server with several processor cores, one copy of Foyer runs per
// core (up to 8), so an upgraded server is used fully: see "Copies" below.
//
// If the database can't be reached (wrong password, not created...),
// the server still starts, but only to show it's not ready: the site
// says "Starting up" and /api/health says why (with SHOW_ERRORS=on, the
// page does too). It tries again every 30 seconds and opens by itself
// as soon as the database works.
import cluster from "node:cluster";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { databaseInTheClear } from "./config.js";
import { migrateDatabase } from "./db/migrate.js";
import { closeDb } from "./db/index.js";
import { answerCopy } from "./limits.js";

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
    res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(
      JSON.stringify({
        server: "ok",
        database: "not connected",
        ...(SHOW_ERRORS ? { error: reason } : {}),
      }),
    );
  }
  res.writeHead(503, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(waitingPage(reason));
}

let handler = notReady;

// ---------- Copies ----------
// WORKERS: how many copies run side by side.
//   (not set) or "auto": one per processor core the server gives Foyer,
//                        as many as its memory allows (about 300 MB
//                        each), at most 8. On a one-core plan: just one.
//   a number:            that many (1 = only ever one copy)
// The copies share the port: each phone is answered by whichever is free.
// One that stops (a crash) is started again at once, so the others keep
// answering meanwhile.
const MEMORY_EACH = 300 * 1024 * 1024;

// What this server really lets Foyer use (a hosting plan's limit, not the
// whole machine's), from Linux's control groups when they say
function readLimit(file) {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}
function coresAllowed() {
  let cores = os.availableParallelism?.() ?? os.cpus().length;
  const [quota, period] = readLimit("/sys/fs/cgroup/cpu.max").split(" ");
  if (quota && quota !== "max" && Number(period) > 0)
    cores = Math.min(cores, Math.floor(Number(quota) / Number(period)));
  const q1 = Number(readLimit("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"));
  const p1 = Number(readLimit("/sys/fs/cgroup/cpu/cpu.cfs_period_us"));
  if (q1 > 0 && p1 > 0) cores = Math.min(cores, Math.floor(q1 / p1));
  return Math.max(1, cores);
}
// The memory limit, or null when the server doesn't say (then only the
// whole machine's memory is known, which a hosting plan may not give)
function memoryAllowed() {
  for (const file of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    const n = Number(readLimit(file));
    // (a "limit" bigger than the machine means none was set)
    if (n > 0 && n < os.totalmem()) return n;
  }
  return null;
}
function howManyCopies() {
  const asked = String(process.env.WORKERS ?? "auto").trim().toLowerCase();
  if (/^\d+$/.test(asked)) return Math.min(32, Math.max(1, Number(asked)));
  const memory = memoryAllowed();
  // Not knowing the plan's memory: at most 2 copies, to be safe
  const byMemory = memory ? Math.floor(memory / MEMORY_EACH) : Math.min(2, Math.floor(os.totalmem() / MEMORY_EACH));
  return Math.max(1, Math.min(8, coresAllowed(), byMemory));
}

const COPIES = cluster.isPrimary ? howManyCopies() : Number(process.env.FOYER_WORKERS) || 1;
// This copy's number (1 = the one that also brings the database up to
// date and checks the controllers every 5 minutes)
const COPY = Number(process.env.FOYER_COPY) || 1;

if (cluster.isPrimary && COPIES > 1) startCopies();
else runCopy();

function startCopies() {
  console.log(`Foyer is starting ${COPIES} copies (one per processor core)`);
  let ready = false; // copy 1 has brought the database up to date
  let stopping = false;
  const crashes = {}; // copy number → when it stopped lately
  const start = (n) => {
    const worker = cluster.fork({ FOYER_COPY: String(n), FOYER_WORKERS: String(COPIES) });
    // Wrong passwords and codes are counted here, for all the copies
    answerCopy(worker);
    worker.on("message", (m) => {
      if (m === "database ready" && !ready) {
        ready = true;
        for (const w of Object.values(cluster.workers)) w.send("go");
      }
    });
    worker.on("online", () => ready && n !== 1 && worker.send("go"));
    worker.on("exit", (code, signal) => {
      if (stopping) return;
      // A copy that keeps stopping (e.g. the server is out of memory) is
      // left stopped, so the others have room; copy 1 always comes back
      const recent = (crashes[n] = [...(crashes[n] ?? []), Date.now()].filter((t) => Date.now() - t < 60 * 1000));
      if (n > 1 && recent.length >= 3) {
        console.error(`Copy ${n} stopped 3 times in a minute: leaving it off (set WORKERS to fewer copies)`);
        return;
      }
      console.error(`Copy ${n} stopped (${signal ?? code}): starting it again`);
      setTimeout(() => start(n), 1000);
    });
  };
  for (let n = 1; n <= COPIES; n += 1) start(n);
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      stopping = true;
      for (const w of Object.values(cluster.workers)) w.process.kill(signal);
      setTimeout(() => process.exit(0), 5000).unref();
    });
}

function runCopy() {
  server = http.createServer((req, res) => handler(req, res));
  server.listen(...listenTarget(), () => {
    const where = server.address();
    if (COPY === 1)
      console.log(`Foyer is listening on ${typeof where === "string" ? where : `port ${where.port}`}`);
  });

  // Copies 2, 3...: start once copy 1 has brought the database up to date
  if (COPY === 1) attempt();
  else process.on("message", (m) => m === "go" && state === "starting" && attempt());

  // Stopping cleanly (the host restarts or redeploys the app)
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      server.close();
      closeDb().finally(() => process.exit(0));
    });
}

async function attempt() {
  try {
    if (COPY === 1) {
      await migrateDatabase();
      const { makeFirstAdmin } = await import("./firstAdmin.js");
      await makeFirstAdmin();
    }
    const { makeApp } = await import("./app.js");
    handler = makeApp();
    state = "ready";
    letThrough();
    if (COPY === 1) {
      console.log("✓ Foyer is ready");
      process.send?.("database ready");
    }
    if (databaseInTheClear())
      console.warn("✗ The database is on another server and DB_SSL isn't set: add DB_SSL=on so what's sent to it is scrambled.");
    if (!process.env.SECRET_KEY && process.env.NODE_ENV === "production")
      console.warn("✗ SECRET_KEY isn't set: controllers can't be saved until it's added.");
  } catch (err) {
    reason = err.message;
    state = "failed";
    letThrough();
    if (COPY === 1) console.error(`The database isn't ready: ${reason}`);
    await closeDb().catch(() => {});
    setTimeout(attempt, RETRY_EVERY);
  }
}

