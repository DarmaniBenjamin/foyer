// Locks and unlocks the controller passwords kept in the database
// (AES-256-GCM), so a copy of the database doesn't give anyone the
// controllers.
//
// The key: SECRET_KEY in the environment variables (a long random code:
// "openssl rand -base64 32"). Keep a copy somewhere safe: without the
// same key, the controllers show "Enter the password again" until each
// one's password is typed again. On your own computer, if it isn't set,
// one is made and kept in .secret-key in the project folder.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, PRODUCTION } from "./config.js";

let key = null;

function getKey() {
  if (key) return key;
  const given = process.env.SECRET_KEY;
  if (given) {
    // Any length of text works: it's turned into a 32-byte key
    key = crypto.createHash("sha256").update(given).digest();
    return key;
  }
  if (PRODUCTION)
    throw new Error(
      "SECRET_KEY isn't set. Add it to the environment variables (a long random code) and restart.",
    );
  const file = path.join(ROOT, ".secret-key");
  try {
    key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
  } catch {
    key = crypto.randomBytes(32);
    fs.writeFileSync(file, key.toString("base64"), { mode: 0o600 });
  }
  return key;
}

// Thrown when a password was locked with another key
export class LockedSecret extends Error {}

// "hunter2" → "v1:…" (different every time, even for the same text)
export function seal(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")}`;
}

// "v1:…" → "hunter2"
export function unseal(sealed) {
  try {
    if (!String(sealed).startsWith("v1:")) throw new Error();
    const raw = Buffer.from(sealed.slice(3), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new LockedSecret(
      "This controller's password was saved with another SECRET_KEY. Enter it again.",
    );
  }
}

// A signature for some text (e.g. a guest's sign-in details): anyone can
// read the text, but nobody can make a working signature for different
// text without the key
export function sign(text) {
  return crypto.createHmac("sha256", getKey()).update(String(text)).digest("base64url").slice(0, 32);
}

// Checks a signature without leaking how much of it matched
export function verify(text, signature) {
  const expected = Buffer.from(sign(text));
  const given = Buffer.from(String(signature ?? ""));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
