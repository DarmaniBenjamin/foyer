// Keeping Foyer awake. Hosts like SiteGround stop an app that has had no
// visitors for a while (e.g. overnight) and only start it again when the
// next visitor arrives. Starting takes a while, and a phone joining the
// Wi-Fi only waits a few seconds for the sign-in page before giving up:
// so the first guest of the morning could wait minutes, or never see it.
//
// So Foyer visits itself every 4 minutes, through its public address
// (the way a guest would, so the host counts it as a visitor), and is
// never idle long enough to be stopped.
//   - the address: PUBLIC_URL if set (e.g. https://kyvr3.sg-host.com),
//     otherwise the one visitors use, once Foyer has checked it really
//     leads back to Foyer itself (a made-up address in a request can't
//     send it visiting someone else's site)
//   - KEEP_AWAKE=off turns it off
// For the host stopping the app anyway (a restart, a redeploy), a cron
// job that opens /api/health every 5 minutes wakes it up again.
import crypto from "node:crypto";

const EVERY = Number(process.env.KEEP_AWAKE_MS) || 4 * 60 * 1000;
const OFF = /^(off|no|false|0)$/i.test(process.env.KEEP_AWAKE ?? "");

let address = (process.env.PUBLIC_URL ?? "").trim().replace(/\/+$/, "") || null;
let timer = null;
let checking = null; // { candidate, token, at }: an address being checked

// Not when it's a computer on its own (testing)
const local = (host) => /^(localhost|127\.|\[?::1\]?|0\.0\.0\.0)(:|$)/i.test(host);

// Every request (app.js): learns the public address from visitors
export function noteAddress(req, res, next) {
  if (address) return next();
  // The check coming back: the address leads here
  if (checking && req.path === "/api/awake-check") {
    if (String(req.query.t ?? "") === checking.token) {
      address = checking.candidate;
      checking = null;
    }
    return res.status(204).end();
  }
  const host = req.get("host") ?? "";
  if (!host || local(host) || !/^[\w.-]+(:\d+)?$/.test(host)) return next();
  // One check at a time
  if (checking) return next();
  const candidate = `${req.protocol}://${host}`;
  const token = crypto.randomBytes(16).toString("hex");
  checking = { candidate, token };
  fetch(`${candidate}/api/awake-check?t=${token}`, {
    headers: { "user-agent": "Foyer keep-awake" },
    redirect: "manual",
    signal: AbortSignal.timeout(10 * 1000),
  })
    .catch(() => {})
    // Didn't lead here (or reached another copy of Foyer): the next
    // visitor's address is checked
    .finally(() => setTimeout(() => checking?.token === token && (checking = null), 1000));
  next();
}

export function keepAwake() {
  if (OFF || timer) return;
  timer = setInterval(async () => {
    if (!address) return;
    try {
      await fetch(`${address}/api/health`, {
        headers: { "user-agent": "Foyer keep-awake" },
        signal: AbortSignal.timeout(20 * 1000),
      });
    } catch {
      // Offline for a moment: next time
    }
  }, EVERY);
  timer.unref();
}

export const awakeAddress = () => address;
