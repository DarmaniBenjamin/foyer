// Emails to the people looking after Foyer when a controller goes
// offline, and when it's back. Sent through any email account's SMTP
// server (on SiteGround: an email account made in Site Tools → Email).
//   ALERT_EMAIL     who gets them (several: separated by commas)
//   SMTP_HOST       the email server, e.g. mail.yourdomain.com
//   SMTP_PORT       465 (the usual), or 587
//   SMTP_USER       the email account, e.g. alerts@yourdomain.com
//   SMTP_PASSWORD   its password
//   SMTP_FROM       who it's from (SMTP_USER if not set)
// Without them nothing is sent: the controller still shows as offline in
// Foyer (with the red dot) and on the guests' sign-in page.
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { sites } from "./db/schema.js";

const env = process.env;
let mailer = null;
function sender() {
  if (!env.ALERT_EMAIL || !env.SMTP_HOST || !env.SMTP_USER) return null;
  const port = Number(env.SMTP_PORT) || 465;
  mailer ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" },
  });
  return mailer;
}

// "Nov 20, 10:42 AM" in Grenada time (where the clients are)
const when = (ms) =>
  new Date(ms).toLocaleString("en-US", {
    timeZone: env.TZ || "America/Grenada",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// controller: its row; result: the check that changed it ({ ok, message })
export async function controllerAlert(controller, result) {
  const mail = sender();
  const kind = controller.kind === "omada" ? "Omada" : "UniFi";
  const names = (await db.select({ name: sites.name }).from(sites).where(eq(sites.controllerId, controller.id))).map(
    (s) => s.name,
  );
  const affected = names.length ? names.join(", ") : "no sites yet";
  const subject = result.ok
    ? `✅ ${controller.name} is back online`
    : `⚠️ ${controller.name} is offline: guests can't sign in`;
  const text = result.ok
    ? [
        `${controller.name} (${kind}) is answering again since ${when(Date.now())}.`,
        `Guests can sign in again at: ${affected}.`,
      ].join("\n\n")
    : [
        `Foyer can't reach ${controller.name} (${kind}) since ${when(Date.now())}.`,
        `Why: ${result.message || "it didn't answer"}`,
        `Guests at these sites see the sign-in page with a notice, but can't get online: ${affected}.`,
        "Foyer checks it again every 5 minutes and emails you when it's back.",
      ].join("\n\n");
  console.log(`${subject} (${affected})`);
  if (!mail) return;
  try {
    await mail.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: env.ALERT_EMAIL,
      subject,
      text,
    });
  } catch (err) {
    console.error(`Couldn't email the alert: ${err.message}`);
  }
}
