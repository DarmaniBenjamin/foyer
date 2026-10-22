// The one place the rest of the server talks to controllers through:
// it reads the controller from the database (unlocking its password)
// and hands over to unifi.js or omada.js.
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { controllers } from "../db/schema.js";
import { unseal } from "../secrets.js";
import { ControllerError } from "./http.js";
import * as unifi from "./unifi.js";
import * as omada from "./omada.js";

export { ControllerError };

const withPassword = (row) => ({ ...row, password: unseal(row.passwordSealed) });

// Test connection. The result is saved on the controller (lastTest), so
// the Controllers page shows when each one last worked. For Omada it
// also keeps the version and controller ID, needed to let guests on.
export async function testController(row) {
  let result;
  try {
    const controller = withPassword(row);
    const found =
      row.kind === "omada" ? await omada.test(controller) : await unifi.test(controller);
    result = {
      ok: true,
      message: found.message,
      version: found.version ?? null,
      omadaId: found.omadaId ?? null,
      sites: found.sites ?? null,
    };
  } catch (err) {
    result = { ok: false, message: err.message };
    // Keep what an earlier test found (the Omada ID still works)
    if (row.lastTest?.omadaId) {
      result.omadaId = row.lastTest.omadaId;
      result.version = row.lastTest.version;
    }
  }
  result.at = Date.now();
  const [saved] = await db
    .update(controllers)
    .set({ lastTest: result })
    .where(eq(controllers.id, row.id))
    .returning();
  return saved;
}

// Lets one guest's device on, through the site's controller.
// siteRow: the sites row. ctx: what the controller put in the guest's
// address (see context.js). access: { minutes, downKbps, upKbps, dataMb }
export async function authorizeGuest(siteRow, ctx, access) {
  if (!siteRow.controllerId)
    throw new ControllerError("This site isn't linked to a controller.");
  const [row] = await db.select().from(controllers).where(eq(controllers.id, siteRow.controllerId));
  if (!row) throw new ControllerError("This site's controller was removed.");
  const controller = withPassword(row);
  if (controller.kind !== ctx.kind)
    throw new ControllerError(
      `This site uses a ${controller.kind === "omada" ? "Omada" : "UniFi"} controller, but the guest came from ${ctx.kind === "omada" ? "Omada" : "UniFi"}.`,
    );
  if (controller.kind === "omada") return omada.authorize(controller, ctx.raw, access);
  return unifi.authorize(
    controller,
    ctx.siteKey || siteRow.settings?.siteKey || "default",
    { mac: ctx.mac, apMac: ctx.apMac },
    access,
  );
}

// ---------- Site settings → Controller ----------

async function controllerRow(id) {
  const [row] = await db.select().from(controllers).where(eq(controllers.id, Number(id)));
  if (!row) throw new ControllerError("That controller was removed.");
  return withPassword(row);
}

// The sites on a controller: [{ key, name }] (UniFi only; Omada is set
// up by hand)
export async function controllerSites(id) {
  const controller = await controllerRow(id);
  if (controller.kind !== "unifi")
    throw new ControllerError("Omada sites are set up by hand. Follow the steps on the page.");
  return unifi.listSites(controller);
}

export async function controllerWlans(id, siteKey) {
  const controller = await controllerRow(id);
  if (controller.kind !== "unifi") throw new ControllerError("Only for UniFi.");
  return unifi.listWlans(controller, siteKey);
}

// What a UniFi site's guest portal does now (see unifi.js portalState)
export async function controllerPortal(id, siteKey) {
  const controller = await controllerRow(id);
  if (controller.kind !== "unifi") throw new ControllerError("Only for UniFi.");
  return unifi.portalState(controller, siteKey);
}

// Points a UniFi site's guest portal at Foyer (see unifi.js setUpPortal).
// Returns { done, before }.
export async function setUpUnifi(id, siteKey, options) {
  const controller = await controllerRow(id);
  if (controller.kind !== "unifi") throw new ControllerError("Only for UniFi.");
  return unifi.setUpPortal(controller, siteKey, options);
}

// Undo: puts back what was there before (see unifi.js restorePortal)
export async function undoUnifi(id, siteKey, before) {
  const controller = await controllerRow(id);
  if (controller.kind !== "unifi") throw new ControllerError("Only for UniFi.");
  return unifi.restorePortal(controller, siteKey, before);
}
