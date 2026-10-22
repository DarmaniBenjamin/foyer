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
  const said = [`Omada ${version ?? ""}, controller ID ${omadaId}.`];
  // The controller-wide Hotspot Operator (optional with the Open API)
  // With the Open API it only matters for sites set up by hand, so a
  // failed sign-in is a warning, not a failed test
  if (controller.username) {
    try {
      await login(controller, omadaId);
      said.push("Signed in as the Hotspot Operator.");
    } catch (err) {
      if (!controller.openApi?.clientId) throw err;
      said.push(`(The Hotspot Operator sign-in failed: ${err.message} It's only used for sites set up by hand; clear the Username to stop using it.)`);
    }
  }
  // The Open API app
  if (controller.openApi?.clientId) {
    tokens.delete(controller.id);
    infoCache.set(controller.id, { version, omadaId, at: Date.now() });
    const sites = await listSitesApi(controller);
    said.push(`Open API works: ${sites.length} site${sites.length === 1 ? "" : "s"} (${sites.map((s) => s.name).join(", ")}).`);
  }
  const unit = timeUnit(controller, version);
  said.push(`Guest time is sent in ${unit === "ms" ? "milliseconds" : "microseconds"}.`);
  return { version, omadaId, message: said.join(" ") };
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


// ---------- Open API: setting a site up from Foyer ----------
//
// An Open API app (Global view → Settings → Platform Integration →
// Open API, "Client Credentials", an admin role with the sites ticked)
// lets Foyer read the sites and Wi-Fi networks, make the portal, the
// Pre-Authentication Access entry and a Hotspot Operator for each site.
// controller.openApi: { clientId, secret }

const tokens = new Map(); // controller id → { token, until, stamp }

async function apiToken(controller, omadaId, fresh = false) {
  const stamp = `${controller.url}|${controller.openApi.clientId}|${controller.openApi.secret}`;
  const saved = tokens.get(controller.id);
  if (!fresh && saved && saved.stamp === stamp && Date.now() < saved.until) return saved.token;
  const res = await request(controller, "POST", "/openapi/authorize/token?grant_type=client_credentials", {
    body: {
      omadacId: omadaId,
      client_id: controller.openApi.clientId,
      client_secret: controller.openApi.secret,
    },
  });
  if (res.json?.errorCode !== 0 || !res.json.result?.accessToken)
    throw new ControllerError(
      res.json?.errorCode === -44106
        ? "Omada refused the Open API Client ID or Secret. Check them on the controller in Foyer."
        : `Omada's Open API sign-in failed (${res.json?.errorCode ?? res.status}${res.json?.msg ? `: ${res.json.msg}` : ""}).`,
    );
  const token = res.json.result.accessToken;
  const life = (res.json.result.expiresIn ?? 7200) * 1000;
  tokens.set(controller.id, { token, until: Date.now() + life - 60_000, stamp });
  return token;
}

// One Open API call: path after /openapi/v1/<controller ID> (or a whole
// /openapi/v2/... path with {omadacId}). Returns the result.
export async function api(controller, method, path, body) {
  if (!controller.openApi?.clientId || !controller.openApi?.secret)
    throw new ControllerError("Add the Open API Client ID and Secret to the controller first.");
  const { omadaId } = await details(controller);
  if (!omadaId) throw new ControllerError("Press Test connection on the controller first.");
  const full = path.startsWith("/openapi/")
    ? path.replace("{omadacId}", omadaId)
    : `/openapi/v1/${omadaId}${path}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await apiToken(controller, omadaId, attempt > 0);
    const res = await request(controller, method, full, {
      body,
      headers: { Authorization: `AccessToken=${token}` },
    });
    const code = res.json?.errorCode;
    if (code === 0) return res.json.result;
    if (attempt === 0 && (res.status === 401 || [-44112, -44113].includes(code))) continue;
    throw new ControllerError(
      code === -1005 || res.status === 403
        ? "The Open API app isn't allowed to do that. Give it an admin role, with this site ticked."
        : `Omada said no (${code ?? res.status}${res.json?.msg ? `: ${res.json.msg}` : ""}).`,
    );
  }
}

// The sites on the controller: [{ key: site ID, name }]
export async function listSitesApi(controller) {
  const result = await api(controller, "GET", "/sites?page=1&pageSize=1000");
  return (result?.data ?? []).map((s) => ({ key: s.siteId, name: s.name }));
}

const portalsOf = async (controller, siteId) =>
  (await api(controller, "GET", `/sites/${siteId}/portals`)) ?? [];

// The Wi-Fi networks on one Omada site, with the portal each is in:
// [{ id, name, enabled, guestPortal, portal, security }]
export async function listWlansApi(controller, siteId) {
  const result = await api(
    controller,
    "GET",
    `/openapi/v2/{omadacId}/sites/${siteId}/wireless-network/ssids?page=1&pageSize=1000`,
  );
  const portals = await portalsOf(controller, siteId);
  return (result?.data ?? []).map((w) => {
    const id = w.id ?? w.ssidId;
    const portal = portals.find((p) => (p.ssidList ?? []).includes(id));
    return {
      id,
      name: w.name,
      enabled: true,
      guestPortal: Boolean(portal),
      portal: portal?.name ?? null,
      security: w.security === 0 ? "Open" : "Secured",
    };
  });
}

// What the site's portals do now, for the warning before setting up:
// { portals: [{ id, name, ssids }] }
export async function portalStateApi(controller, siteId) {
  const portals = await portalsOf(controller, siteId);
  return { portals: portals.map((p) => ({ id: p.id, name: p.name, ssids: p.ssidList ?? [] })) };
}

// A portal's settings as Omada gives them, ready to send back
const portalBody = (detail) => {
  const { id: _id, siteId: _site, ...rest } = detail ?? {};
  return rest;
};

const OPERATOR_NOTE = "Made by Foyer to let guests on. Don't delete.";

// Sets one Omada site up for Foyer:
//   1. the Wi-Fi network comes off any other portal (e.g. Spotipo's)
//   2. a "Foyer <name>" portal, External Portal Server = portalUrl
//   3. Pre-Authentication Access for Foyer's address (host)
//   4. a Hotspot Operator for this site, to let guests on
// Returns { done: steps in words, before: for Undo, operator }
export async function setUpPortalApi(
  controller,
  siteId,
  { ssidId, portalName, portalUrl, host, minutes, operatorName, operatorPassword },
) {
  const done = [];
  const before = { siteId, portals: [], createdPortalId: null, accessControl: null };
  const portals = await portalsOf(controller, siteId);

  // 1. Off any other portal
  for (const p of portals) {
    if (p.name === portalName || !(p.ssidList ?? []).includes(ssidId)) continue;
    const detail = await api(controller, "GET", `/sites/${siteId}/portal/${p.id}`);
    before.portals.push({ id: p.id, detail: portalBody(detail) });
    const ssidList = (detail.ssidList ?? []).filter((x) => x !== ssidId);
    const left = ssidList.length + (detail.networkList ?? []).length;
    await api(controller, "PATCH", `/sites/${siteId}/portal/${p.id}`, {
      ...portalBody(detail),
      ssidList,
      // A portal with nothing left on it is turned off, not deleted
      enable: left > 0 ? detail.enable : false,
    });
    done.push(`Wi-Fi taken off the portal "${p.name}"`);
  }

  // 2. Foyer's portal
  const url = new URL(portalUrl);
  const ours = {
    name: portalName,
    enable: true,
    authType: 4,
    authTimeout: { customTimeout: Math.max(1, Math.min(1_000_000, minutes || 120)), customTimeoutUnit: 1 },
    httpsRedirectEnable: true,
    landingPage: 1,
    externalPortal: {
      hostType: 2,
      serverUrlScheme: url.protocol.replace(":", ""),
      serverUrl: `${url.host}${url.pathname}`,
    },
  };
  const existing = portals.find((p) => p.name === portalName);
  if (existing) {
    const detail = await api(controller, "GET", `/sites/${siteId}/portal/${existing.id}`);
    before.portals.push({ id: existing.id, detail: portalBody(detail) });
    const ssidList = [...new Set([...(detail.ssidList ?? []), ssidId])];
    await api(controller, "PATCH", `/sites/${siteId}/portal/${existing.id}`, {
      ...portalBody(detail),
      ...ours,
      ssidList,
      networkList: detail.networkList ?? [],
    });
    done.push(`Portal "${portalName}" updated: External Portal Server ${portalUrl}`);
  } else {
    await api(controller, "POST", `/sites/${siteId}/portal`, { ...ours, ssidList: [ssidId], networkList: [] });
    const made = (await portalsOf(controller, siteId)).find((p) => p.name === portalName);
    before.createdPortalId = made?.id ?? null;
    done.push(`Portal "${portalName}" made: External Portal Server ${portalUrl}`);
  }

  // 3. Pre-Authentication Access
  const access = await api(controller, "GET", `/sites/${siteId}/setting/access-control`);
  before.accessControl = access;
  const policies = access?.preAuthAccessPolicies ?? [];
  if (!access?.preAuthAccessEnable || !policies.some((p) => p.type === 2 && p.url === host)) {
    await api(controller, "PATCH", `/sites/${siteId}/setting/access-control`, {
      ...access,
      preAuthAccessEnable: true,
      preAuthAccessPolicies: [
        ...policies.filter((p) => !(p.type === 2 && p.url === host)),
        { type: 2, url: host, description: "Foyer" },
      ],
    });
  }
  done.push(`Pre-Authentication Access for ${host}`);

  // 4. The site's own Hotspot Operator (made again with a new password)
  const list = await api(
    controller,
    "GET",
    `/sites/${siteId}/hotspot/operators?page=1&pageSize=1000&searchKey=${encodeURIComponent(operatorName)}`,
  );
  for (const op of list?.data ?? [])
    if (op.name === operatorName) await api(controller, "DELETE", `/sites/${siteId}/hotspot/operators/${op.id}`);
  await api(controller, "POST", `/sites/${siteId}/hotspot/operators`, {
    name: operatorName,
    password: operatorPassword,
    note: OPERATOR_NOTE,
    operatorRoleType: 0,
    selectedSites: [siteId],
  });
  done.push(`Hotspot Operator "${operatorName}" made for letting guests on`);

  return { done, before };
}

// Undo: the other portals and Pre-Authentication Access as they were,
// Foyer's portal and operator gone
export async function restorePortalApi(controller, before, operatorName) {
  const siteId = before.siteId;
  for (const p of before.portals)
    await api(controller, "PATCH", `/sites/${siteId}/portal/${p.id}`, p.detail);
  if (before.createdPortalId)
    await api(controller, "DELETE", `/sites/${siteId}/portal/${before.createdPortalId}`);
  if (before.accessControl)
    await api(controller, "PATCH", `/sites/${siteId}/setting/access-control`, before.accessControl);
  const list = await api(
    controller,
    "GET",
    `/sites/${siteId}/hotspot/operators?page=1&pageSize=1000&searchKey=${encodeURIComponent(operatorName)}`,
  );
  for (const op of list?.data ?? [])
    if (op.name === operatorName) await api(controller, "DELETE", `/sites/${siteId}/hotspot/operators/${op.id}`);
}
