// The database's tables. After changing this file, run
// "npm run db:generate" to write the update (a migration in
// server/drizzle); the server applies it by itself when it starts.
//
// Times are "timestamp with time zone". The pages get them as numbers
// (milliseconds), like the example data had.
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const time = (name) => timestamp(name, { withTimezone: true });
const createdAt = () => time("created_at").notNull().defaultNow();

// Everyone who signs in: admins (your team) and client logins.
// siteIds and access only matter for clients (see src/admins.js).
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"), // "admin" | "client"
  siteIds: jsonb("site_ids").notNull().default([]),
  access: jsonb("access").notNull().default({}),
  createdAt: createdAt(),
  lastActiveAt: time("last_active_at"),
});

// Signed-in browsers: only a hash of each cookie's token is kept
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: time("expires_at").notNull(),
});

// UniFi and Omada controllers. The password is locked (secrets.js) and
// never sent to the pages.
export const controllers = pgTable("controllers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // "unifi" | "omada"
  url: text("url").notNull(),
  username: text("username").notNull(),
  passwordSealed: text("password_sealed").notNull(),
  allowSelfSigned: boolean("allow_self_signed").notNull().default(false),
  timeUnit: text("time_unit").notNull().default("auto"),
  lastTest: jsonb("last_test"),
  createdAt: createdAt(),
});

// A client's location. Everything the Sites editor changes besides the
// name, address name, controller and on/off (questions, look, time and
// limits...) is kept together in settings.
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  controllerId: integer("controller_id").references(() => controllers.id, {
    onDelete: "set null",
  }),
  active: boolean("active").notNull().default(true),
  settings: jsonb("settings").notNull().default({}),
  createdAt: createdAt(),
});

const siteId = () =>
  integer("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" });

export const vouchers = pgTable(
  "vouchers",
  {
    id: serial("id").primaryKey(),
    siteId: siteId(),
    code: text("code").notNull(),
    batch: text("batch").notNull(),
    minutes: integer("minutes").notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    downKbps: integer("down_kbps"),
    upKbps: integer("up_kbps"),
    dataMb: integer("data_mb"),
    validUntil: time("valid_until"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vouchers_site_code").on(t.siteId, t.code)],
);

// Devices that skip the sign-in page
export const whitelist = pgTable(
  "whitelist",
  {
    id: serial("id").primaryKey(),
    siteId: siteId(),
    mac: text("mac").notNull(),
    note: text("note").notNull().default(""),
    expiresAt: time("expires_at"),
    downKbps: integer("down_kbps"),
    upKbps: integer("up_kbps"),
    dataMb: integer("data_mb"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("whitelist_site_mac").on(t.siteId, t.mac)],
);

// Splash ads. image is the picture itself (a "data:" link).
export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  siteId: siteId(),
  name: text("name").notNull(),
  image: text("image").notNull(),
  link: text("link").notNull().default(""),
  seconds: integer("seconds").notNull().default(5),
  when: text("when").notNull().default("before"), // "before" | "after"
  active: boolean("active").notNull().default(true),
  startsAt: time("starts_at"),
  endsAt: time("ends_at"),
  views: integer("views").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  createdAt: createdAt(),
});

// One row per device per site, with what the guest typed last
export const guests = pgTable(
  "guests",
  {
    id: serial("id").primaryKey(),
    siteId: siteId(),
    mac: text("mac").notNull(),
    answers: jsonb("answers").notNull().default({}),
    visits: integer("visits").notNull().default(1),
    firstSeenAt: time("first_seen_at").notNull().defaultNow(),
    lastSeenAt: time("last_seen_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("guests_site_mac").on(t.siteId, t.mac)],
);

// Every sign-in (what the reports count)
export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    siteId: siteId(),
    guestId: integer("guest_id").references(() => guests.id, {
      onDelete: "set null",
    }),
    mac: text("mac").notNull(),
    method: text("method").notNull(), // "form" | "terms" | "voucher"
    minutes: integer("minutes").notNull(),
    ok: boolean("ok").notNull().default(true),
    at: time("at").notNull().defaultNow(),
  },
  (t) => [index("connections_site_at").on(t.siteId, t.at)],
);
