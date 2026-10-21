// Omada Software Controller (self-hosted, e.g. on the Linode), with its
// External Portal API.
//
// 1. GET /api/info: the controller's version and its controller ID (the
//    long code in the controller's address bar). No sign-in needed.
// 2. Sign in as a Hotspot Operator (Hotspot Manager → Operators, not an
//    admin account): POST /<controllerId>/api/v2/hotspot/login. The
//    answer has a token (sent back as the Csrf-Token header) and a
//    session cookie (TPOMADA_SESSIONID).
// 3. Let a guest on: POST /<controllerId>/api/v2/hotspot/extPortal/auth
//    with authType 4 and the details Omada put in the guest's address
//    (clientMac, apMac, ssidName, radioId, site; or gatewayMac and vid
//    for a gateway portal) plus how long they get ("time").
//
// "time" is how long the guest stays on, counted from now:
//   - in microseconds on 5.x (up to 6.2.0)
//   - in milliseconds on 6.2.10 and newer, which also takes speed and
//     data limits in the same request
// The unit is picked from the version Test connection finds, or set by
// hand on the controller (Time unit) if a version behaves differently.
import { ControllerError, CookieJar, request } from "./http.js";

const sessions = new Map(); // controller id → { jar, token, at, stamp }
const SESSION_MAX_AGE = 30 * 60 * 1000;
const infoCache = new Map(); // controller id → { version, omadaId, at }

const stamp = (c) => `${c.url}|${c.username}|${c.password}|${c.allowSelfSigned}`;

// "6.2.10.4" >= "6.2.10" ?
export function atLeast(version, wanted) {
  const a = String(version ?? "").split(".").map((n) => parseInt(n, 10) || 0);
  const b = wanted.split(".").map(Number);
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

// "us" (5.x … 6.2.0) or "ms" (6.2.10+), unless set by hand
export function timeUnit(controller, version) {
  if (controller.timeUnit === "us" || controller.timeUnit === "ms")
    return controller.timeUnit;
  return atLeast(version, "6.2.10") ? "ms" : "us";
}

// The value to send as "time" for this many minutes
export function timeValue(minutes, unit) {
  const ms = Math.round(minutes * 60 * 1000);
  return unit === "ms" ? ms : ms * 1000;
}

export async function info(controller) {
  const res = await request(controller, "GET", "/api/info");
  if (res.json?.errorCode !== 0 || !res.json.result)
    throw new ControllerError(
      `That address didn't answer like an Omada controller (${res.status}). Check the address and port (usually 8043).`,
    );
  const result = {
    version: res.json.result.controllerVer ?? null,
    omadaId: res.json.result.omadacId ?? null,
  };
  infoCache.set(controller.id, { ...result, at: Date.now() });
  return result;
}

// The version and controller ID, asked for at most once an hour (so an
// upgrade to 6.2.10 switches the time unit by itself); the ones saved by
// Test connection if the controller doesn't answer /api/info
async function details(controller) {
  const cached = infoCache.get(controller.id);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached;
  try {
    return await info(controller);
  } catch (err) {
    const saved = controller.lastTest;
    if (saved?.omadaId) return { version: saved.version, omadaId: saved.omadaId };
    throw err;
  }
}

async function login(controller, omadaId) {
  const jar = new CookieJar();
  const res = await request(
    controller,
    "POST",
    `/${omadaId}/api/v2/hotspot/login`,
    { body: { name: controller.username, password: controller.password }, jar },
  );
  if (res.json?.errorCode !== 0) {
    const msg = res.json?.msg ?? `status ${res.status}`;
    throw new ControllerError(
      /password|user|account|name/i.test(msg)
        ? `Omada refused the Hotspot Operator sign-in: ${msg}. Use an operator from Hotspot Manager → Operators (not an admin account), with this site ticked.`
        : `Omada Hotspot Operator sign-in failed: ${msg}.`,
    );
  }
  const session = {
    jar,
    token: res.json.result?.token,
    at: Date.now(),
    stamp: stamp(controller),
  };
  sessions.set(controller.id, session);
  return session;
}

async function session(controller, omadaId, fresh = false) {
  const s = sessions.get(controller.id);
  if (
    !fresh &&
    s &&
    s.stamp === stamp(controller) &&
    Date.now() - s.at < SESSION_MAX_AGE
  )
    return s;
  return login(controller, omadaId);
}

// Test connection: version and ID, then the operator sign-in
export async function test(controller) {
  sessions.delete(controller.id);
  const { version, omadaId } = await info(controller);
  if (!omadaId)
    throw new ControllerError("Omada didn't share its controller ID.");
  await login(controller, omadaId);
  const unit = timeUnit(controller, version);
  return {
    version,
    omadaId,
    message: `Signed in to Omada ${version ?? ""} as a Hotspot Operator. Controller ID ${omadaId}. Guest time is sent in ${unit === "ms" ? "milliseconds" : "microseconds"}.`,
  };
}

// The request body for one guest (exported for the tests)
// guest: what Omada put in the portal's address (clientMac, clientIp,
//   apMac, ssidName, radioId, site, gatewayMac, vid), exactly as given
// access: { minutes, downKbps, upKbps, dataMb }
export function authBody(guest, access, unit) {
  const time = timeValue(access.minutes, unit);
  const gateway = Boolean(guest.gatewayMac);
  if (unit === "ms") {
    // 6.2.10 and newer
    const body = gateway
      ? {
          clientMac: guest.clientMac,
          clientIp: guest.clientIp ?? "",
          gatewayMac: guest.gatewayMac,
          vid: String(guest.vid ?? ""),
          time: String(time),
          authType: "4",
        }
      : {
          clientMac: guest.clientMac,
          clientIp: guest.clientIp ?? "",
          apMac: guest.apMac,
          ssidName: guest.ssidName,
          radioId: String(guest.radioId ?? ""),
          time: String(time),
          authType: "4",
          originUrl: "",
        };
    if (access.dataMb) body.totalTrafficLimitBytes = access.dataMb * 1024 * 1024;
    if (access.downKbps) body.downloadRateLimitKbps = access.downKbps;
    if (access.upKbps) body.uploadRateLimitKbps = access.upKbps;
    return body;
  }
  // 5.x … 6.2.0 (speed and data limits come from Omada's own portal
  // settings on these versions)
  return gateway
    ? {
        clientMac: guest.clientMac,
        gatewayMac: guest.gatewayMac,
        vid: guest.vid,
        site: guest.site,
        time,
        authType: 4,
      }
    : {
        clientMac: guest.clientMac,
        apMac: guest.apMac,
        ssidName: guest.ssidName,
        radioId: guest.radioId,
        site: guest.site,
        time,
        authType: 4,
      };
}

export async function authorize(controller, guest, access) {
  const { version, omadaId } = await details(controller);
  if (!omadaId)
    throw new ControllerError(
      "The Omada controller ID isn't known yet. Press Test connection on the controller.",
    );
  const body = authBody(guest, access, timeUnit(controller, version));
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await session(controller, omadaId, attempt > 0);
    const res = await request(
      controller,
      "POST",
      `/${omadaId}/api/v2/hotspot/extPortal/auth`,
      { body, headers: { "Csrf-Token": s.token }, jar: s.jar },
    );
    if (res.json?.errorCode === 0) return;
    // An ended session: sign in again once
    const loggedOut =
      res.status === 401 ||
      res.status === 302 ||
      [-1200, -1005, -30109].includes(res.json?.errorCode) ||
      /log ?in|session|token/i.test(res.json?.msg ?? "");
    if (attempt === 0 && loggedOut) continue;
    throw new ControllerError(
      `Omada didn't authorize the guest (${res.json?.errorCode ?? res.status}${res.json?.msg ? `: ${res.json.msg}` : ""}).`,
    );
  }
}
