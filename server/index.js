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
// On a server with several processor cores, Foyer adds copies of itself
// when it gets busy (a crowd) and lets them go when it's quiet again, up
// to one per core: see "Copies" below.
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
import { performance } from "node:perf_hooks";
import { databaseInTheClear } from "./config.js";
import { migrateDatabase } from "./db/migrate.js";
import { closeDb } from "./db/index.js";
import { answerCopy } from "./limits.js";
import { setCopiesRunning } from "./config.js";

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
// WORKERS: how many copies may run side by side.
//   (not set) or "auto": as needed. One copy while it's quiet; when it's
//                        busy (most of its time spent working, for a few
//                        seconds), another copy is added, and so on, up to
//                        one per processor core the server gives Foyer and
//                        as many as its memory allows (about 300 MB each),
//                        at most 8. After a minute of quiet, the extra
//                        copies finish what they're doing and stop, which
//                        frees their memory. On a one-core plan: one copy.
//   a number:            always that many (1 = only ever one copy)
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

// When to add or let go of a copy (auto)
const BUSY = 0.6; // a copy working 60% of the time or more...
const BUSY_FOR = 2; // ...for 2 checks in a row (4 seconds): add one
const QUIET = 0.15; // all working under 15% of the time...
const QUIET_FOR = 30; // ...for 30 checks (a minute): let one go
const CHECK_EVERY = 2000;

if (cluster.isPrimary && COPIES > 1) startCopies();
else runCopy();

function startCopies() {
  const fixed = /^\d+$/.test(String(process.env.WORKERS ?? "").trim());
  console.log(
    fixed
      ? `Foyer is starting ${COPIES} copies`
      : `Foyer starts with 1 copy and adds more when busy (up to ${COPIES} on this server)`,
  );
  let ready = false; // copy 1 has brought the database up to date
  let stopping = false;
  const crashes = {}; // copy number → when it stopped lately
  const copies = new Map(); // copy number → { worker, load, retiring }

  // Every copy is told how many are running (they share some limits out)
  const tellCount = () => {
    const running = [...copies.values()].filter((c) => !c.retiring).length;
    for (const c of copies.values()) if (c.worker.isConnected()) c.worker.send({ copies: running });
  };

  const start = (n) => {
    const worker = cluster.fork({ FOYER_COPY: String(n), FOYER_WORKERS: String(COPIES) });
    const copy = { worker, load: 0, retiring: false };
    copies.set(n, copy);
    // Wrong passwords and codes are counted here, for all the copies
    answerCopy(worker);
    worker.on("message", (m) => {
      if (m === "database ready" && !ready) {
        ready = true;
        for (const c of copies.values()) if (c.worker.isConnected()) c.worker.send("go");
      }
      if (typeof m?.load === "number") copy.load = m.load;
    });
    worker.on("online", () => {
      if (ready && n !== 1) worker.send("go");
      tellCount();
    });
    worker.on("exit", (code, signal) => {
      if (copies.get(n)?.worker === worker) copies.delete(n);
      tellCount();
      if (stopping || copy.retiring) return;
      // A copy that keeps stopping (e.g. the server is out of memory) is
      // left stopped, so the others have room; copy 1 always comes back
      const recent = (crashes[n] = [...(crashes[n] ?? []), Date.now()].filter((t) => Date.now() - t < 60 * 1000));
      if (n > 1 && recent.length >= 3) {
        console.error(`Copy ${n} stopped 3 times in a minute: leaving it off`);
        return;
      }
      console.error(`Copy ${n} stopped (${signal ?? code}): starting it again`);
      setTimeout(() => !stopping && start(n), 1000);
    });
  };

  // A copy finishes what it's doing (it takes no new visitors) and stops
  const retire = (n) => {
    const copy = copies.get(n);
    if (!copy) return;
    copy.retiring = true;
    tellCount();
    copy.worker.send("finish");
    setTimeout(() => copy.worker.isDead() || copy.worker.process.kill("SIGKILL"), 30 * 1000).unref();
  };

  if (fixed) {
    for (let n = 1; n <= COPIES; n += 1) start(n);
  } else {
    start(1);
    let busyChecks = 0;
    let quietChecks = 0;
    let lastChange = Date.now();
    setInterval(() => {
      if (!ready || stopping) return;
      const running = [...copies.entries()].filter(([, c]) => !c.retiring);
      if (!running.length) return;
      const load = running.reduce((sum, [, c]) => sum + c.load, 0) / running.length;
      busyChecks = load >= BUSY ? busyChecks + 1 : 0;
      quietChecks = load < QUIET ? quietChecks + 1 : 0;
      const sinceChange = Date.now() - lastChange;
      if (busyChecks >= BUSY_FOR && running.length < COPIES && sinceChange > 5000) {
        let n = 2;
        while (copies.has(n)) n += 1;
        console.log(`Busy (${Math.round(load * 100)}%): adding copy ${n} of up to ${COPIES}`);
        start(n);
        busyChecks = 0;
        lastChange = Date.now();
      } else if (quietChecks >= QUIET_FOR && running.length > 1 && sinceChange > 60 * 1000) {
        const n = Math.max(...running.map(([k]) => k));
        console.log(`Quiet again: letting copy ${n} go (${running.length - 1} left)`);
        retire(n);
        quietChecks = 0;
        lastChange = Date.now();
      }
    }, CHECK_EVERY).unref();
  }

  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      stopping = true;
      for (const c of copies.values()) c.worker.process.kill(signal);
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

  // Stopping cleanly (the host restarts or redeploys the app, or this
  // copy isn't needed any more): no new visitors, finish the ones here,
  // save what's waiting to be saved (ad counts), then stop
  let finishing = false;
  const finish = () => {
    if (finishing) return;
    finishing = true;
    server.close();
    // Open admin tabs' live lines would keep it waiting: they reconnect
    // to another copy by themselves
    server.closeIdleConnections?.();
    setTimeout(() => server.closeAllConnections?.(), 10 * 1000).unref();
    const saved = new Promise((done) => {
      if (process.listenerCount("foyer:finish")) process.emit("foyer:finish", done);
      else done();
    });
    const atMost = new Promise((done) => setTimeout(done, 5000).unref());
    Promise.race([saved, atMost]).finally(() => closeDb().finally(() => process.exit(0)));
  };
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, finish);
  process.on("message", (m) => m === "finish" && finish());

  // Several copies: tell the main process how busy this one is (the share
  // of its time spent working), every 2 seconds
  if (cluster.isWorker) {
    let before = performance.eventLoopUtilization();
    setInterval(() => {
      const now = performance.eventLoopUtilization();
      const used = performance.eventLoopUtilization(now, before).utilization;
      before = now;
      if (process.connected) process.send({ load: used });
    }, 2000).unref();
    process.on("message", (m) => typeof m?.copies === "number" && setCopiesRunning(m.copies));
  }
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

