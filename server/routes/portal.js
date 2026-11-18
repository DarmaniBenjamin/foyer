// /api/portal: what the guest sign-in page (/p/<site>) uses. Guests
// aren't signed in, so this only gives out what that page shows.
//
// Signing in lets the guest's phone on through the site's controller,
// using the details the controller gave (ctx, see context.js), and saves
// the guest and their sign-in. Opened without those details (e.g. you
// trying /p/<site> in your own browser while signed in to Foyer), it's a
// test: the guest is saved with a made-up MAC address and nobody is let
// on.
import { Router } from "express";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { ads, connections, guests, sites, vouchers } from "../db/schema.js";
import { adStatus } from "../../src/ads.js";
import { voucherStatus } from "../../src/vouchers.js";
import { normalizeMac } from "../../src/whitelist.js";
import { Problem, adOut, ms, siteOut, voucherOut } from "../shapes.js";
import { open } from "../context.js";
import { mayUseSite } from "../auth.js";
import { tooMany, strike } from "../limits.js";
import { authorizeGuest } from "../controllers/index.js";
import { guestPage, guestSiteBySlug, pictureFor, sendPage } from "../guestCache.js";

export const portalRouter = Router();

// (kept in memory for the crowd: guestCache.js)
async function findSite(slug) {
  const row = await guestSiteBySlug(slug);
  if (!row) throw new Problem("This Wi-Fi page doesn't exist.", 404);
  return row;
}

// The site's page settings and its running splash ads (made once and
// kept for every phone: guestCache.js)
async function makePage(slug) {
  const row = await findSite(slug);
  const now = Date.now();
  // Without the view and tap counts, or which controller it uses
  const running = (await db.select().from(ads).where(eq(ads.siteId, row.id)))
    .map(adOut)
    .filter((a) => adStatus(a, now) === "running")
    .map((a) => ({ ...a, views: undefined, clicks: undefined, pictureLinks: undefined }));
  return { site: forGuests(row), ads: running };
}

portalRouter.get("/:slug", async (req, res) => {
  const slug = String(req.params.slug).slice(0, 200);
  sendPage(req, res, await guestPage(slug, () => makePage(slug)));
});

// GET /pic/<fingerprint>: a picture on a sign-in page. A picture Foyer
// doesn't have (it was restarted since the page was made) makes the
// pages again once, which finds it.
let remaking = null;
export async function servePicture(req, res) {
  let picture = pictureFor(req.params.key);
  if (!picture && /^[\w-]{22}$/.test(String(req.params.key))) {
    remaking ??= (async () => {
      const list = await db.select({ slug: sites.slug }).from(sites);
      for (const { slug } of list) await guestPage(slug, () => makePage(slug)).catch(() => {});
    })().finally(() => setTimeout(() => (remaking = null), 30 * 1000));
    await remaking;
    picture = pictureFor(req.params.key);
  }
  if (!picture) return res.status(404).end();
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  // The address changes when the picture does, so phones keep it
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", picture.type);
  res.setHeader("Content-Length", picture.data.length);
  if (picture.type === "image/svg+xml") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  res.end(req.method === "HEAD" ? undefined : picture.data);
}

// What the sign-in page needs of a site: how it looks and what it asks.
// Nothing about the controller behind it or how it was set up.
const ADMIN_ONLY = ["controllerId", "siteKey", "unifi", "omada", "omadaSite", "unifiUndo", "omadaUndo", "reportClient"];
function forGuests(row) {
  const site = siteOut(row);
  for (const key of ADMIN_ONLY) delete site[key];
  return site;
}

// Guessing voucher codes: 20 wrong codes from one phone stops it for 10
// minutes. Counted by phone, not by internet address: everyone at a mall
// comes from the same address, and one guest's typos mustn't lock out
// the rest. The whole address gets a much higher ceiling (a crowd makes
// typos too), which still stops anyone trying thousands of codes.
const GUESSES = { max: 20, minutes: 10 };
const PLACE_GUESSES = { max: 1500, minutes: 10 };

// "k7qm 3rxa" and "K7QM-3RXA" are the same code
const cleanCode = (code) => String(code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();

// Only the answers to the site's questions, tidied up
function cleanAnswers(site, given) {
  const answers = {};
  for (const f of site.fields ?? []) {
    const v = given?.[f.key];
    answers[f.key] = f.type === "checkbox" ? Boolean(v) : String(v ?? "").trim().slice(0, 500);
    if (f.required && !answers[f.key]) throw new Problem(`Please fill in: ${f.label}.`);
  }
  return answers;
}

// { answers, code, ctx, sig } → { minutes, next } or { error }
// (a test from a signed-in Foyer user sends mac instead of ctx)
portalRouter.post("/:slug/signin", async (req, res) => {
  const row = await findSite(req.params.slug);
  const site = siteOut(row);
  if (!site.active) throw new Problem("Wi-Fi sign-in isn't available right now.");
  if (site.maintenance?.mode === "notice")
    throw new Problem("The Wi-Fi is under maintenance. Please try again later.");
  const ctx = open(req.body?.ctx, req.body?.sig, row.id);
  if (req.body?.ctx && !ctx)
    throw new Problem("This sign-in page has expired. Turn the Wi-Fi off and on again to get a new one.");
  // A test: only someone signed in to Foyer who may use this site
  const tester = req.user && mayUseSite(req.user, row.id);
  const mac = ctx?.mac ?? (tester ? normalizeMac(req.body?.mac) : "");
  if (!mac) throw new Problem("Open this page by joining the Wi-Fi.");
  const answers = site.mode === "form" ? cleanAnswers(site, req.body?.answers) : {};

  let voucher = null;
  if (site.mode === "voucher") {
    const phone = `code|${row.id}|${mac}`;
    const place = `code|${row.id}|${req.ip}`;
    if ((await tooMany(phone, GUESSES)) || (await tooMany(place, PLACE_GUESSES)))
      return res.json({ error: "Too many wrong codes. Wait 10 minutes and try again." });
    const code = cleanCode(req.body?.code);
    // Found by the database (not by reading every code of the site)
    [voucher] = code
      ? await db
          .select()
          .from(vouchers)
          .where(
            and(
              eq(vouchers.siteId, row.id),
              sql`regexp_replace(upper(${vouchers.code}), '[^A-Z0-9]', '', 'g') = ${code}`,
            ),
          )
          .limit(1)
      : [];
    if (!code || !voucher) {
      await strike(phone, GUESSES);
      await strike(place, PLACE_GUESSES);
      return res.json({ error: "That code isn't right. Check it and try again." });
    }
    const status = voucherStatus(voucherOut(voucher));
    if (status === "used") return res.json({ error: "That code has already been used." });
    if (status === "expired") return res.json({ error: "That code has expired." });
  }

  // The code's use is taken first (two phones at once can't both take
  // the last one), and given back if the phone couldn't be let on
  if (voucher) {
    const [counted] = await db
      .update(vouchers)
      .set({ uses: sql`${vouchers.uses} + 1` })
      .where(and(eq(vouchers.id, voucher.id), lt(vouchers.uses, vouchers.maxUses)))
      .returning();
    if (!counted) return res.json({ error: "That code has already been used." });
  }

  // Let the phone on through the controller (not for a test)
  const minutes = voucher?.minutes ?? site.minutes ?? 120;
  const source = voucher ?? site;
  if (ctx) {
    try {
      await authorizeGuest(row, ctx, {
        minutes,
        downKbps: source.downKbps ?? null,
        upKbps: source.upKbps ?? null,
        dataMb: source.dataMb ?? null,
      });
    } catch (err) {
      console.error(`Letting ${mac} on at ${row.name} failed: ${err.message}`);
      if (voucher)
        await db
          .update(vouchers)
          .set({ uses: sql`greatest(${vouchers.uses} - 1, 0)` })
          .where(eq(vouchers.id, voucher.id));
      await db.insert(connections).values({
        siteId: row.id,
        guestId: null,
        mac,
        method: site.mode,
        minutes,
        ok: false,
      });
      return res.json({
        error: "Sorry, we couldn't connect you just now. Wait a moment and try again, or ask the staff.",
      });
    }
  }

  const now = new Date();
  // The same device coming back is the same guest
  const [guest] = await db
    .insert(guests)
    .values({ siteId: row.id, mac, answers, visits: 1, firstSeenAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [guests.siteId, guests.mac],
      set: {
        answers: sql`${guests.answers} || ${JSON.stringify(answers)}::jsonb`,
        visits: sql`${guests.visits} + 1`,
        lastSeenAt: now,
      },
    })
    .returning();

  await db.insert(connections).values({
    siteId: row.id,
    guestId: guest.id,
    mac,
    method: site.mode,
    minutes,
    ok: true,
    at: now,
  });
  // next: where the guest was going before the sign-in page (the
  // "Continue" button, if the site doesn't send them somewhere itself)
  res.json({ minutes, at: ms(now), next: ctx?.url ?? "", test: !ctx });
});

// A splash ad was seen, or tapped. Counted here and written together
// every few seconds: a crowd seeing the same ad would otherwise all wait
// in line to change the same row.
const counts = new Map(); // ad id → { views, clicks }
let writing = false;
async function writeCounts() {
  if (writing || !counts.size) return;
  writing = true;
  const batch = [...counts];
  counts.clear();
  try {
    for (const [id, c] of batch)
      await db
        .update(ads)
        .set({ views: sql`${ads.views} + ${c.views}`, clicks: sql`${ads.clicks} + ${c.clicks}` })
        .where(eq(ads.id, id));
  } catch (err) {
    console.error("Saving ad counts failed:", err.message);
  } finally {
    writing = false;
  }
}
setInterval(writeCounts, 5000).unref();
// Saved before this copy stops (index.js)
process.on("foyer:finish", (done) => writeCounts().finally(done));

for (const kind of ["view", "click"])
  portalRouter.post(`/ads/:id/${kind}`, (req, res) => {
    const id = Number(req.params.id);
    if (Number.isInteger(id) && id > 0) {
      const c = counts.get(id) ?? { views: 0, clicks: 0 };
      c[kind === "view" ? "views" : "clicks"] += 1;
      if (counts.size < 10000) counts.set(id, c);
    }
    res.json({ ok: true });
  });
