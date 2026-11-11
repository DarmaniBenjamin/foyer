// Pictures and videos uploaded in the splash ad builder.
//   POST /api/media?siteId=3&name=promo.mp4  (the file itself as the body)
//     → { url: "/media/<key>", type, size }
//   GET /media/<key>: the file, for anyone (guests see it before they're
//     online, so it comes from Foyer itself). Videos are sent a piece at
//     a time (Range), which phones need to play them. ?download=1 saves
//     it instead of showing it.
//   GET /ad-pictures/<ad id>/<code>: a picture of a picture ad (they're
//     kept inside the ad), so it has a web address to open or share; see
//     pictureLinks in shapes.js. ?download=1 saves it.
// They're kept in the database, not as files, so they survive the app
// being put up again.
import crypto from "node:crypto";
import express, { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { ads, media, sites } from "../db/schema.js";
import { mayUseSite, requireAccess } from "../auth.js";
import { Problem, pictureCode, text } from "../shapes.js";
import { adPictures } from "../../src/ads.js";

const MB = 1024 * 1024;
export const MEDIA_LIMITS = { image: 8 * MB, video: 40 * MB };
const TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const mediaRouter = Router();
mediaRouter.use(requireAccess("ads", "write"));

mediaRouter.post("/", express.raw({ type: () => true, limit: "45mb" }), async (req, res) => {
  const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (!TYPES.includes(type))
    throw new Problem("Only pictures (JPG, PNG, WebP, GIF) and videos (MP4, WebM, MOV) can be uploaded.");
  const kind = type.split("/")[0];
  const body = req.body;
  if (!Buffer.isBuffer(body) || !body.length) throw new Problem("That file is empty.");
  if (body.length > MEDIA_LIMITS[kind])
    throw new Problem(
      kind === "video"
        ? "Videos can be up to 40 MB. Use a shorter or smaller one, or a YouTube link."
        : "Pictures can be up to 8 MB.",
    );
  const siteId = Number(req.query.siteId);
  if (!mayUseSite(req.user, siteId)) throw new Problem("You don't have access to that site.", 403);
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId));
  if (!site) throw new Problem("Pick a site first.");
  const key = crypto.randomBytes(12).toString("base64url");
  await db.insert(media).values({
    key,
    siteId,
    type,
    name: text(req.query.name, 200),
    size: body.length,
    data: body,
  });
  res.json({ url: `/media/${key}`, type, size: body.length });
});

const extension = (type) =>
  ({ "image/jpeg": "jpg", "image/svg+xml": "svg", "video/quicktime": "mov" })[type] ?? type.split("/")[1] ?? "bin";

// A file name from the ad's name, e.g. "back-to-school-sale-2.jpg"
const fileName = (name, n, type) =>
  `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "splash-ad"}-${n}.${extension(type)}`;

// GET /ad-pictures/:id/:code
export async function serveAdPicture(req, res) {
  const id = Number(req.params.id);
  const code = String(req.params.code ?? "");
  if (!Number.isInteger(id) || !/^[\w-]{16}$/.test(code)) return res.status(404).end();
  const [ad] = await db.select().from(ads).where(eq(ads.id, id));
  const pictures = ad ? adPictures(ad) : [];
  const n = pictures.findIndex((p) => pictureCode(p.image) === code);
  if (n < 0) return res.status(404).end();

  // "data:image/jpeg;base64,…" or "data:image/svg+xml;charset=utf-8,…"
  const found = /^data:([\w/+.-]+)((?:;[\w-]+=[\w-]+)*)(;base64)?,(.*)$/s.exec(pictures[n].image);
  if (!found) return res.status(404).end();
  const [, type, , base64, data] = found;
  const bytes = base64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");

  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  // The address changes when the picture does, so it can be kept
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", bytes.length);
  // A picture made by someone else can't run anything when opened
  if (type === "image/svg+xml") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  if (req.query.download) res.attachment(fileName(ad.name, n + 1, type));
  res.end(req.method === "HEAD" ? undefined : bytes);
}

// GET (and HEAD) /media/:key
export async function serveMedia(req, res) {
  const key = String(req.params.key ?? "");
  if (!/^[\w-]{8,40}$/.test(key)) return res.status(404).end();
  const [row] = await db
    .select({ id: media.id, type: media.type, size: media.size, name: media.name })
    .from(media)
    .where(eq(media.key, key));
  if (!row) return res.status(404).end();

  // These never change (a new upload gets a new address), so browsers
  // and caches may keep them
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", row.type);
  res.setHeader("Accept-Ranges", "bytes");
  if (req.query.download) res.attachment(row.name || `${key}.${extension(row.type)}`);

  let start = 0;
  let end = row.size - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    if (range[1] === "") start = Math.max(0, row.size - Number(range[2]));
    else {
      start = Number(range[1]);
      if (range[2]) end = Math.min(end, Number(range[2]));
    }
    if (start > end || start >= row.size) {
      res.setHeader("Content-Range", `bytes */${row.size}`);
      return res.status(416).end();
    }
    res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${row.size}`);
  }
  const length = end - start + 1;
  res.setHeader("Content-Length", length);
  if (req.method === "HEAD") return res.end();
  // Only the part asked for comes out of the database
  const result = await db.execute(
    sql`select substring(data from ${start + 1} for ${length}) as part from media where id = ${row.id}`,
  );
  res.end(result.rows[0].part);
}
