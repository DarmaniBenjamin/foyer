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
import { authorizeGuest } from "../controllers/index.js";

export const portalRouter = Router();

async function findSite(slug) {
  const [row] = await db.select().from(sites).where(eq(sites.slug, String(slug)));
  if (!row) throw new Problem("This Wi-Fi page doesn't exist.", 404);
  return row;
}

// The site's page settings and its running splash ads
portalRouter.get("/:slug", async (req, res) => {
  const row = await findSite(req.params.slug);
  const now = Date.now();
  // Without the view and tap counts, or which controller it uses
  const running = (await db.select().from(ads).where(eq(ads.siteId, row.id)))
    .map(adOut)
    .filter((a) => adStatus(a, now) === "running")
    .map((a) => ({ ...a, views: undefined, clicks: undefined }));
  res.json({ site: { ...siteOut(row), controllerId: undefined, unifi: undefined }, ads: running });
});

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
  const ctx = open(req.body?.ctx, req.body?.sig);
  if (req.body?.ctx && !ctx)
    throw new Problem("This sign-in page has expired. Turn the Wi-Fi off and on again to get a new one.");
  const mac = ctx?.mac ?? (req.user ? normalizeMac(req.body?.mac) : "");
  if (!mac) throw new Problem("Open this page by joining the Wi-Fi.");
  const answers = site.mode === "form" ? cleanAnswers(site, req.body?.answers) : {};

  let voucher = null;
  if (site.mode === "voucher") {
    const code = cleanCode(req.body?.code);
    const list = await db.select().from(vouchers).where(eq(vouchers.siteId, row.id));
    voucher = list.find((v) => cleanCode(v.code) === code);
    if (!code || !voucher) return res.json({ error: "That code isn't right. Check it and try again." });
    const status = voucherStatus(voucherOut(voucher));
    if (status === "used") return res.json({ error: "That code has already been used." });
    if (status === "expired") return res.json({ error: "That code has expired." });
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

  if (voucher) {
    // Counted only if a use is still left (two phones at once can't both
    // take the last one)
    const [counted] = await db
      .update(vouchers)
      .set({ uses: sql`${vouchers.uses} + 1` })
      .where(and(eq(vouchers.id, voucher.id), lt(vouchers.uses, vouchers.maxUses)))
      .returning();
    if (!counted) return res.json({ error: "That code has already been used." });
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

// A splash ad was seen, or tapped
for (const kind of ["view", "click"])
  portalRouter.post(`/ads/:id/${kind}`, async (req, res) => {
    const column = kind === "view" ? ads.views : ads.clicks;
    await db
      .update(ads)
      .set({ [kind === "view" ? "views" : "clicks"]: sql`${column} + 1` })
      .where(eq(ads.id, Number(req.params.id)));
    res.json({ ok: true });
  });
