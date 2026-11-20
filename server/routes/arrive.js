// Where the controllers send guests when they join the Wi-Fi. Each one
// reads the guest's details from the address, then sends them on to the
// site's sign-in page (/p/<site>) with those details signed (ctx, sig),
// so signing in can let that exact device on.
//
//   UniFi:  /guest/s/<UniFi site name>/?id=<MAC>&ap=…   (the Linode's
//           nginx forwards the controller's IP address here)
//   Omada:  /omada/<site's address name>?clientMac=…&apMac=…
//
// A device on the site's whitelist is let on straight away, without the
// sign-in page. So is everyone while the site is in maintenance mode
// "Let guests on" (Maintenance page); in "Maintenance page" mode they
// see that page instead.
import { Router } from "express";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { whitelist } from "../db/schema.js";
import { fromOmada, fromUnifi, seal } from "../context.js";
import { authorizeGuest } from "../controllers/index.js";
import { guestSiteBySlug, guestSites } from "../guestCache.js";

export const arriveRouter = Router();

// The full address (https://kyvr3.sg-host.com/p/...), not just /p/...:
// guests can arrive through the controller server, which fetches this
// for them (so it can show a page of its own when Foyer is down), and
// the phone must then go on to Foyer, not stay on the controller server.
// PUBLIC_URL if set, otherwise the address this request was made to.
function portalPage(res, slug, extra = {}) {
  const req = res.req;
  const fixed = (process.env.PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  const host = req.get("host") ?? "";
  const base = fixed || (/^[\w.-]+(:\d+)?$/.test(host) ? `${req.protocol}://${host}` : "");
  return `${base}/p/${encodeURIComponent(slug)}?${new URLSearchParams(extra)}`;
}

// A whitelisted device: let on now, for as long as its entry lasts (or
// 30 days, and again each time it comes back). true if it worked.
async function letWhitelistedOn(site, ctx) {
  const now = new Date();
  const [entry] = await db
    .select()
    .from(whitelist)
    .where(
      and(
        eq(whitelist.siteId, site.id),
        eq(whitelist.mac, ctx.mac),
        or(isNull(whitelist.expiresAt), gt(whitelist.expiresAt, now)),
      ),
    );
  if (!entry) return false;
  const minutes = entry.expiresAt
    ? Math.max(1, Math.ceil((entry.expiresAt - now) / 60000))
    : 30 * 24 * 60;
  try {
    await authorizeGuest(site, ctx, {
      minutes,
      downKbps: entry.downKbps,
      upKbps: entry.upKbps,
      dataMb: entry.dataMb,
    });
    return true;
  } catch (err) {
    console.error(`Whitelisted ${ctx.mac} at ${site.name}: ${err.message}`);
    return false;
  }
}

// Maintenance mode "Let guests on": everyone, with the site's own time
// and limits. true if it worked.
async function letEveryoneOn(site, ctx) {
  const s = site.settings ?? {};
  try {
    await authorizeGuest(site, ctx, {
      minutes: s.minutes ?? 120,
      downKbps: s.downKbps ?? null,
      upKbps: s.upKbps ?? null,
      dataMb: s.dataMb ?? null,
    });
    return true;
  } catch (err) {
    console.error(`Maintenance mode, ${ctx.mac} at ${site.name}: ${err.message}`);
    return false;
  }
}

async function sendOn(res, site, ctx) {
  if (!ctx) return res.redirect(302, portalPage(res, site.slug));
  // Whitelisted devices (TVs, FireSticks) get on even during maintenance
  if (site.active && (await letWhitelistedOn(site, ctx)))
    return res.redirect(302, portalPage(res, site.slug, { done: "1" }));
  const mode = site.settings?.maintenance?.mode ?? "off";
  if (mode === "notice") return res.redirect(302, portalPage(res, site.slug));
  if (mode === "open" && (await letEveryoneOn(site, ctx)))
    return res.redirect(302, portalPage(res, site.slug, { done: "1" }));
  res.redirect(302, portalPage(res, site.slug, seal(ctx, site.id)));
}

// UniFi: the site is found by its UniFi site name (Sites → Details).
// Several Foyer sites can have the same UniFi site (one per Wi-Fi
// network, or an old one that was undone or turned off), so the best one
// is picked:
//   1. set up on the Wi-Fi network the guest joined (UniFi says which)
//   2. set up from Foyer on that UniFi site (not undone)
//   3. turned on
//   4. the newest
export function pickUnifiSite(rows, ssid) {
  const wifi = (ssid ?? "").trim().toLowerCase();
  const score = (s) => {
    const unifi = s.settings?.unifi;
    return (
      (unifi && wifi && (unifi.wlanName ?? "").trim().toLowerCase() === wifi ? 8 : 0) +
      (unifi ? 4 : 0) +
      (s.active ? 2 : 0)
    );
  };
  return [...rows].sort((a, b) => score(b) - score(a) || b.id - a.id)[0] ?? null;
}

arriveRouter.get("/guest/s/:siteKey", async (req, res) => {
  const key = String(req.params.siteKey);
  const rows = (await guestSites()).filter((s) => s.controllerKind === "unifi" && s.settings?.siteKey === key);
  const ctx = fromUnifi(key, req.query);
  const site = pickUnifiSite(rows, ctx?.ssid ?? req.query.ssid);
  if (!site) return res.redirect(302, portalPage(res, `unifi-${key}`));
  await sendOn(res, site, ctx);
});

// Omada: the site is found by its address name
arriveRouter.get("/omada/:slug", async (req, res) => {
  const site = await guestSiteBySlug(req.params.slug);
  if (!site) return res.redirect(302, portalPage(res, String(req.params.slug)));
  await sendOn(res, site, fromOmada(req.query));
});
