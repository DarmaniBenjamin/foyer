// Signing in and out, the first-admin setup link, and who may do what.
//
// Same way as Uplink: the password is checked against a scrambled copy
// (bcrypt), then a long random session token goes in an httpOnly cookie
// and only its hash is kept in the sessions table. Sessions last 30 days.
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { and, count, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "./db/index.js";
import { sessions, users } from "./db/schema.js";
import { PASSWORD_RULE, canAccess, validEmail } from "../src/admins.js";

const COOKIE = "foyer_session";
const SESSION_DAYS = 30;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// What the pages get about a person (never the password)
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  siteIds: u.siteIds ?? [],
  access: u.access ?? {},
  createdAt: u.createdAt?.getTime() ?? null,
  lastActiveAt: u.lastActiveAt?.getTime() ?? null,
});

// A wrong email takes as long to check as a wrong password
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
export const hashPassword = (password) => bcrypt.hash(password, 12);

async function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt: expires });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    path: "/",
    expires,
  });
}

// ---------- Slowing down password guessing ----------
// 10 wrong passwords for one email from one place, or 50 from one place
// for any emails, block sign-in from there for 15 minutes
const WINDOW = 15 * 60 * 1000;
const attempts = new Map();
function isBlocked(key, max) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.since > WINDOW) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= max;
}
function recordFailure(key) {
  if (attempts.size > 10000)
    for (const [k, v] of attempts) if (Date.now() - v.since > WINDOW) attempts.delete(k);
  const entry = attempts.get(key) ?? { count: 0, since: Date.now() };
  entry.count += 1;
  attempts.set(key, entry);
}

// ---------- Who is signed in? (runs before every /api request) ----------

export async function loadSession(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!token) return next();
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())));
  if (row) {
    req.user = row.user;
    req.sessionHash = tokenHash;
    // "Last active", at most once a minute
    if (!row.user.lastActiveAt || Date.now() - row.user.lastActiveAt.getTime() > 60_000)
      db.update(users)
        .set({ lastActiveAt: new Date() })
        .where(eq(users.id, row.user.id))
        .catch(() => {});
  }
  next();
}

// ---------- Checks for the routes ----------

// Signed in, as anyone
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please sign in again." });
  next();
}

// May see ("read") or change ("write") an area (see src/admins.js)
export const requireAccess = (area, level = "read") => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Please sign in again." });
  if (!canAccess(req.user, area, level))
    return res.status(403).json({ error: "You don't have access to do that." });
  next();
};

// The sites this person may see: null = every site (admins)
export const ownSiteIds = (user) =>
  user.role === "client" ? new Set(user.siteIds ?? []) : null;

export const mayUseSite = (user, siteId) => {
  const own = ownSiteIds(user);
  return !own || own.has(Number(siteId));
};

// ---------- /api/auth ----------

export const authRouter = Router();

authRouter.get("/me", async (req, res) => {
  const [{ n }] = await db.select({ n: count() }).from(users);
  res.json({ user: req.user ? publicUser(req.user) : null, needsSetup: n === 0 });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });

  const key = `${req.ip}|${email}`;
  const place = `${req.ip}|*`;
  if (isBlocked(key, 10) || isBlocked(place, 50))
    return res
      .status(429)
      .json({ error: "Too many wrong passwords. Wait 15 minutes and try again." });

  const [user] = await db.select().from(users).where(eq(users.email, email));
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    recordFailure(key);
    recordFailure(place);
    return res.status(401).json({ error: "That email or password is wrong." });
  }
  attempts.delete(key);
  // Old sessions are tidied away now and then
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", async (req, res) => {
  if (req.sessionHash) await db.delete(sessions).where(eq(sessions.tokenHash, req.sessionHash));
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

// My account: your own name and email
authRouter.patch("/me", requireUser, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "Enter your name." });
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a real email address." });
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, req.user.id)));
  if (taken) return res.status(409).json({ error: "Someone already signs in with that email." });
  const [user] = await db
    .update(users)
    .set({ name, email })
    .where(eq(users.id, req.user.id))
    .returning();
  res.json({ user: publicUser(user) });
});

// My account: change your password (signs out your other devices)
authRouter.post("/password", requireUser, async (req, res) => {
  const current = String(req.body?.current ?? "");
  const next = String(req.body?.password ?? "");
  if (!(await bcrypt.compare(current, req.user.passwordHash)))
    return res.status(400).json({ error: "Your current password is wrong." });
  if (next.length < 10) return res.status(400).json({ error: PASSWORD_RULE });
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, req.user.id));
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, req.user.id), ne(sessions.tokenHash, req.sessionHash)));
  res.json({ ok: true });
});

// ---------- /api/setup: the first admin ----------
// Only works while nobody has been added yet, and only with SETUP_CODE
// from the environment variables (the page is /setup/<SETUP_CODE>).

export const setupRouter = Router();

setupRouter.post("/", async (req, res) => {
  const code = String(req.body?.code ?? "");
  const expected = process.env.SETUP_CODE ?? "";
  const place = `${req.ip}|setup`;
  if (isBlocked(place, 10)) return res.status(429).json({ error: "Too many tries. Wait 15 minutes." });
  const codeOk =
    expected.length >= 12 &&
    code.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected));
  if (!codeOk) {
    recordFailure(place);
    return res.status(403).json({
      error:
        expected.length < 12
          ? "Set SETUP_CODE (12 or more characters) in the environment variables first, then restart the app."
          : "That setup link isn't right. Check SETUP_CODE.",
    });
  }
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) return res.status(409).json({ error: "The first admin is already made. Sign in instead." });

  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!name || !validEmail(email)) return res.status(400).json({ error: "Enter your name and email." });
  if (password.length < 10) return res.status(400).json({ error: PASSWORD_RULE });

  const [user] = await db
    .insert(users)
    .values({ name, email, role: "admin", passwordHash: await hashPassword(password) })
    .returning();
  await startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});
