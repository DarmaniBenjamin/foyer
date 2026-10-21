// What belongs to a site: vouchers, the device whitelist, splash ads and
// guests. Client logins need write access to that area, and can only
// touch their own sites.
import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { ads, guests, sites, vouchers, whitelist } from "../db/schema.js";
import { mayUseSite, ownSiteIds, requireAccess } from "../auth.js";
import { makeCodes } from "../../src/vouchers.js";
import {
  Problem,
  adIn,
  adOut,
  limit,
  text,
  toDate,
  voucherOut,
  whitelistIn,
  whitelistOut,
  whole,
} from "../shapes.js";

// The site exists and this person may use it
async function checkSite(user, siteId) {
  const id = Number(siteId);
  if (!mayUseSite(user, id)) throw new Problem("You don't have access to that site.", 403);
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, id));
  if (!site) throw new Problem("Pick a site.");
  return id;
}

// One row of a table, if it's on one of this person's sites
async function findOwn(table, id, user) {
  const [row] = await db.select().from(table).where(eq(table.id, Number(id)));
  if (!row || !mayUseSite(user, row.siteId)) throw new Problem("That was already removed.", 404);
  return row;
}

// ---------- Vouchers ----------

export const vouchersRouter = Router();
vouchersRouter.use(requireAccess("vouchers", "write"));

// { siteId, count, batch, minutes, maxUses, downKbps, upKbps, dataMb,
//   validUntil } → the new vouchers
vouchersRouter.post("/", async (req, res) => {
  const b = req.body ?? {};
  const siteId = await checkSite(req.user, b.siteId);
  const count = whole(b.count, { min: 1, max: 500 });
  if (!count) throw new Problem("Make between 1 and 500 at a time.");
  const taken = new Set(
    (await db.select({ code: vouchers.code }).from(vouchers).where(eq(vouchers.siteId, siteId))).map(
      (v) => v.code,
    ),
  );
  const values = {
    siteId,
    batch: text(b.batch, 120) || "Batch",
    minutes: whole(b.minutes, { min: 1, max: 525600 }) ?? 120,
    maxUses: whole(b.maxUses, { min: 1, max: 100 }) ?? 1,
    downKbps: limit(b.downKbps),
    upKbps: limit(b.upKbps),
    dataMb: limit(b.dataMb),
    validUntil: toDate(b.validUntil),
  };
  const rows = await db
    .insert(vouchers)
    .values(makeCodes(count, taken).map((code) => ({ ...values, code })))
    .returning();
  res.json(rows.map(voucherOut));
});

// { ids: [...] }
vouchersRouter.post("/delete", async (req, res) => {
  const ids = (req.body?.ids ?? []).map(Number).filter(Number.isFinite);
  if (!ids.length) return res.json({ ok: true });
  const own = ownSiteIds(req.user);
  await db
    .delete(vouchers)
    .where(own ? and(inArray(vouchers.id, ids), inArray(vouchers.siteId, [...own, -1])) : inArray(vouchers.id, ids));
  res.json({ ok: true });
});

// ---------- Device whitelist ----------

export const whitelistRouter = Router();
whitelistRouter.use(requireAccess("whitelist", "write"));

async function checkMacFree(siteId, mac, id = null) {
  const [same] = await db
    .select({ id: whitelist.id })
    .from(whitelist)
    .where(and(eq(whitelist.siteId, siteId), eq(whitelist.mac, mac)));
  if (same && same.id !== id) throw new Problem("That device is already on this site's whitelist.");
}

whitelistRouter.post("/", async (req, res) => {
  const siteId = await checkSite(req.user, req.body?.siteId);
  const values = { siteId, ...whitelistIn(req.body) };
  if (!values.note) throw new Problem("Add a note so you know what the device is.");
  await checkMacFree(siteId, values.mac);
  const [row] = await db.insert(whitelist).values(values).returning();
  res.json(whitelistOut(row));
});

whitelistRouter.patch("/:id", async (req, res) => {
  const old = await findOwn(whitelist, req.params.id, req.user);
  const siteId = await checkSite(req.user, req.body?.siteId ?? old.siteId);
  const values = { siteId, ...whitelistIn(req.body) };
  await checkMacFree(siteId, values.mac, old.id);
  const [row] = await db.update(whitelist).set(values).where(eq(whitelist.id, old.id)).returning();
  res.json(whitelistOut(row));
});

whitelistRouter.delete("/:id", async (req, res) => {
  const old = await findOwn(whitelist, req.params.id, req.user);
  await db.delete(whitelist).where(eq(whitelist.id, old.id));
  res.json({ ok: true });
});

// ---------- Splash ads ----------

export const adsRouter = Router();
adsRouter.use(requireAccess("ads", "write"));

adsRouter.post("/", async (req, res) => {
  const siteId = await checkSite(req.user, req.body?.siteId);
  const [row] = await db
    .insert(ads)
    .values({ siteId, ...adIn(req.body) })
    .returning();
  res.json(adOut(row));
});

adsRouter.patch("/:id", async (req, res) => {
  const old = await findOwn(ads, req.params.id, req.user);
  const changes = adIn(req.body, { partial: true });
  if ("siteId" in (req.body ?? {})) changes.siteId = await checkSite(req.user, req.body.siteId);
  const [row] = await db.update(ads).set(changes).where(eq(ads.id, old.id)).returning();
  res.json(adOut(row));
});

adsRouter.delete("/:id", async (req, res) => {
  const old = await findOwn(ads, req.params.id, req.user);
  await db.delete(ads).where(eq(ads.id, old.id));
  res.json({ ok: true });
});

// ---------- Guests ----------

export const guestsRouter = Router();
guestsRouter.use(requireAccess("guests", "write"));

// Forget a guest: their answers go; their sign-ins still count in the
// reports, without them
guestsRouter.delete("/:id", async (req, res) => {
  const old = await findOwn(guests, req.params.id, req.user);
  await db.delete(guests).where(eq(guests.id, old.id));
  res.json({ ok: true });
});
