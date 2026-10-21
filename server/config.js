// The server's settings, worked out once before anything else runs.
// Same rules as Uplink's.
//
// 1. A .env file in the project's main folder (for your own computer).
//    Settings given by the hosting panel (SiteGround's Environment
//    variables) always win over the file.
// 2. HOSTING=siteground: the usual settings for SiteGround's Node.js
//    Projects (production; SiteGround looks after the domain and SSL).
// 3. The database: DATABASE_URL, or the separate parts a hosting panel
//    shows (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD), put
//    together here, so a password with symbols in it just works.
import fs from "node:fs";
import path from "node:path";

// The project's main folder (where package.json is). drizzle-kit loads
// this file without import.meta.dirname, and runs in that folder.
export const ROOT = import.meta.dirname
  ? path.resolve(import.meta.dirname, "..")
  : process.cwd();
const env = process.env;

// ---------- 1. The .env file ----------
const envFile = path.join(ROOT, ".env");
try {
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
} catch (err) {
  console.warn(`Couldn't read ${envFile}: ${err.message}`);
}

// Only fills in a setting that isn't there yet
const fallback = (name, value) => {
  if (!env[name]) env[name] = value;
};

export const ON_SITEGROUND = String(env.HOSTING).toLowerCase() === "siteground";

// ---------- 2. Hosting presets ----------
if (ON_SITEGROUND) fallback("NODE_ENV", "production");
export const PRODUCTION = env.NODE_ENV === "production";

// ---------- 3. The database ----------
export function databaseUrl() {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const name = env.DB_NAME || env.PGDATABASE;
  const user = env.DB_USER || env.PGUSER;
  if (!name || !user) return "";
  const password = env.DB_PASSWORD ?? env.PGPASSWORD ?? "";
  const host = env.DB_HOST || env.PGHOST || "localhost";
  const port = env.DB_PORT || env.PGPORT || "5432";
  // encodeURIComponent: an @, : or / in the password can't break the link
  const login = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);
  return `postgres://${login}@${host}:${port}/${encodeURIComponent(name)}`;
}
fallback("DATABASE_URL", databaseUrl());

// A plain-words reason a database problem happened, with what to do
export function explainDatabaseError(err) {
  const message = String(err?.message ?? err);
  const code = err?.code ?? err?.cause?.code;
  if (!env.DATABASE_URL)
    return "No database is set. Add DB_HOST, DB_NAME, DB_USER and DB_PASSWORD (or DATABASE_URL) to the environment variables.";
  if (/^mysql/i.test(env.DATABASE_URL))
    return "That's a MySQL database. Foyer needs PostgreSQL: create one under Site Tools → PostgreSQL instead.";
  if (code === "28P01" || code === "28000" || /password authentication failed|role .* does not exist/i.test(message))
    return "The database user or password is wrong. Check DB_USER and DB_PASSWORD.";
  if (code === "3D000" || /database .* does not exist/i.test(message))
    return "There's no database with that name. Check DB_NAME (the full name, as the hosting panel shows it).";
  if (code === "42501" || /permission denied/i.test(message))
    return "The database user isn't allowed to make tables. In the hosting panel, give the user all privileges on the database.";
  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(code))
    return `Couldn't reach the database at ${env.DB_HOST || "the address in DATABASE_URL"}. Check DB_HOST and DB_PORT (often localhost and 5432).`;
  return message;
}
