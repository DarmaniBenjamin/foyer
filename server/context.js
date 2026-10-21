// What a controller puts in a guest's address when it sends them to the
// sign-in page, read the same way for UniFi and Omada. It's carried to
// the page and back in "ctx", with a signature ("sig"), so a guest can't
// swap in another device's MAC address.
//
// UniFi:  /guest/s/<site>/?id=<guest MAC>&ap=<AP MAC>&ssid=…&url=…&t=…
// Omada:  /omada/<slug>?clientMac=…&clientIp=…&apMac=…&ssidName=…
//         &radioId=…&site=…&redirectUrl=…&t=…   (Wi-Fi)
//         …?clientMac=…&gatewayMac=…&vid=…&site=…&redirectUrl=…  (gateway)
import { normalizeMac } from "../src/whitelist.js";
import { sign, verify } from "./secrets.js";

const MAX_AGE = 6 * 60 * 60 * 1000; // a sign-in page works for 6 hours

const str = (v, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

// Only web addresses are kept as somewhere to send the guest afterwards
function safeUrl(value) {
  const text = str(value, 2000);
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

export function fromUnifi(siteKey, q) {
  const mac = normalizeMac(q.id);
  if (!mac) return null;
  return {
    kind: "unifi",
    siteKey: str(siteKey, 100),
    mac,
    apMac: normalizeMac(q.ap) || null,
    ssid: str(q.ssid, 100) || null,
    url: safeUrl(q.url),
    at: Date.now(),
  };
}

export function fromOmada(q) {
  const mac = normalizeMac(q.clientMac);
  if (!mac) return null;
  // Sent back to Omada exactly as Omada gave them
  const raw = {};
  for (const name of ["clientMac", "clientIp", "apMac", "gatewayMac", "vid", "ssidName", "radioId", "site"])
    if (typeof q[name] === "string") raw[name] = str(q[name], 100);
  return {
    kind: "omada",
    mac,
    apMac: normalizeMac(q.apMac) || normalizeMac(q.gatewayMac) || null,
    ssid: str(q.ssidName, 100) || null,
    url: safeUrl(q.redirectUrl),
    raw,
    at: Date.now(),
  };
}

// → { ctx: "…", sig: "…" } for the page's address
export function seal(ctx) {
  const text = Buffer.from(JSON.stringify(ctx)).toString("base64url");
  return { ctx: text, sig: sign(`ctx:${text}`) };
}

// Back from the page → the details, or null if changed or too old
export function open(text, sig) {
  if (!text || !verify(`ctx:${text}`, sig)) return null;
  try {
    const ctx = JSON.parse(Buffer.from(String(text), "base64url").toString());
    if (!ctx?.mac || Date.now() - ctx.at > MAX_AGE) return null;
    return ctx;
  } catch {
    return null;
  }
}
