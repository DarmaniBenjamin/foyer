// Keeping the guest sign-in page fast when a crowd arrives at once (a
// cruise ship at the mall): thousands of phones open the same page within
// minutes, so each site's page is made once and kept, instead of reading
// the database and packing its pictures for every phone.
//
// - The page (GET /api/portal/<site>) is kept, already squeezed (gzip),
//   for 15 seconds, and forgotten at once when an admin changes anything
//   (live.js), so changes still show straight away.
// - Pictures (logo, background, ads, built pages) aren't sent inside it:
//   each becomes its own address, /pic/<fingerprint>, which phones keep
//   (it never changes; a new picture gets a new address). A phone loads
//   the small page, then only the pictures it shows.
// - The sites themselves (with their controller's kind) are kept the same
//   way: a site's settings hold its pictures, so reading it for every
//   phone arriving and signing in was most of the work.
// - Many phones asking at the same moment wait for the same one making
//   of the page (not one each).
import crypto from "node:crypto";
import zlib from "node:zlib";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { controllers, sites } from "./db/schema.js";

const KEEP_MS = 15 * 1000;
// Pictures smaller than this stay in the page (not worth an extra trip)
const SMALL = 2000;

const pages = new Map(); // site slug → { at, body, gz, etag } or a promise of one
const pictures = new Map(); // fingerprint → { type, data, used }

// An admin changed something: every page is made again on its next visit
export function forgetPages() {
  pages.clear();
  siteList = null;
}

// Every site (each with controllerKind: "unifi", "omada" or null, and
// controllerDown: its controller was offline when last checked), kept
// for 15 seconds
let siteList = null; // { at, rows } or a promise of one
export async function guestSites() {
  if (siteList && !(siteList instanceof Promise) && Date.now() - siteList.at < KEEP_MS) return siteList.rows;
  if (siteList instanceof Promise) return (await siteList).rows;
  const loading = (async () => {
    const rows = await db
      .select({ site: sites, kind: controllers.kind, lastTest: controllers.lastTest })
      .from(sites)
      .leftJoin(controllers, eq(sites.controllerId, controllers.id));
    return {
      at: Date.now(),
      rows: rows.map((r) => ({
        ...r.site,
        controllerKind: r.kind ?? null,
        // Foyer's last check of the site's controller found it offline
        controllerDown: r.lastTest?.ok === false,
      })),
    };
  })();
  siteList = loading;
  try {
    const done = await loading;
    if (siteList === loading) siteList = done;
    return done.rows;
  } catch (err) {
    if (siteList === loading) siteList = null;
    throw err;
  }
}

export async function guestSiteBySlug(slug) {
  return (await guestSites()).find((s) => s.slug === String(slug)) ?? null;
}

// Every "data:image/…;base64,…" in the page becomes /pic/<fingerprint>
function liftPictures(value) {
  if (typeof value === "string") {
    if (value.length < SMALL || !value.startsWith("data:")) return value;
    const m = /^data:([\w.+/-]+);base64,(.*)$/s.exec(value);
    if (!m || !/^(image|video)\//.test(m[1])) return value;
    const key = crypto.createHash("sha256").update(value).digest("base64url").slice(0, 22);
    const known = pictures.get(key);
    if (known) known.used = Date.now();
    else pictures.set(key, { type: m[1], data: Buffer.from(m[2], "base64"), used: Date.now() });
    return `/pic/${key}`;
  }
  if (Array.isArray(value)) return value.map(liftPictures);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = liftPictures(v);
    return out;
  }
  return value;
}

// Pictures no page has used for a day are let go
function tidyPictures() {
  const old = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, p] of pictures) if (p.used < old) pictures.delete(key);
}

// The site's page: { body, gz, etag }. make(): the page's data (reads the
// database), only called when it isn't kept already.
export async function guestPage(slug, make) {
  const kept = pages.get(slug);
  if (kept && !(kept instanceof Promise) && Date.now() - kept.at < KEEP_MS) return kept;
  if (kept instanceof Promise) return kept;
  const making = (async () => {
    const data = liftPictures(await make());
    const body = Buffer.from(JSON.stringify(data));
    const page = {
      at: Date.now(),
      body,
      gz: zlib.gzipSync(body, { level: 6 }),
      etag: `"${crypto.createHash("sha1").update(body).digest("base64url")}"`,
    };
    tidyPictures();
    return page;
  })();
  pages.set(slug, making);
  try {
    const page = await making;
    // (unless an admin changed something while it was being made)
    if (pages.get(slug) === making) pages.set(slug, page);
    return page;
  } catch (err) {
    if (pages.get(slug) === making) pages.delete(slug);
    throw err;
  }
}

// Sends a kept page, squeezed if the phone takes that
export function sendPage(req, res, page) {
  res.setHeader("ETag", page.etag);
  res.setHeader("Vary", "Accept-Encoding");
  res.type("application/json");
  if (req.get("if-none-match") === page.etag) return res.status(304).end();
  if (/\bgzip\b/.test(req.get("accept-encoding") ?? "")) {
    res.setHeader("Content-Encoding", "gzip");
    return res.send(page.gz);
  }
  res.send(page.body);
}

export const pictureFor = (key) => pictures.get(String(key)) ?? null;
