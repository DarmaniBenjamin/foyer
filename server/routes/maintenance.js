// /api/maintenance: the Maintenance page (admins only).
//   GET  /health   the server, the database and the controllers at a glance
//   PUT  /mode     maintenance mode for some or all sites
//   POST /cleanup  old guest data: how much there is ({ check: true }),
//                  or delete it
//   GET  /backup   everything in the database as one JSON file
//   POST /restore  puts a backup back: replaces everything with it
import { Router } from "express";
import { count, getTableColumns, inArray, lt, sql } from "drizzle-orm";
import { db, schemaName } from "../db/index.js";
import {
  ads,
  connections,
  controllers,
  guests,
  media,
  sessions,
  sites,
  users,
  vouchers,
  whitelist,
} from "../db/schema.js";
import { unseal } from "../secrets.js";
import { requireAccess } from "../auth.js";
import { Problem, controllerOut, siteOut, text, whole } from "../shapes.js";

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAccess("maintenance"));

const STARTED = Date.now();
const MAINTENANCE_MODES = ["off", "notice", "open"];

maintenanceRouter.get("/health", async (req, res) => {
  const started = Date.now();
  const {
    rows: [db1],
  } = await db.execute(
    sql`select version() as version, pg_database_size(current_database()) as size`,
  );
  const took = Date.now() - started;
  const counted = async (table) => (await db.select({ n: count() }).from(table))[0].n;
  res.json({
    server: {
      startedAt: STARTED,
      node: process.version,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    database: {
      ok: true,
      answeredInMs: took,
      version: String(db1.version).split(" on ")[0],
      sizeBytes: Number(db1.size),
      area: schemaName() || "public",
    },
    counts: {
      sites: await counted(sites),
      guests: await counted(guests),
      connections: await counted(connections),
      vouchers: await counted(vouchers),
      whitelist: await counted(whitelist),
      ads: await counted(ads),
      users: await counted(users),
    },
    controllers: (await db.select().from(controllers)).map(controllerOut),
  });
});

// { siteIds: [1, 2] or "all", mode: "off" | "notice" | "open", message }
// notice: guests see a "Wi-Fi under maintenance" page and can't sign in
// open:   guests are let straight on, without the sign-in page
maintenanceRouter.put("/mode", async (req, res) => {
  const mode = String(req.body?.mode);
  if (!MAINTENANCE_MODES.includes(mode)) throw new Problem("Pick a maintenance mode.");
  const message = text(req.body?.message, 500);
  const ids = req.body?.siteIds === "all" ? null : (req.body?.siteIds ?? []).map(Number);
  if (ids && !ids.length) throw new Problem("Pick at least one site.");
  const rows = await db
    .update(sites)
    .set({
      settings: sql`${sites.settings} || ${JSON.stringify({
        maintenance: { mode, message, since: mode === "off" ? null : Date.now() },
      })}::jsonb`,
    })
    .where(ids ? inArray(sites.id, ids) : sql`true`)
    .returning();
  res.json(rows.map(siteOut));
});

// { months, check } → { connections, guests, before }
// Sign-ins older than that, and guests not seen since then, with what
// they typed. The reports for those months are empty afterwards.
maintenanceRouter.post("/cleanup", async (req, res) => {
  const months = whole(req.body?.months, { min: 1, max: 120 });
  if (!months) throw new Problem("Pick how many months to keep.");
  const before = new Date();
  before.setMonth(before.getMonth() - months);
  const oldConnections = lt(connections.at, before);
  const oldGuests = lt(guests.lastSeenAt, before);
  if (req.body?.check) {
    const [c] = await db.select({ n: count() }).from(connections).where(oldConnections);
    const [g] = await db.select({ n: count() }).from(guests).where(oldGuests);
    return res.json({ connections: c.n, guests: g.n, before: before.getTime() });
  }
  const gone = await db.transaction(async (tx) => {
    const c = await tx.delete(connections).where(oldConnections).returning({ id: connections.id });
    const g = await tx.delete(guests).where(oldGuests).returning({ id: guests.id });
    return { connections: c.length, guests: g.length };
  });
  res.json({ ...gone, before: before.getTime() });
});

// Everything except who is signed in right now. Passwords stay scrambled
// (people) or locked with SECRET_KEY (controllers), so restoring needs
// the same SECRET_KEY. Keep the file somewhere safe: it has guests'
// details in it.
// Version 2 also has the uploaded pictures and videos (media), as base64.
// In the order they're put back (a table only points at ones before it)
const TABLES = { users, controllers, sites, vouchers, whitelist, ads, guests, connections, media };

maintenanceRouter.get("/backup", async (req, res) => {
  const out = { app: "Foyer", version: 2, madeAt: new Date().toISOString(), tables: {} };
  for (const [name, table] of Object.entries(TABLES)) {
    const rows = await db.select().from(table).orderBy(table.id);
    out.tables[name] = name === "media" ? rows.map((m) => ({ ...m, data: m.data.toString("base64") })) : rows;
  }
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="foyer-backup-${day}.json"`);
  res.send(JSON.stringify(out));
});

// A backup's row as the database takes it: only the table's own columns,
// times back to dates, files back to bytes. A backup from an older Foyer
// (fewer columns) gets the usual values for the new ones.
function fromBackup(table, row, name) {
  const out = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (!(key in row)) continue;
    let value = row[key];
    if (value !== null && column.columnType === "PgTimestamp") value = new Date(value);
    if (name === "media" && key === "data") value = Buffer.from(String(value ?? ""), "base64");
    out[key] = value;
  }
  return out;
}

// The backup file (sent as it is). Everything in Foyer is replaced by
// what's in it, all at once: if anything goes wrong on the way, nothing
// changes. Everyone is signed out (the people in the backup may differ).
maintenanceRouter.post("/restore", async (req, res) => {
  const backup = req.body;
  if (backup?.app !== "Foyer" || !backup.tables || typeof backup.tables !== "object")
    throw new Problem("That isn't a Foyer backup file.");
  if (![1, 2].includes(backup.version))
    throw new Problem("That backup is from a newer Foyer: update this one first.");
  for (const name of Object.keys(TABLES))
    if (name in backup.tables && !Array.isArray(backup.tables[name]))
      throw new Problem("That backup file is damaged.");
  const people = backup.tables.users ?? [];
  if (!people.some((u) => u.role === "admin"))
    throw new Problem("That backup has no admin in it, so nobody could sign in afterwards.");

  const counts = {};
  await db.transaction(async (tx) => {
    // An older backup without the uploaded pictures and videos: the ones
    // here now are kept (for the sites that are still there)
    const keepMedia = "media" in backup.tables ? [] : await tx.select().from(media);
    await tx.delete(sessions);
    for (const [name, table] of Object.entries(TABLES).reverse()) await tx.delete(table);
    for (const [name, table] of Object.entries(TABLES)) {
      const rows = (backup.tables[name] ?? []).map((row) => fromBackup(table, row, name));
      const batch = name === "media" ? 10 : 300;
      for (let i = 0; i < rows.length; i += batch) await tx.insert(table).values(rows.slice(i, i + batch));
      counts[name] = rows.length;
    }
    if (keepMedia.length) {
      const siteIds = new Set((backup.tables.sites ?? []).map((s) => s.id));
      const kept = keepMedia.filter((m) => m.siteId === null || siteIds.has(m.siteId));
      for (const m of kept) await tx.insert(media).values(m);
      counts.media = kept.length;
    }
    // New rows carry on from the highest number put back
    for (const name of Object.keys(TABLES))
      await tx.execute(
        sql.raw(
          `select setval(pg_get_serial_sequence('${name}', 'id'), coalesce((select max(id) from ${name}), 1), (select count(*) > 0 from ${name}))`,
        ),
      );
  });

  // The controllers' passwords only open with the SECRET_KEY they were
  // locked with
  let warning = "";
  const locked = (backup.tables.controllers ?? []).find((c) => c.passwordSealed);
  if (locked) {
    try {
      unseal(locked.passwordSealed);
    } catch {
      warning =
        "The controllers' passwords were saved with a different SECRET_KEY: enter each controller's password again (Controllers → Edit), or put back the old SECRET_KEY.";
    }
  }
  res.clearCookie("foyer_session", { path: "/" });
  res.json({ restored: counts, madeAt: backup.madeAt ?? null, warning });
});
