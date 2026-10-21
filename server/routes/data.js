// GET /api/data: everything the admin pages show, loaded once after
// signing in. A client login only gets their own sites and what their
// access allows (see src/admins.js); the server decides, not the page.
//
// Sign-ins (connections) older than 13 months aren't sent, so the page
// stays quick as the years go by. They stay in the database.
import { Router } from "express";
import { and, asc, desc, gte, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  ads,
  connections,
  controllers,
  guests,
  sites,
  users,
  vouchers,
  whitelist,
} from "../db/schema.js";
import { ownSiteIds, publicUser, requireUser } from "../auth.js";
import { canAccess } from "../../src/admins.js";
import {
  adOut,
  connectionOut,
  controllerOut,
  guestOut,
  siteOut,
  voucherOut,
  whitelistOut,
} from "../shapes.js";

export const dataRouter = Router();

const MONTHS_KEPT = 13;

dataRouter.get("/", requireUser, async (req, res) => {
  const user = req.user;
  const can = (area) => canAccess(user, area, "read");
  const own = ownSiteIds(user);
  const siteIds = own ? [...own] : null;

  // Rows for this person's sites only (a client with no sites gets none)
  const forSites = (table, query) =>
    siteIds ? (siteIds.length ? query.where(inArray(table.siteId, siteIds)) : null) : query;
  const rows = async (q) => (q ? await q : []);

  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_KEPT);

  const siteRows = await (siteIds
    ? siteIds.length
      ? db.select().from(sites).where(inArray(sites.id, siteIds)).orderBy(asc(sites.name))
      : []
    : db.select().from(sites).orderBy(asc(sites.name)));

  const recent = gte(connections.at, since);
  const connectionRows = await (siteIds && !siteIds.length
    ? []
    : db
        .select()
        .from(connections)
        .where(siteIds ? and(recent, inArray(connections.siteId, siteIds)) : recent)
        .orderBy(asc(connections.at)));

  const details = can("guests");
  res.json({
    user: publicUser(user),
    users: user.role === "client" ? [] : (await db.select().from(users).orderBy(asc(users.name))).map(publicUser),
    controllers:
      user.role === "client"
        ? []
        : (await db.select().from(controllers).orderBy(asc(controllers.name))).map(controllerOut),
    sites: siteRows.map(siteOut),
    vouchers: can("vouchers")
      ? (await rows(forSites(vouchers, db.select().from(vouchers).orderBy(desc(vouchers.createdAt), asc(vouchers.id))))).map(voucherOut)
      : [],
    whitelist: can("whitelist")
      ? (await rows(forSites(whitelist, db.select().from(whitelist).orderBy(desc(whitelist.createdAt))))).map(whitelistOut)
      : [],
    ads: can("ads")
      ? (await rows(forSites(ads, db.select().from(ads).orderBy(desc(ads.createdAt))))).map(adOut)
      : [],
    // Always sent (the reports count new and returning guests), but
    // without names, answers and MACs unless they may see guest data
    guests: (await rows(forSites(guests, db.select().from(guests)))).map((g) => guestOut(g, details)),
    connections: connectionRows.map((c) => connectionOut(c, details)),
  });
});
