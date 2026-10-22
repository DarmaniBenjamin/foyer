// Turning database rows into what the pages use (and back): the same
// shapes the example data had, with times as milliseconds.
import { normalizeMac } from "../src/whitelist.js";

export const ms = (date) => (date ? date.getTime() : null);
export const toDate = (value) =>
  value === null || value === undefined || value === "" ? null : new Date(Number(value));

// Small checks for what the pages send
export const text = (value, max = 200) => String(value ?? "").trim().slice(0, max);
export const whole = (value, { min = 0, max = 1e9 } = {}) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
export const limit = (value) => whole(value, { min: 1, max: 1e7 }); // null = no limit
const picture = (value) => {
  const s = String(value ?? "");
  return /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/.test(s) && s.length < 8_000_000 ? s : null;
};

// Throw this from a route for a 400 with words the page shows
export class Problem extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------- Controllers ----------

export const controllerOut = (c) => ({
  id: c.id,
  name: c.name,
  kind: c.kind,
  url: c.url,
  username: c.username,
  allowSelfSigned: c.allowSelfSigned,
  timeUnit: c.timeUnit,
  lastTest: c.lastTest ?? null,
});

// ---------- Sites ----------

// Kept as columns; everything else is in settings
const SITE_COLUMNS = ["id", "name", "slug", "controllerId", "active", "createdAt"];

// unifiBackup (the UniFi settings from before "Set up on UniFi", for
// Undo) stays on the server: it can hold the controller's secrets. The
// pages only learn whether there is one (unifiUndo).
export const siteOut = (s) => {
  const { unifiBackup, ...settings } = s.settings ?? {};
  return {
    ...settings,
    unifiUndo: Boolean(unifiBackup),
    id: s.id,
    name: s.name,
    slug: s.slug,
    controllerId: s.controllerId,
    active: s.active,
  };
};

// A site from the editor → the columns and settings to save
export function siteIn(body) {
  const settings = {};
  for (const [key, value] of Object.entries(body ?? {}))
    if (!SITE_COLUMNS.includes(key)) settings[key] = value;
  // Worked out by the server, never saved from a page
  delete settings.unifiBackup;
  delete settings.unifiUndo;
  for (const key of ["look"])
    if (settings[key]) {
      settings[key] = { ...settings[key] };
      for (const pic of ["logo", "backgroundImage"])
        if (settings[key][pic]) settings[key][pic] = picture(settings[key][pic]);
    }
  if (JSON.stringify(settings).length > 12_000_000)
    throw new Problem("The pictures are too big. Use smaller ones.");
  return settings;
}

// ---------- Vouchers, whitelist, ads ----------

export const voucherOut = (v) => ({
  id: v.id,
  siteId: v.siteId,
  code: v.code,
  batch: v.batch,
  minutes: v.minutes,
  maxUses: v.maxUses,
  uses: v.uses,
  downKbps: v.downKbps,
  upKbps: v.upKbps,
  dataMb: v.dataMb,
  validUntil: ms(v.validUntil),
  createdAt: ms(v.createdAt),
});

export const whitelistOut = (w) => ({
  id: w.id,
  siteId: w.siteId,
  mac: w.mac,
  note: w.note,
  expiresAt: ms(w.expiresAt),
  downKbps: w.downKbps,
  upKbps: w.upKbps,
  dataMb: w.dataMb,
  createdAt: ms(w.createdAt),
});

export function whitelistIn(body) {
  const mac = normalizeMac(body?.mac);
  if (!mac) throw new Problem("Enter the device's MAC address, like 08:57:FB:7F:4A:88.");
  return {
    mac,
    note: text(body?.note, 200),
    expiresAt: toDate(body?.expiresAt),
    downKbps: limit(body?.downKbps),
    upKbps: limit(body?.upKbps),
    dataMb: limit(body?.dataMb),
  };
}

export const adOut = (a) => ({
  id: a.id,
  siteId: a.siteId,
  name: a.name,
  image: a.image,
  link: a.link,
  seconds: a.seconds,
  when: a.when,
  active: a.active,
  startsAt: ms(a.startsAt),
  endsAt: ms(a.endsAt),
  views: a.views,
  clicks: a.clicks,
  createdAt: ms(a.createdAt),
});

// changes: only the fields given (turning an ad on or off sends one)
export function adIn(body, { partial = false } = {}) {
  const out = {};
  const has = (key) => !partial || key in (body ?? {});
  if (has("name")) out.name = text(body.name, 120);
  if (has("image")) {
    out.image = picture(body.image);
    if (!out.image) throw new Problem("Upload the ad's picture.");
  }
  if (has("link")) {
    out.link = text(body.link, 2000);
    if (out.link && !/^https?:\/\/\S+\.\S+/.test(out.link))
      throw new Problem("The link should start with https://");
  }
  if (has("seconds")) out.seconds = whole(body.seconds, { min: 1, max: 60 }) ?? 5;
  if (has("when")) out.when = body.when === "after" ? "after" : "before";
  if (has("active")) out.active = Boolean(body.active);
  if (has("startsAt")) out.startsAt = toDate(body.startsAt);
  if (has("endsAt")) out.endsAt = toDate(body.endsAt);
  if (!partial && !out.name) throw new Problem("Give the ad a name.");
  return out;
}

// ---------- Guests and sign-ins ----------

// withDetails: false for client logins without access to guest data
// (the reports still count them, without who they are)
export const guestOut = (g, withDetails = true) => ({
  id: g.id,
  siteId: g.siteId,
  mac: withDetails ? g.mac : "",
  answers: withDetails ? g.answers : {},
  visits: g.visits,
  firstSeenAt: ms(g.firstSeenAt),
  lastSeenAt: ms(g.lastSeenAt),
});

export const connectionOut = (c, withDetails = true) => ({
  id: c.id,
  siteId: c.siteId,
  guestId: c.guestId,
  mac: withDetails ? c.mac : "",
  method: c.method,
  minutes: c.minutes,
  ok: c.ok,
  at: ms(c.at),
});
