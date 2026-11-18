// Live updates: every open admin tab (any browser, any device) keeps a
// connection to /api/live. When anything is changed (a save, a new guest
// signing in on a Wi-Fi, a voucher used…), each tab is told and loads
// the data again, so 10 open tabs all show the same thing.
//
// It's also how tabs learn that a new version of Foyer was deployed:
// "hello" carries the build's fingerprint, and a tab that reconnects to
// a different build offers to reload.
//
// A host may run several copies of the app, each with its own tabs, so
// the news goes through the database (PostgreSQL's NOTIFY), which every
// copy listens to.
//
// The backup: some hosts' proxies hold a long connection's messages back,
// or cut it. Tabs that haven't heard from /api/live for a while ask
// /api/live/stamp instead, every few seconds: when the last change was.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import pg from "pg";
import { sql } from "drizzle-orm";
import { ROOT, databaseConnection } from "./config.js";
import { requireUser } from "./auth.js";
import { db } from "./db/index.js";
import { forgetPages } from "./guestCache.js";

const CHANNEL = "foyer_live";

// The build's fingerprint: index.html names every built file by its
// content, so it changes with every "npm run build"
let build = "dev";
try {
  build = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(ROOT, "dist", "index.html")))
    .digest("hex")
    .slice(0, 12);
} catch {
  // Not built (npm run dev): there's no new version to offer
}

const tabs = new Set(); // { res }
const PING_EVERY = 25 * 1000;

// When the last change was (from any copy of the app that this one heard)
let lastChange = Date.now();
const noteChange = (payload) => {
  try {
    const at = Number(JSON.parse(payload).at);
    if (at > lastChange) lastChange = at;
  } catch {
    lastChange = Date.now();
  }
};

export const liveRouter = Router();

liveRouter.get("/", requireUser, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Hosts that put nginx in front (SiteGround) would hold the messages
    // back otherwise
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ build })}\n\n`);
  const tab = { res };
  tabs.add(tab);
  // A ping now and then, so nothing in between closes a quiet line, and
  // the tab knows the line still works
  const ping = setInterval(() => res.write("event: ping\ndata: {}\n\n"), PING_EVERY);
  req.on("close", () => {
    clearInterval(ping);
    tabs.delete(tab);
  });
});

// When the last change was, for tabs whose live line is quiet
liveRouter.get("/stamp", requireUser, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ stamp: lastChange, build });
});

// Sends the news to this copy's tabs
function tellTabs(payload) {
  // An admin's change: guest sign-in pages are made again (every copy of
  // the app hears this). A guest signing in changes nothing they show.
  try {
    if (JSON.parse(payload).guests !== true) forgetPages();
  } catch {
    forgetPages();
  }
  noteChange(payload);
  const message = `event: changed\ndata: ${payload}\n\n`;
  for (const { res } of tabs) res.write(message);
}

// Listening to the database for news from any copy of the app (this one
// too). Connects again by itself if the line drops.
let listening = false;
let started = false;
async function listen() {
  const client = new pg.Client(databaseConnection());
  let gone = false;
  const again = () => {
    if (gone) return;
    gone = true;
    listening = false;
    client.end().catch(() => {});
    setTimeout(listen, 5000);
  };
  client.on("error", again);
  client.on("end", again);
  client.on("notification", (m) => tellTabs(m.payload ?? "{}"));
  try {
    await client.connect();
    await client.query(`listen ${CHANNEL}`);
    listening = true;
  } catch {
    again();
  }
}

export function startLive() {
  if (started) return;
  started = true;
  listen();
}

// Tells every open tab that something changed. from: the tab that made
// the change (it already shows it, so it skips loading again).
// guests: true for guests signing in (see announceChanges).
export async function announceChange(from = "", guests = false) {
  const payload = JSON.stringify({ from, at: Date.now(), ...(guests ? { guests: true } : {}) });
  if (listening) {
    try {
      await db.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
      return;
    } catch {
      // The database didn't take it: at least this copy's tabs hear it
    }
  }
  tellTabs(payload);
}

// Any change that worked (anything but GET), except signing in and out,
// which only matter to that browser
const QUIET = ["/auth/login", "/auth/logout", "/live"];
//
// Guests signing in (and ads being seen) are told at most once every 15
// seconds, all together: with a crowd signing in every second, telling
// each one would have every admin tab loading everything again nonstop.
const GUEST_EVERY = 15 * 1000;
let guestNews = null;
function announceGuests() {
  guestNews ??= setTimeout(() => {
    guestNews = null;
    announceChange("", true).catch(() => {});
  }, GUEST_EVERY);
}

export function announceChanges(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || QUIET.includes(req.path)) return next();
  const fromGuest = req.path.startsWith("/portal/");
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    if (fromGuest) return announceGuests();
    // This copy's guest pages at once (other copies when they hear it)
    forgetPages();
    announceChange(String(req.get("x-foyer-tab") ?? "").slice(0, 64)).catch(() => {});
  });
  next();
}
