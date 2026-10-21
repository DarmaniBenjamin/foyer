// /api/controllers: the UniFi and Omada controllers (admins only). The
// password is locked before it's saved and never sent back to the page.
// (Test connection and letting guests on come in the next step.)
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { controllers } from "../db/schema.js";
import { requireAccess } from "../auth.js";
import { seal } from "../secrets.js";
import { Problem, controllerOut, text } from "../shapes.js";

export const controllersRouter = Router();
controllersRouter.use(requireAccess("controllers"));

function controllerIn(body, { editing }) {
  const kind = body?.kind === "omada" ? "omada" : "unifi";
  const url = text(body?.url, 300).replace(/\/+$/, "");
  const out = {
    name: text(body?.name, 120),
    kind,
    url,
    username: text(body?.username, 200),
    allowSelfSigned: Boolean(body?.allowSelfSigned),
    timeUnit: ["auto", "us", "ms"].includes(body?.timeUnit) ? body.timeUnit : "auto",
  };
  if (!out.name) throw new Problem("Give the controller a name.");
  if (!/^https?:\/\/[^\s/]+/i.test(url))
    throw new Problem("The address should look like https://unifi.example.com:8443");
  if (!out.username) throw new Problem("Enter the username.");
  // Empty when editing = keep the saved password
  const password = String(body?.password ?? "");
  if (password) out.passwordSealed = seal(password);
  else if (!editing) throw new Problem("Enter the password.");
  return out;
}

controllersRouter.post("/", async (req, res) => {
  const [row] = await db
    .insert(controllers)
    .values(controllerIn(req.body, { editing: false }))
    .returning();
  res.json(controllerOut(row));
});

controllersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  // Only the last test result changed (the page saves it after testing)
  const changes =
    Object.keys(body).length === 1 && "lastTest" in body
      ? { lastTest: body.lastTest }
      : controllerIn(body, { editing: true });
  // A changed address, login or password: the old test no longer says much
  if (!("lastTest" in changes)) changes.lastTest = null;
  const [row] = await db.update(controllers).set(changes).where(eq(controllers.id, id)).returning();
  if (!row) throw new Problem("That controller was already removed.", 404);
  res.json(controllerOut(row));
});

controllersRouter.delete("/:id", async (req, res) => {
  await db.delete(controllers).where(eq(controllers.id, Number(req.params.id)));
  res.json({ ok: true });
});
