// "npm run db:demo": fills an EMPTY database with the example data the
// pages used before the server existed (5 sites, guests and sign-ins
// for the reports, vouchers, a whitelist, splash ads), plus the example
// logins: admin@example.com / foyer-demo and manager@example.com /
// client-demo. For trying Foyer on your own computer, not for SiteGround.
//
// It stops if there are already sites, so it can't mix into real data.
import "../config.js";
import { count, sql } from "drizzle-orm";
import { db, closeDb } from "./index.js";
import { migrateDatabase } from "./migrate.js";
import * as t from "./schema.js";
import { hashPassword } from "../auth.js";
import { seal } from "../secrets.js";
import { STARTING_CONTROLLERS, STARTING_SITES } from "../../src/data.js";
import { STARTING_ADMINS } from "../../src/admins.js";
import { STARTING_VOUCHERS } from "../../src/vouchers.js";
import { STARTING_WHITELIST } from "../../src/whitelist.js";
import { STARTING_ADS } from "../../src/ads.js";
import { STARTING_CONNECTIONS, STARTING_GUESTS } from "../../src/guests.js";
import { siteIn } from "../shapes.js";

const date = (ms) => (ms ? new Date(ms) : null);

try {
  await migrateDatabase();
  const [{ n }] = await db.select({ n: count() }).from(t.sites);
  if (n > 0) {
    console.log("There are already sites in this database, so nothing was added.");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    for (const u of STARTING_ADMINS)
      await tx
        .insert(t.users)
        .values({
          name: u.name,
          email: u.email,
          passwordHash: await hashPassword(u.password),
          role: u.role,
          siteIds: u.siteIds,
          access: u.access,
        })
        .onConflictDoNothing();

    await tx.insert(t.controllers).values(
      STARTING_CONTROLLERS.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        url: c.url,
        username: c.username,
        passwordSealed: seal("example-password"),
        allowSelfSigned: c.allowSelfSigned,
        timeUnit: c.timeUnit,
      })),
    );
    await tx.insert(t.sites).values(
      STARTING_SITES.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        controllerId: s.controllerId,
        active: s.active,
        settings: siteIn(s),
      })),
    );
    await tx.insert(t.vouchers).values(
      STARTING_VOUCHERS.map((v) => ({
        ...v,
        validUntil: date(v.validUntil),
        createdAt: date(v.createdAt),
      })),
    );
    await tx.insert(t.whitelist).values(
      STARTING_WHITELIST.map((w) => ({
        ...w,
        expiresAt: date(w.expiresAt),
        createdAt: date(w.createdAt),
      })),
    );
    await tx.insert(t.ads).values(
      STARTING_ADS.map((a) => ({
        ...a,
        startsAt: date(a.startsAt),
        endsAt: date(a.endsAt),
        createdAt: date(a.createdAt),
      })),
    );
    await tx.insert(t.guests).values(
      STARTING_GUESTS.map((g) => ({
        ...g,
        firstSeenAt: date(g.firstSeenAt),
        lastSeenAt: date(g.lastSeenAt),
      })),
    );
    // In chunks: there are a few thousand
    for (let i = 0; i < STARTING_CONNECTIONS.length; i += 1000)
      await tx.insert(t.connections).values(
        STARTING_CONNECTIONS.slice(i, i + 1000).map((c) => ({ ...c, at: date(c.at) })),
      );

    // The next new row in each table gets the next free number
    for (const table of ["controllers", "sites", "vouchers", "whitelist", "ads", "guests", "connections"])
      await tx.execute(
        sql.raw(
          `select setval(pg_get_serial_sequence('${table}', 'id'), (select max(id) from ${table}))`,
        ),
      );
  });
  console.log("✓ Example data added. Sign in with admin@example.com / foyer-demo");
} catch (err) {
  console.error("Adding the example data failed:", err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
