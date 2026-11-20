// Foyer checks every controller by itself, every 5 minutes: the same as
// pressing Test connection. A check that fails is tried again a minute
// later before the controller shows as offline, so one dropped request
// doesn't. When one goes offline or comes back, every open tab hears it
// (live.js) and shows it.
//
// Hosts like SiteGround stop the app when nobody has used it for a while,
// and the checks stop with it; when it starts again, controllers not
// checked for 5 minutes are checked straight away.
// CONTROLLER_CHECKS=off turns this off; CONTROLLER_CHECK_MS sets how
// often, in milliseconds (300000 = 5 minutes, the usual).
//
// A guest's sign-in that fails has the controller checked straight away
// (checkNow), so the next guests see "sign-in may not work" on the page
// within seconds, not minutes. Going offline and coming back are also
// emailed to ALERT_EMAIL (alerts.js).
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { controllers } from "../db/schema.js";
import { runTest, saveTest } from "./index.js";
import { announceChange } from "../live.js";
import { controllerAlert } from "../alerts.js";

const EVERY = Number(process.env.CONTROLLER_CHECK_MS) || 5 * 60 * 1000;
// A failed check is tried again this much later (a minute, usually)
const TRY_AGAIN_AFTER = Math.min(60 * 1000, EVERY / 5);
const FIRST_CHECK_AFTER = Math.min(10 * 1000, EVERY);

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

// now: checked even if it was checked lately, and a failed check is
// tried again after 5 seconds (not a minute)
async function checkOne(id, { now = false } = {}) {
  const fresh = async () => (await db.select().from(controllers).where(eq(controllers.id, id)))[0];
  let row = await fresh();
  // Removed, or just checked (Test connection, or another copy of Foyer)
  if (!row || (!now && row.lastTest?.at && Date.now() - row.lastTest.at < EVERY * 0.9)) return;
  let result = await runTest(row);
  if (!result.ok) {
    await pause(now ? 5000 : TRY_AGAIN_AFTER);
    row = await fresh();
    if (!row) return;
    result = await runTest(row);
  }
  const was = row.lastTest;
  await saveTest(row, result, { auto: true });
  // Went offline, came back, or offline for another reason: tell the tabs
  // (and the sign-in pages, which say whether sign-in may not work)
  if (!was || was.ok !== result.ok || (!result.ok && was.message !== result.message)) await announceChange();
  // Went offline or came back: an email
  if (was && was.ok !== result.ok) controllerAlert(row, result).catch(() => {});
}

// A guest's sign-in failed: check that controller now, once a minute at
// most (a crowd's failed sign-ins don't each start a check)
const checkedNow = new Map(); // controller id → when
export function checkNow(id) {
  if (!id || Date.now() - (checkedNow.get(id) ?? 0) < 60 * 1000) return;
  checkedNow.set(id, Date.now());
  checkOne(id, { now: true }).catch(() => {});
}

async function checkAll() {
  try {
    const rows = await db.select({ id: controllers.id }).from(controllers).orderBy(asc(controllers.id));
    // All at once: one that's slow, or being tried again, doesn't hold
    // up the others
    await Promise.all(rows.map((r) => checkOne(r.id).catch(() => {})));
  } catch {
    // The database wasn't there for a moment: next time
  }
}

let started = false;
export function startWatching() {
  if (started || /^(off|no|false|0)$/i.test(process.env.CONTROLLER_CHECKS ?? "")) return;
  started = true;
  const loop = async () => {
    await checkAll();
    setTimeout(loop, EVERY).unref();
  };
  setTimeout(loop, FIRST_CHECK_AFTER).unref();
}
