// UniFi Network controller (self-hosted, e.g. on the Linode).
//
// 1. Sign in with a local admin: POST /api/login. The controller answers
//    with a session cookie (unifises) and, on newer versions, a CSRF
//    token that has to come back on every POST.
//    (A UniFi OS console, e.g. a Dream Machine, signs in at
//    /api/auth/login instead and puts everything under /proxy/network;
//    that's tried by itself when /api/login isn't there.)
// 2. Let a guest on: POST /api/s/<site>/cmd/stamgr with
//    { cmd: "authorize-guest", mac, minutes, up, down, bytes, ap_mac }
//    up/down are kbps, bytes is the data limit in MB.
//
// The signed-in session is kept and reused (one sign-in, many guests),
// and made again by itself when the controller has ended it.
import { ControllerError, CookieJar, request } from "./http.js";

const sessions = new Map(); // controller id → { jar, csrf, prefix, at, stamp }
const SESSION_MAX_AGE = 30 * 60 * 1000;

const stamp = (c) => `${c.url}|${c.username}|${c.password}|${c.allowSelfSigned}`;

function loginError(res) {
  const msg = res.json?.meta?.msg ?? "";
  if (/Invalid/i.test(msg) || res.status === 401)
    return "The UniFi username or password is wrong. Use a local admin account (not a ui.com account).";
  if (/2fa|mfa/i.test(msg))
    return "That UniFi account has two-step sign-in. Make a local admin without it for the portal.";
  if (res.status === 429)
    return "UniFi is refusing sign-ins for a while (too many tries). Wait a few minutes.";
  return `UniFi sign-in failed (${res.status}${msg ? `: ${msg}` : ""}).`;
}

async function login(controller) {
  const jar = new CookieJar();
  const creds = {
    username: controller.username,
    password: controller.password,
    remember: false,
  };
  // The usual self-hosted controller
  let res = await request(controller, "POST", "/api/login", {
    body: creds,
    jar,
  });
  let prefix = "";
  if (res.status === 404 || res.status === 405) {
    // A UniFi OS console
    res = await request(controller, "POST", "/api/auth/login", {
      body: creds,
      jar,
    });
    prefix = "/proxy/network";
  }
  if (res.status < 200 || res.status >= 300) throw new ControllerError(loginError(res));
  const csrf =
    res.headers["x-csrf-token"] ??
    res.headers["x-updated-csrf-token"] ??
    jar.get("csrf_token") ??
    null;
  const session = { jar, csrf, prefix, at: Date.now(), stamp: stamp(controller) };
  sessions.set(controller.id, session);
  return session;
}

async function session(controller, fresh = false) {
  const s = sessions.get(controller.id);
  if (
    !fresh &&
    s &&
    s.stamp === stamp(controller) &&
    Date.now() - s.at < SESSION_MAX_AGE
  )
    return s;
  return login(controller);
}

// A call with the signed-in session; signs in again once if it's expired
async function call(controller, method, path, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await session(controller, attempt > 0);
    const headers = s.csrf ? { "X-Csrf-Token": s.csrf } : {};
    const res = await request(controller, method, s.prefix + path, {
      body,
      headers,
      jar: s.jar,
    });
    const updated = res.headers["x-updated-csrf-token"];
    if (updated) s.csrf = updated;
    if ((res.status === 401 || res.status === 403) && attempt === 0) continue;
    return res;
  }
}

// The sites on this controller: [{ key: "default", name: "Default" }]
export async function listSites(controller) {
  const res = await call(controller, "GET", "/api/self/sites");
  if (res.json?.meta?.rc !== "ok")
    throw new ControllerError(
      `UniFi didn't list its sites (${res.status} ${res.json?.meta?.msg ?? ""}).`,
    );
  return res.json.data.map((s) => ({ key: s.name, name: s.desc || s.name }));
}

// Test connection: sign in and list the sites
export async function test(controller) {
  sessions.delete(controller.id);
  const sites = await listSites(controller);
  // The version, when this controller shares it
  let version = null;
  try {
    const res = await call(controller, "GET", "/api/s/default/stat/sysinfo");
    version = res.json?.data?.[0]?.version ?? null;
  } catch {
    // not important
  }
  const names = sites.map((s) => `${s.name} (${s.key})`).join(", ");
  return {
    version,
    sites,
    message: `Signed in to UniFi${version ? ` ${version}` : ""}. Sites: ${names || "none"}.`,
  };
}

// Lets a guest's device on.
// guest: { mac, apMac }, access: { minutes, downKbps, upKbps, dataMb }
export async function authorize(controller, siteKey, guest, access) {
  const body = {
    cmd: "authorize-guest",
    mac: guest.mac.toLowerCase(),
    minutes: access.minutes,
  };
  if (access.upKbps) body.up = access.upKbps;
  if (access.downKbps) body.down = access.downKbps;
  if (access.dataMb) body.bytes = access.dataMb;
  if (guest.apMac) body.ap_mac = guest.apMac.toLowerCase();

  const res = await call(
    controller,
    "POST",
    `/api/s/${encodeURIComponent(siteKey)}/cmd/stamgr`,
    body,
  );
  if (res.json?.meta?.rc === "ok") return;
  const msg = res.json?.meta?.msg ?? "";
  if (/NoSiteContext|InvalidObject/i.test(msg) || res.status === 404)
    throw new ControllerError(
      `UniFi has no site "${siteKey}". Check the site's UniFi site name.`,
    );
  if (res.status === 403 || /NoPermission/i.test(msg))
    throw new ControllerError(
      "The UniFi account isn't allowed to authorize guests. Give it admin (or Hotspot operator) rights on that site.",
    );
  throw new ControllerError(
    `UniFi didn't authorize the guest (${res.status}${msg ? `: ${msg}` : ""}).`,
  );
}
