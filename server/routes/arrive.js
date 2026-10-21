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
// sign-in page.
import { Router } from "express";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { controllers, sites, whitelist } from "../db/schema.js";
import { fromOmada, fromUnifi, seal } from "../context.js";
import { authorizeGuest } from "../controllers/index.js";

export const arriveRouter = Router();

const portalPage = (slug, extra = {}) =>
  `/p/${encodeURIComponent(slug)}?${new URLSearchParams(extra)}`;

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

async function sendOn(res, site, ctx) {
  if (!ctx) return res.redirect(302, portalPage(site.slug));
  if (site.active && (await letWhitelistedOn(site, ctx)))
    return res.redirect(302, portalPage(site.slug, { done: "1" }));
  res.redirect(302, portalPage(site.slug, seal(ctx)));
}

// UniFi: the site is found by its UniFi site name (Sites → Details).
// If two Foyer sites use the same name on different UniFi controllers,
// the first one is used.
arriveRouter.get("/guest/s/:siteKey", async (req, res) => {
  const key = String(req.params.siteKey);
  const [site] = await db
    .select({ site: sites })
    .from(sites)
    .innerJoin(controllers, eq(sites.controllerId, controllers.id))
    .where(and(eq(controllers.kind, "unifi"), sql`${sites.settings}->>'siteKey' = ${key}`))
    .orderBy(sites.id);
  if (!site) return res.redirect(302, portalPage(`unifi-${key}`));
  await sendOn(res, site.site, fromUnifi(key, req.query));
});

// Omada: the site is found by its address name
arriveRouter.get("/omada/:slug", async (req, res) => {
  const [site] = await db.select().from(sites).where(eq(sites.slug, String(req.params.slug)));
  if (!site) return res.redirect(302, portalPage(String(req.params.slug)));
  await sendOn(res, site, fromOmada(req.query));
});
