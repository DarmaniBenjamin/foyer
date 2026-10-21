// /api/users: the Users page (admins only). Admins and client logins.
import { Router } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, sites, users } from "../db/schema.js";
import { hashPassword, publicUser, requireAccess } from "../auth.js";
import { ACCESS_AREAS, ACCESS_LEVELS, NO_ACCESS, PASSWORD_RULE, validEmail } from "../../src/admins.js";
import { Problem, text } from "../shapes.js";

export const usersRouter = Router();
usersRouter.use(requireAccess("admins"));

// What the page sent → the row to save. user: the one being changed.
async function userIn(body, user) {
  const name = text(body?.name, 120);
  const email = text(body?.email, 200).toLowerCase();
  const role = body?.role === "client" ? "client" : "admin";
  if (!name) throw new Problem("Enter their name.");
  if (!validEmail(email)) throw new Problem("Enter a real email address.");
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(user ? and(eq(users.email, email), ne(users.id, user.id)) : eq(users.email, email));
  if (taken) throw new Problem("Someone already signs in with that email.", 409);

  const out = { name, email, role, siteIds: [], access: NO_ACCESS };
  if (role === "client") {
    const real = new Set((await db.select({ id: sites.id }).from(sites)).map((s) => s.id));
    out.siteIds = [...new Set((body?.siteIds ?? []).map(Number))].filter((id) => real.has(id));
    if (!out.siteIds.length) throw new Problem("Pick at least one site they can see.");
    out.access = {};
    for (const { key } of ACCESS_AREAS)
      out.access[key] = body?.access?.[key] in ACCESS_LEVELS ? body.access[key] : "none";
  }
  const password = String(body?.password ?? "");
  if (password || !user) {
    if (password.length < 10) throw new Problem(PASSWORD_RULE);
    out.passwordHash = await hashPassword(password);
  }
  return out;
}

usersRouter.post("/", async (req, res) => {
  const [user] = await db.insert(users).values(await userIn(req.body, null)).returning();
  res.json(publicUser(user));
});

usersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [old] = await db.select().from(users).where(eq(users.id, id));
  if (!old) throw new Problem("That person was already removed.", 404);
  const changes = await userIn(req.body, old);
  // You can't take away your own admin access
  if (id === req.user.id) changes.role = "admin";
  const [user] = await db.update(users).set(changes).where(eq(users.id, id)).returning();
  // A new password signs them out everywhere (but not you, here).
  // Access changes count straight away: it's checked on every request.
  if (changes.passwordHash)
    await db
      .delete(sessions)
      .where(
        id === req.user.id
          ? and(eq(sessions.userId, id), ne(sessions.tokenHash, req.sessionHash))
          : eq(sessions.userId, id),
      );
  res.json(publicUser(user));
});

usersRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new Problem("You can't remove yourself.");
  await db.delete(users).where(eq(users.id, id));
  res.json({ ok: true });
});
