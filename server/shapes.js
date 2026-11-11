// Turning database rows into what the pages use (and back): the same
// shapes the example data had, with times as milliseconds.
import crypto from "node:crypto";
import { AD_PICTURES, adPictures, cleanLook } from "../src/ads.js";
import { cleanDesign } from "../src/adDesign.js";
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
  // Never the secret, only whether there is one
  openApi: c.openApi?.clientId ? { clientId: c.openApi.clientId } : null,
});

// ---------- Sites ----------

// Kept as columns; everything else is in settings
const SITE_COLUMNS = ["id", "name", "slug", "controllerId", "active", "createdAt"];

// Kept on the server only, never sent to a page: the controller settings
// from before "Set up on UniFi/Omada" (for Undo; they can hold the
// controller's secrets) and the site's own Omada Hotspot Operator. The
// pages only learn whether there's something to undo (unifiUndo,
// omadaUndo).
export const SERVER_ONLY = ["unifiBackup", "omadaBackup", "omadaOperator"];

export const siteOut = (s) => {
  const settings = { ...(s.settings ?? {}) };
  for (const key of SERVER_ONLY) delete settings[key];
  return {
    ...settings,
    unifiUndo: Boolean(s.settings?.unifiBackup),
    omadaUndo: Boolean(s.settings?.omadaBackup),
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
  for (const key of [...SERVER_ONLY, "unifiUndo", "omadaUndo"]) delete settings[key];
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

// A picture's own web address: /ad-pictures/<ad id>/<a code made from the
// picture>. It stays the same when pictures are put in another order and
// changes when the picture is replaced, and it can't be guessed.
export const pictureCode = (image) => crypto.createHash("sha256").update(image).digest("base64url").slice(0, 16);
export const pictureLinks = (a) => adPictures(a).map((p) => `/ad-pictures/${a.id}/${pictureCode(p.image)}`);

export const adOut = (a) => ({
  id: a.id,
  siteId: a.siteId,
  name: a.name,
  image: a.image,
  link: a.link,
  more: Array.isArray(a.more) ? a.more : [],
  design: a.design ?? null,
  look: a.look ?? null,
  pictureLinks: a.design ? [] : pictureLinks(a),
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
  // A built page (src/adDesign.js), or null for an ad that's its pictures
  if (has("design")) {
    out.design = body.design ? cleanDesign(body.design) : null;
    if (out.design && !out.design.sections.length) throw new Problem("Add something to the page first.");
  }
  if (has("image")) {
    // A built page needs no picture of its own (the list shows the page)
    out.image = picture(body.image) ?? "";
    if (!out.image && !out.design) throw new Problem("Upload the ad's picture.");
  }
  if (has("link")) {
    out.link = text(body.link, 2000);
    if (out.link && !/^https?:\/\/\S+\.\S+/.test(out.link))
      throw new Problem("The link should start with https://");
  }
  // The pictures under the first one, top to bottom (see AD_PICTURES)
  if (has("more")) {
    const list = Array.isArray(body.more) ? body.more : [];
    if (list.length > AD_PICTURES - 1) throw new Problem(`An ad can have up to ${AD_PICTURES} pictures.`);
    out.more = list.map((p) => {
      const image = picture(p?.image);
      if (!image) throw new Problem("One of the ad's pictures isn't a picture. Upload it again.");
      const link = text(p?.link, 2000);
      if (link && !/^https?:\/\/\S+\.\S+/.test(link))
        throw new Problem("A picture's link should start with https://");
      return { image, link };
    });
  }
  // Picture sizes on a computer, tablet and phone (see AD_LOOK)
  if (has("look")) out.look = cleanLook(body.look);
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
