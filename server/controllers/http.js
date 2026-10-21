// One request to a controller, with what both controllers need:
// - JSON in and out
// - cookies: the session cookie the controller sets at sign-in is kept
//   in a small "jar" and sent back with the next requests
// - a self-signed certificate is only accepted when the controller is
//   set to allow it (yours have real certificates, so it's off)
// - a 10-second limit, with a plain-words error when the controller
//   can't be reached
import http from "node:http";
import https from "node:https";

export class ControllerError extends Error {}

// Turns a network error into words an admin can act on
function explain(err, url) {
  const where = `${url.hostname}:${url.port || (url.protocol === "http:" ? 80 : 443)}`;
  switch (err.code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return `Couldn't find ${url.hostname}. Check the controller's address.`;
    case "ECONNREFUSED":
      return `${where} refused the connection. Check the port (UniFi is usually 8443, Omada 8043) and that the controller is running.`;
    case "ETIMEDOUT":
    case "ESOCKETTIMEDOUT":
    case "TIMEOUT":
      return `${where} didn't answer within 10 seconds. A firewall (on the Linode, or the web host blocking that port) may be stopping it.`;
    case "ECONNRESET":
      return `${where} dropped the connection.`;
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return `${url.hostname}'s certificate isn't trusted (self-signed?). Use the controller's domain with its real certificate, or tick "Allow a self-signed certificate".`;
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return `${url.hostname}'s certificate is for a different name. Use the domain the certificate was made for.`;
    case "CERT_HAS_EXPIRED":
      return `${url.hostname}'s certificate has expired. Renew it on the Linode.`;
    default:
      return `Couldn't reach ${where}: ${err.message}`;
  }
}

export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  take(setCookie = []) {
    for (const line of [setCookie].flat()) {
      const [pair] = String(line).split(";");
      const at = pair.indexOf("=");
      if (at > 0)
        this.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
  }
  get(name) {
    return this.cookies.get(name);
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

// request(controller, "POST", "/api/login", { body, headers, jar })
// → { status, headers, json, text }
export function request(
  controller,
  method,
  path,
  { body, headers = {}, jar, timeout = 10_000 } = {},
) {
  const base = String(controller.url).replace(/\/+$/, "");
  const url = new URL(base + path);
  const data = body === undefined ? null : JSON.stringify(body);
  const sent = { Accept: "application/json", ...headers };
  if (data) {
    sent["Content-Type"] = "application/json";
    sent["Content-Length"] = Buffer.byteLength(data);
  }
  if (jar?.cookies.size) sent.Cookie = jar.header();

  return new Promise((resolve, reject) => {
    const lib = url.protocol === "http:" ? http : https;
    const req = lib.request(
      url,
      {
        method,
        headers: sent,
        rejectUnauthorized: !controller.allowSelfSigned,
        timeout,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          if (text.length < 5_000_000) text += c;
        });
        res.on("end", () => {
          jar?.take(res.headers["set-cookie"]);
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // not JSON (e.g. an HTML error page)
          }
          resolve({ status: res.statusCode, headers: res.headers, json, text });
        });
      },
    );
    req.on("timeout", () =>
      req.destroy(Object.assign(new Error("timeout"), { code: "TIMEOUT" })),
    );
    req.on("error", (err) => reject(new ControllerError(explain(err, url))));
    if (data) req.write(data);
    req.end();
  });
}
