// /api/sites: adding, saving and deleting sites (admins only).
// A new site starts with the same settings as before (makeSite in
// src/data.js).
import { Router } from "express";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { eq, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { controllers, sites, users } from "../db/schema.js";
import { requireAccess } from "../auth.js";
import { SIGN_IN_MODES, SITE_COLORS, makeSite, makeSlug } from "../../src/data.js";
import crypto from "node:crypto";
import { Problem, SERVER_ONLY, siteIn, siteOut, text } from "../shapes.js";
import { seal } from "../secrets.js";
import {
  ControllerError,
  setUpOmada,
  setUpUnifi,
  undoOmada,
  undoUnifi,
} from "../controllers/index.js";

export const sitesRouter = Router();
sitesRouter.use(requireAccess("sites"));

async function checkController(id) {
  if (id === null || id === undefined || id === "") return null;
  const [row] = await db.select({ id: controllers.id }).from(controllers).where(eq(controllers.id, Number(id)));
  if (!row) throw new Problem("Pick a controller.");
  return row.id;
}

// { name, controllerId, mode } → the new site
sitesRouter.post("/", async (req, res) => {
  const name = text(req.body?.name, 120);
  if (!name) throw new Problem("Give the site a name.");
  const mode = req.body?.mode in SIGN_IN_MODES ? req.body.mode : "form";
  const controllerId = await checkController(req.body?.controllerId);
  const all = await db.select({ slug: sites.slug }).from(sites);
  const slug = makeSlug(name, all.map((s) => s.slug));
  const site = makeSite({
    id: 0,
    name,
    slug,
    controllerId,
    mode,
    color: SITE_COLORS[all.length % SITE_COLORS.length],
  });
  const [row] = await db
    .insert(sites)
    .values({ name, slug, controllerId, active: true, settings: siteIn(site) })
    .returning();
  res.json(siteOut(row));
});

// The whole site from the editor
sitesRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  const name = text(body.name, 120);
  const slug = text(body.slug, 40);
  if (!name) throw new Problem("Give the site a name.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new Problem("The address name can only have small letters, numbers and dashes.");
  const [clash] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(sql`${sites.slug} = ${slug} and ${sites.id} <> ${id}`);
  if (clash) throw new Problem("Another site already uses that address name.");
  const [old] = await db.select({ settings: sites.settings }).from(sites).where(eq(sites.id, id));
  if (!old) throw new Problem("That site was already deleted.", 404);
  // The backups and the Omada operator aren't on the page, so keep them
  const settings = siteIn(body);
  for (const key of SERVER_ONLY) if (old.settings?.[key]) settings[key] = old.settings[key];
  const [row] = await db
    .update(sites)
    .set({
      name,
      slug,
      controllerId: await checkController(body.controllerId),
      active: body.active !== false,
      settings,
    })
    .where(eq(sites.id, id))
    .returning();
  if (!row) throw new Problem("That site was already deleted.", 404);
  res.json(siteOut(row));
});

// Deletes the site with its vouchers, whitelist, ads, guests and
// sign-ins, and takes it off client logins
sitesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(sites).where(eq(sites.id, id));
  const clients = await db.select().from(users).where(ne(users.role, "admin"));
  for (const u of clients)
    if ((u.siteIds ?? []).includes(id))
      await db
        .update(users)
        .set({ siteIds: u.siteIds.filter((s) => s !== id) })
        .where(eq(users.id, u.id));
  res.json({ ok: true });
});

// The IPv4 address of a name ("unifi.example.com" → "203.0.113.5"), or
// null for addresses that only work inside this computer or network
async function ipv4Of(host) {
  try {
    const ip = isIP(host) === 4 ? host : (await lookup(host, { family: 4 })).address;
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(ip)) return null;
    return ip;
  } catch {
    return null;
  }
}

// Site settings → Controller → Set up on UniFi.
// { controllerId, siteKey, siteName, wlanId, wlanName, portalIp }
// Points the UniFi site's guest portal at the Linode (portalIp, or the
// controller's own address when empty), lets phones reach the Linode and
// Foyer before signing in, turns the guest portal on for the Wi-Fi
// network, and saves all that on the site.
sitesRouter.post("/:id/unifi-setup", requireAccess("controllers"), async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(sites).where(eq(sites.id, id));
  if (!row) throw new Problem("That site was already deleted.", 404);
  const body = req.body ?? {};
  const controllerId = await checkController(body.controllerId);
  if (!controllerId) throw new Problem("Pick a controller.");
  const siteKey = text(body.siteKey, 60);
  const wlanId = text(body.wlanId, 60);
  if (!siteKey) throw new Problem("Pick the UniFi site.");
  if (!wlanId) throw new Problem("Pick the Wi-Fi network.");

  const [controller] = await db.select().from(controllers).where(eq(controllers.id, controllerId));
  let portalIp = text(body.portalIp, 45);
  if (portalIp && isIP(portalIp) !== 4)
    throw new Problem("The portal server IP should look like 203.0.113.5.");
  if (!portalIp) portalIp = await ipv4Of(new URL(controller.url).hostname);
  if (!portalIp)
    throw new Problem(
      "Couldn't work out your Linode's public IP from the controller's address. Type it in (Portal server IP).",
    );
  // Foyer's own address too, when it's on another server (SiteGround)
  const foyerIp = await ipv4Of(req.hostname);
  const allowHosts = [...new Set([portalIp, foyerIp].filter(Boolean))];

  let result;
  try {
    result = await setUpUnifi(controllerId, siteKey, { wlanId, portalIp, allowHosts });
  } catch (err) {
    if (err instanceof ControllerError) throw new Problem(err.message);
    throw err;
  }
  const { done, before } = result;

  // The backup for Undo: what the UniFi site had before Foyer first set
  // it up. Setting it up again (another Wi-Fi network) keeps that first
  // backup and adds the new network's old on/off.
  const kept = row.settings?.unifiBackup;
  const unifiBackup =
    kept && kept.controllerId === controllerId && kept.siteKey === siteKey
      ? { ...kept, wlans: { ...before.wlans, ...kept.wlans } }
      : { controllerId, siteKey, guestAccess: before.guestAccess, wlans: before.wlans, at: Date.now() };

  const unifi = {
    siteName: text(body.siteName, 120) || siteKey,
    wlanId,
    wlanName: text(body.wlanName, 120),
    portalIp,
    allowHosts,
    setupAt: Date.now(),
  };
  const [saved] = await db
    .update(sites)
    .set({
      controllerId,
      settings: sql`${sites.settings} || ${JSON.stringify({ siteKey, unifi, unifiBackup })}::jsonb`,
    })
    .where(eq(sites.id, id))
    .returning();
  res.json({ site: siteOut(saved), done });
});

// Site settings → Controller → Undo: puts the UniFi site's guest portal
// settings and Wi-Fi network back how they were before Foyer set it up
sitesRouter.post("/:id/unifi-undo", requireAccess("controllers"), async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(sites).where(eq(sites.id, id));
  if (!row) throw new Problem("That site was already deleted.", 404);
  const backup = row.settings?.unifiBackup;
  if (!backup) throw new Problem("There's nothing to undo for this site.");
  try {
    await undoUnifi(backup.controllerId, backup.siteKey, backup);
  } catch (err) {
    if (err instanceof ControllerError) throw new Problem(err.message);
    throw err;
  }
  const [saved] = await db
    .update(sites)
    .set({ settings: sql`(${sites.settings} - 'unifiBackup') || '{"unifi": null}'::jsonb` })
    .where(eq(sites.id, id))
    .returning();
  res.json(siteOut(saved));
});

// A controller that can't be reached or refuses: words for the page
async function onController(work) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ControllerError) throw new Problem(err.message);
    throw err;
  }
}

// Site settings → Controller → Set up on Omada (with the Open API).
// { controllerId, siteKey (Omada site ID), siteName, wlanId, wlanName }
// Makes the portal, the Pre-Authentication Access entry and the site's
// own Hotspot Operator, and saves it all on the site.
sitesRouter.post("/:id/omada-setup", requireAccess("controllers"), async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(sites).where(eq(sites.id, id));
  if (!row) throw new Problem("That site was already deleted.", 404);
  const body = req.body ?? {};
  const controllerId = await checkController(body.controllerId);
  if (!controllerId) throw new Problem("Pick a controller.");
  const siteKey = text(body.siteKey, 60);
  const wlanId = text(body.wlanId, 60);
  if (!siteKey) throw new Problem("Pick the Omada site.");
  if (!wlanId) throw new Problem("Pick the Wi-Fi network.");

  // Guests come to this site's Omada address on Foyer
  const origin = `${req.protocol}://${req.get("host")}`;
  const portalUrl = `${origin}/omada/${row.slug}`;
  const operatorName = `foyer-${row.slug}`.slice(0, 60);
  const operatorPassword = crypto.randomBytes(18).toString("base64url");

  const { done, before } = await onController(() =>
    setUpOmada(controllerId, siteKey, {
      ssidId: wlanId,
      portalName: `Foyer ${row.name}`.slice(0, 120),
      portalUrl,
      host: req.hostname,
      minutes: row.settings?.minutes,
      operatorName,
      operatorPassword,
    }),
  );

  // The backup for Undo: what the Omada site had before Foyer first set
  // it up (setting it up again keeps that first backup)
  const kept = row.settings?.omadaBackup;
  const omadaBackup =
    kept && kept.controllerId === controllerId && kept.before.siteId === siteKey
      ? kept
      : { controllerId, operatorName, before, at: Date.now() };
  const omada = {
    siteName: text(body.siteName, 120) || siteKey,
    wlanId,
    wlanName: text(body.wlanName, 120),
    portalUrl,
    host: req.hostname,
    operator: operatorName,
    setupAt: Date.now(),
  };
  const omadaOperator = { name: operatorName, passwordSealed: seal(operatorPassword) };
  const [saved] = await db
    .update(sites)
    .set({
      controllerId,
      settings: sql`${sites.settings} || ${JSON.stringify({ omadaSite: siteKey, omada, omadaBackup, omadaOperator })}::jsonb`,
    })
    .where(eq(sites.id, id))
    .returning();
  res.json({ site: siteOut(saved), done });
});

// Site settings → Controller → Undo (Omada): the other portals and
// Pre-Authentication Access back how they were, Foyer's portal and
// operator gone
sitesRouter.post("/:id/omada-undo", requireAccess("controllers"), async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(sites).where(eq(sites.id, id));
  if (!row) throw new Problem("That site was already deleted.", 404);
  const backup = row.settings?.omadaBackup;
  if (!backup) throw new Problem("There's nothing to undo for this site.");
  await onController(() => undoOmada(backup.controllerId, backup.before, backup.operatorName));
  const [saved] = await db
    .update(sites)
    .set({
      settings: sql`(${sites.settings} - 'omadaBackup' - 'omadaOperator') || '{"omada": null}'::jsonb`,
    })
    .where(eq(sites.id, id))
    .returning();
  res.json(siteOut(saved));
});
