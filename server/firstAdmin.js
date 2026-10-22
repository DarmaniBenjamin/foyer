// The first admin from the environment variables, for hosts where the
// /setup link is awkward (like Uplink on SiteGround):
//
//   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
//
// When the server starts and nobody has been added yet, that admin is
// made. Once someone exists they're ignored, so delete them afterwards
// (the password shouldn't stay in the settings).
import { count } from "drizzle-orm";
import { db } from "./db/index.js";
import { users } from "./db/schema.js";
import { hashPassword } from "./auth.js";
import { PASSWORD_RULE, validEmail } from "../src/admins.js";

export async function makeFirstAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!name && !email && !password) return;

  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) {
    console.log("• ADMIN_* are set but there's already an admin: delete them from the environment variables.");
    return;
  }
  if (!name || !validEmail(email ?? "")) {
    console.error("✗ ADMIN_NAME and a real ADMIN_EMAIL are needed to make the first admin.");
    return;
  }
  if (password.length < 10) {
    console.error(`✗ ADMIN_PASSWORD: ${PASSWORD_RULE}`);
    return;
  }
  await db
    .insert(users)
    .values({ name, email, role: "admin", passwordHash: await hashPassword(password) })
    .onConflictDoNothing();
  console.log(`✓ First admin made: ${email}. Delete ADMIN_* from the environment variables now.`);
}
