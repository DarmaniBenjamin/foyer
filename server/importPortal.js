// Site settings → Look → Copy an existing portal: reads another captive
// portal's sign-in page (e.g. Spotipo's) from its web address and finds
// its logo, background picture, words, colours and questions, for
// the page to copy into the site.
//
// It only reads what the page itself contains. A page that draws itself
// with JavaScript after it opens has nothing to read, and says so.
//
// Only public websites: an address inside a private network (192.168…,
// 10…, the server itself) is refused, so this can't be used to look
// around the network Foyer runs on.
import dns from "node:dns/promises";
import net from "node:net";
import { parse } from "node-html-parser";
import { Problem } from "./shapes.js";

const TIMEOUT = 15_000;
const MAX_PAGE = 3 * 1024 * 1024;
const MAX_CSS = 1024 * 1024;
const MAX_PICTURE = 8 * 1024 * 1024;
// A phone's browser, since portals are made for phones
const AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivate(v6.slice(7));
  return v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

// Fetches a public address (following up to 5 redirects, each checked).
// Returns { url, type, body: Buffer }.
// For trying the sign-in (see tryPortal):
//   jar: a Map of cookies, kept and sent like a browser would
//   method / form: "POST" with the form's answers (URLSearchParams)
//   stayOn: a host name; a redirect to another website isn't followed,
//     and comes back as { leftTo: its address }
async function getPublic(address, { accept, max, what, jar, method = "GET", form, stayOn }) {
  let url;
  try {
    url = new URL(address);
  } catch {
    throw new Problem("That isn't a web address. Paste the full address, starting with https://");
  }
  for (let hop = 0; hop <= 5; hop++) {
    if (!/^https?:$/.test(url.protocol)) throw new Problem("Only http:// and https:// addresses can be read.");
    // Testing on one computer only (never set on a real server)
    if (process.env.IMPORT_ALLOW_LOCAL !== "on") {
      let found;
      try {
        found = await dns.lookup(url.hostname, { all: true });
      } catch {
        throw new Problem(`Couldn't find ${url.hostname}. Check the address.`);
      }
      if (found.some((a) => isPrivate(a.address)))
        throw new Problem("That address is inside a private network. Only public web pages can be copied.");
    }
    let res;
    try {
      const headers = { "User-Agent": AGENT, Accept: accept };
      if (jar?.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
      res = await fetch(url, {
        method,
        body: method === "POST" ? form.toString() : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT),
        headers,
      });
    } catch (err) {
      throw new Problem(
        err.name === "TimeoutError"
          ? `${url.hostname} took too long to answer.`
          : `Couldn't reach ${url.hostname} (${err.cause?.code ?? err.message}).`,
      );
    }
    if (jar)
      for (const cookie of res.headers.getSetCookie?.() ?? []) {
        const [pair] = cookie.split(";");
        const at = pair.indexOf("=");
        if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
      }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get("location")) {
      const next = new URL(res.headers.get("location"), url);
      // Like a browser: after a redirect the answers are only sent again
      // for 307 and 308
      if (![307, 308].includes(res.status)) method = "GET";
      if (stayOn && next.host !== stayOn) return { url: url.href, leftTo: next.href, type: "", body: Buffer.alloc(0) };
      url = next;
      continue;
    }
    if (!res.ok) throw new Problem(`The ${what} answered with error ${res.status}.`);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > max) throw new Problem(`The ${what} is too big to copy.`);
      chunks.push(chunk);
    }
    return { url: url.href, type: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
  }
  throw new Problem("That address sends you on too many times.");
}

// A picture as a data: link, or null if it isn't one
async function getPicture(address) {
  if (!address) return null;
  if (address.startsWith("data:image/")) return address;
  try {
    const pic = await getPublic(address, { accept: "image/*", max: MAX_PICTURE, what: "picture" });
    const type = pic.type.split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(type)) return null;
    return `data:${type};base64,${pic.body.toString("base64")}`;
  } catch {
    return null; // a missing picture doesn't stop the rest
  }
}

const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const words = (el) => tidy(el?.textContent);

// A <label>'s own words, without the list or box inside it
function labelWords(el) {
  if (!el) return "";
  const parts = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) parts.push(child.textContent);
      else if (!["SELECT", "OPTION", "TEXTAREA", "INPUT"].includes(child.tagName)) walk(child);
    }
  };
  walk(el);
  return tidy(parts.join(" "));
}

// "first_name" → "First name"
const human = (name) => {
  const s = tidy(String(name ?? "").replace(/[_\-[\]]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2"));
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "";
};

// The CSS rules (selector + declarations) in some CSS text
function rules(css) {
  const out = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: tidy(m[1]), body: m[2] });
  return out;
}

// ----- Colours -----
const NAMED = {
  white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", blue: "#0000ff",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080", teal: "#008080",
  orange: "#ffa500", purple: "#800080", maroon: "#800000", yellow: "#ffff00",
};
const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");

// "#abc", "#aabbcc", "#aabbccdd", "rgb(…)", "rgba(…)", "white" →
// { hex: "#aabbcc", alpha: 0–1 }, or null
export function readColor(text) {
  const t = String(text ?? "").trim().toLowerCase();
  let m;
  if ((m = t.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/))) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    return { hex: `#${h.slice(0, 6)}`, alpha: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  if ((m = t.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/))) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { hex: `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`, alpha: Math.min(1, Math.max(0, a)) };
  }
  return NAMED[t] ? { hex: NAMED[t], alpha: 1 } : null;
}

// "a: 1; b: 2" → [["a", "1"], ["b", "2"]]
const declarations = (body) =>
  String(body ?? "")
    .split(";")
    .map((d) => d.split(/:(.*)/s))
    .filter((d) => d.length > 1)
    .map(([k, v]) => [k.trim().toLowerCase(), v.replace(/!important/i, "").trim()]);

// Does a CSS selector ("form .btn.primary", "#go", "button[type=submit]")
// describe this element? Only its last part is checked, and states like
// :hover don't count. → its weight (an id 100, a class 10, a tag 1), or 0
function weigh(selector, el) {
  if (/:(hover|focus|active|disabled|visited|before|after|not|placeholder|checked|invalid|selection)/i.test(selector))
    return 0;
  const last = selector.trim().split(/[\s>+~]+/).pop();
  if (!last || last.startsWith("@")) return 0;
  const parts = last.match(/^[a-z][\w-]*|\*|#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/gi) ?? [];
  if (parts.join("") !== last) return 0; // something this doesn't understand
  let weight = 0;
  for (const part of parts) {
    if (part === "*") continue;
    if (part[0] === "#") {
      if (el.getAttribute("id") !== part.slice(1)) return 0;
      weight += 100;
    } else if (part[0] === ".") {
      if (!(el.getAttribute("class") ?? "").split(/\s+/).includes(part.slice(1))) return 0;
      weight += 10;
    } else if (part[0] === "[") {
      const m = part.slice(1, -1).match(/^([\w-]+)(?:\s*=\s*["']?([^"']*)["']?)?$/);
      if (!m) return 0;
      const v = el.getAttribute(m[1]);
      if (v == null || (m[2] !== undefined && v.toLowerCase() !== m[2].toLowerCase())) return 0;
      weight += 10;
    } else if (part[0] === ":") {
      if (part.toLowerCase() !== ":root" || el.tagName !== "HTML") return 0;
      weight += 10;
    } else {
      if (el.tagName?.toLowerCase() !== part.toLowerCase()) return 0;
      weight += 1;
    }
  }
  return weight;
}

// A tick box for marketing emails, not the terms of use, even when it says
// "you agree to receive marketing emails"
const MARKETING = /news|offer|promo|marketing|updates|email me|mailing/i;
const TERMS = /terms|conditions|policy|agree|accept/i;
const isTerms = (label) => TERMS.test(label) && !MARKETING.test(label);

const urlIn = (text) => text?.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1] ?? null;
const BACKGROUND_PLACE = /(^|[\s,>.#-])(html|body|bg|background|backdrop|wrapper|landing|splash|page|main|container|hero|cover)\b/i;

// What the page offers to copy:
// { logo, backgroundImage, heading, message, button, footer,
//   color (the button's), background (the page's), cardColor and
//   cardOpacity (the box's), fields: [{ label, type, required, options,
//   consent }], terms }
export async function readPortal(address) {
  const page = await getPublic(address, { accept: "text/html,*/*", max: MAX_PAGE, what: "page" });
  if (!/html|xml|text\/plain/.test(page.type))
    throw new Problem("That address isn't a web page.");
  const root = parse(page.body.toString("utf8"), {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: false, pre: true },
  });
  const full = (u) => {
    if (!u) return null;
    try {
      return new URL(u.trim(), page.url).href;
    } catch {
      return null;
    }
  };
  for (const el of root.querySelectorAll("script, noscript, template")) el.remove();

  // ----- Pictures -----
  const imgs = root
    .querySelectorAll("img")
    .map((img) => ({
      src: img.getAttribute("src") || img.getAttribute("data-src"),
      hint: ["src", "alt", "class", "id"].map((a) => img.getAttribute(a) ?? "").join(" ").toLowerCase(),
      parentHint: `${img.parentNode?.getAttribute?.("class") ?? ""} ${img.parentNode?.getAttribute?.("id") ?? ""}`.toLowerCase(),
    }))
    .filter((i) => i.src && !/^data:image\/gif/.test(i.src) && !/pixel|spacer|track/.test(i.hint));
  const logoImg =
    imgs.find((i) => /logo|brand/.test(i.hint) || /logo|brand/.test(i.parentHint)) ?? imgs[0];

  // The page's CSS: its own <style> and up to 4 linked stylesheets
  const sheets = [{ css: root.querySelectorAll("style").map((st) => st.textContent).join("\n"), base: page.url }];
  for (const link of root.querySelectorAll('link[rel~="stylesheet"]').slice(0, 4)) {
    const href = full(link.getAttribute("href"));
    if (!href) continue;
    try {
      const css = await getPublic(href, { accept: "text/css,*/*", max: MAX_CSS, what: "stylesheet" });
      sheets.push({ css: css.body.toString("utf8"), base: css.url });
    } catch {
      // a missing stylesheet just means less to copy
    }
  }
  const cssRules = sheets.flatMap(({ css, base }) =>
    rules(css).map((rule) => ({ ...rule, base, decls: declarations(rule.body) })),
  );

  // The background: a style="" on the page, then the CSS, on something
  // page-sized
  let backgroundUrl = null;
  const styled = root.querySelectorAll("[style]").find((el) => /background[^;]*url\(/i.test(el.getAttribute("style")));
  if (styled) backgroundUrl = full(urlIn(styled.getAttribute("style")));
  if (!backgroundUrl) {
    const found = [];
    for (const rule of cssRules) {
      const u = urlIn(rule.body.match(/background(-image)?\s*:[^;]*/i)?.[0]);
      if (!u || /logo|icon|sprite|\.svg/i.test(u)) continue;
      try {
        found.push({ url: new URL(u, rule.base).href, place: BACKGROUND_PLACE.test(rule.selector) });
      } catch {
        // not a usable address
      }
    }
    backgroundUrl = (found.find((f) => f.place) ?? found[0])?.url ?? null;
  }

  // ----- Words -----
  const heading =
    [...root.querySelectorAll("h1"), ...root.querySelectorAll("h2"), ...root.querySelectorAll("h3")]
      .map(words)
      .find((t) => t && t.length <= 120) ?? words(root.querySelector("title")).slice(0, 120);
  const message =
    root
      .querySelectorAll("p")
      .filter((p) => !p.closest("footer") && !p.closest("label") && !p.closest("form label"))
      .map(words)
      .find((t) => t.length >= 8 && t.length <= 300) ?? "";
  const submit =
    root.querySelector('button[type="submit"]') ??
    root.querySelector('input[type="submit"]') ??
    root.querySelector("form button") ??
    root.querySelector("button");
  const button = tidy(submit?.tagName === "INPUT" ? submit.getAttribute("value") : words(submit)).slice(0, 40);
  const footerEl =
    root.querySelector("footer") ??
    root.querySelectorAll("[class], [id]").find((el) => /footer|powered|copyright/i.test(`${el.getAttribute("class")} ${el.getAttribute("id")}`));
  const footer = words(footerEl).slice(0, 200);

  // ----- Colours: the button's, the page's and the box's -----
  // CSS variables (--brand: #c2410c), so var(--brand) can be read
  const vars = {};
  for (const rule of cssRules) for (const [k, v] of rule.decls) if (k.startsWith("--")) vars[k] = v;
  const resolve = (value) => {
    let v = value;
    for (let i = 0; i < 4 && /var\(/.test(v); i++)
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => vars[name] ?? fallback ?? "");
    return v;
  };
  // The colour in "background-color: …" or "background: …":
  // undefined = not set here, null = see-through or none
  const colorIn = (decls) => {
    let found;
    for (const [k, v] of decls) {
      if (k !== "background" && k !== "background-color") continue;
      const value = resolve(v).replace(/url\([^)]*\)/gi, " ");
      const token = value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b[a-z]+\b/gi)?.find((t) => readColor(t));
      found = token ? readColor(token) : null;
    }
    return found;
  };
  // An element's own background colour (style="" first, then the CSS
  // rule that describes it most closely; a later one wins a tie)
  const backgroundOf = (el) => {
    if (!el?.getAttribute) return null;
    const own = colorIn(declarations(el.getAttribute("style")));
    if (own !== undefined) return own;
    let best = null;
    let bestWeight = 0;
    for (const rule of cssRules)
      for (const selector of rule.selector.split(",")) {
        const w = weigh(selector, el);
        if (!w || w < bestWeight) continue;
        const c = colorIn(rule.decls);
        if (c === undefined) continue;
        best = c;
        bestWeight = w;
      }
    return best;
  };
  const solid = (c) => (c && c.alpha >= 0.1 ? c : null);
  const themeColor = readColor(root.querySelector('meta[name="theme-color"]')?.getAttribute("content"));
  const color = (solid(backgroundOf(submit)) ?? themeColor)?.hex ?? null;
  const html = root.querySelector("html");
  const body = root.querySelector("body");
  const background = (solid(backgroundOf(body)) ?? solid(backgroundOf(html)))?.hex ?? null;
  // The box: the first thing behind the questions with a colour of its
  // own, below the page itself
  let box = null;
  for (let el = root.querySelector("form") ?? submit?.parentNode; el && el !== body && el !== html; el = el.parentNode) {
    box = solid(backgroundOf(el));
    if (box) break;
  }
  const cardColor = box?.hex ?? null;
  const cardOpacity = box ? Math.max(0.3, Math.round(box.alpha * 20) / 20) : null;

  // ----- Questions -----
  const fields = [];
  let terms = false;
  const seen = new Set();
  for (const el of root.querySelectorAll("input, select, textarea")) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") ?? (tag === "input" ? "text" : tag)).toLowerCase();
    if (["hidden", "submit", "button", "image", "reset", "password", "radio", "file", "search"].includes(type)) continue;
    const id = el.getAttribute("id");
    const name = el.getAttribute("name") ?? "";
    let label =
      (id && labelWords(root.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`))) ||
      labelWords(el.closest("label")) ||
      el.getAttribute("placeholder") ||
      el.getAttribute("aria-label") ||
      human(name);
    label = tidy(label).replace(/\s*\*$/, "").slice(0, 80);
    if (!label) continue;
    if (type === "checkbox" && isTerms(label)) {
      terms = true;
      continue;
    }
    const kind =
      type === "checkbox"
        ? "checkbox"
        : tag === "select"
          ? "choice"
          : type === "email" || /e-?mail/i.test(name)
            ? "email"
            : type === "tel" || /phone|mobile|tel\b/i.test(name)
              ? "phone"
              : "text";
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({
      label,
      name,
      type: kind,
      required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
      options:
        kind === "choice"
          ? el
              .querySelectorAll("option")
              .filter((o) => o.getAttribute("value") !== "" && !o.hasAttribute("disabled"))
              .map(words)
              .filter(Boolean)
              .slice(0, 30)
          : [],
      consent: kind === "checkbox" && MARKETING.test(label),
    });
    if (fields.length >= 10) break;
  }

  const [logo, backgroundImage] = await Promise.all([
    getPicture(full(logoImg?.src)),
    getPicture(backgroundUrl),
  ]);

  const result = {
    logo, backgroundImage, heading, message, button, footer,
    color, background, cardColor, cardOpacity, fields, terms,
    // Whether there's a form to try signing in with (see tryPortal)
    canTry: Boolean(formOf(root)),
  };
  const anything = logo || backgroundImage || fields.length || heading || message;
  if (!anything)
    throw new Problem(
      "Nothing could be read from that page. It probably draws itself with JavaScript after it opens, so there's no logo or questions in what it sends.",
    );
  return result;
}

// The page's sign-in form: the one with the most boxes to fill in
function formOf(root) {
  return (
    root
      .querySelectorAll("form")
      .map((form) => ({
        form,
        boxes: form.querySelectorAll('input:not([type="hidden"]), select, textarea').length,
      }))
      .filter((f) => f.boxes > 0)
      .sort((a, b) => b.boxes - a.boxes)[0]?.form ?? null
  );
}

// What to type in a box the admin didn't fill in, if it must be filled
function filler(el) {
  const type = (el.getAttribute("type") ?? "text").toLowerCase();
  const name = (el.getAttribute("name") ?? "").toLowerCase();
  if (type === "email" || /e-?mail/.test(name)) return "test@example.com";
  if (type === "tel" || /phone|mobile|tel\b/.test(name)) return "4730000000";
  if (type === "number") return "1";
  if (type === "date") return "2000-01-01";
  return "Test";
}

// The words of an error message on the page, if it shows one
function errorOn(root) {
  const el = root
    .querySelectorAll("[class], [role=alert]")
    .find(
      (e) =>
        e.getAttribute("role") === "alert" ||
        /\b(alert|error|errors|danger|invalid|warning|flash|message-error)\b/i.test(e.getAttribute("class")),
    );
  return words(el).slice(0, 300);
}

// Where a script on the page sends the browser, e.g.
// window.location.href = "https://example.com"
function scriptGoesTo(html, base) {
  const m = html.match(/(?:window\.|document\.)?location(?:\.href)?\s*(?:=|\.replace\(|\.assign\()\s*["'`]([^"'`]+)["'`]/i);
  if (!m) return null;
  try {
    return new URL(m[1], base).href;
  } catch {
    return null;
  }
}

// Site settings → Look → Copy an existing portal → "Try signing in":
// fills in the portal's form with the admin's test answers (by the boxes'
// names; anything else that must be filled gets a stand-in), sends it
// like a guest would, and reads the page that comes after: its pictures
// (a splash ad), its words, and where it sends the guest next.
// It stops at the first other website (usually where guests are sent at
// the end), without opening it.
// Returns { steps: [address…], blocked: why it didn't get through, or "",
//   pictures: [{ image, link }], heading, message, leftTo }
export async function tryPortal(address, answers = {}) {
  const jar = new Map();
  const first = await getPublic(address, { accept: "text/html,*/*", max: MAX_PAGE, what: "page", jar });
  const host = new URL(first.url).host;
  const root = parse(first.body.toString("utf8"), { comment: false });
  const form = formOf(root);
  if (!form) throw new Problem("There's no sign-in form on that page to fill in.");

  const data = new URLSearchParams();
  const done = new Set();
  for (const el of form.querySelectorAll("input, select, textarea")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") ?? (tag === "input" ? "text" : tag)).toLowerCase();
    if (["submit", "button", "image", "reset", "file"].includes(type)) continue;
    const given = answers[name];
    if (type === "checkbox") {
      // Tick the terms, anything that must be ticked, and what the admin
      // ticked; not marketing emails, unless the portal insists
      const label = labelWords(el.closest("label")) || labelWords(root.querySelector(`label[for="${el.getAttribute("id")}"]`));
      if (given === true || el.hasAttribute("required") || el.hasAttribute("checked") || isTerms(label))
        data.append(name, el.getAttribute("value") ?? "on");
      continue;
    }
    if (type === "radio") {
      if (done.has(name)) continue;
      const pick = form.querySelectorAll(`input[type="radio"]`).filter((r) => r.getAttribute("name") === name);
      const chosen = pick.find((r) => r.hasAttribute("checked")) ?? pick[0];
      data.append(name, chosen.getAttribute("value") ?? "on");
      done.add(name);
      continue;
    }
    if (tag === "select") {
      const options = el.querySelectorAll("option").filter((o) => !o.hasAttribute("disabled"));
      const byWords = typeof given === "string" && options.find((o) => words(o) === given || o.getAttribute("value") === given);
      const option = byWords || options.find((o) => o.hasAttribute("selected")) || options.find((o) => (o.getAttribute("value") ?? words(o)) !== "");
      data.append(name, option ? (option.getAttribute("value") ?? words(option)) : "");
      continue;
    }
    let value = typeof given === "string" ? given : tag === "textarea" ? words(el) : (el.getAttribute("value") ?? "");
    if (!value && type !== "hidden" && el.hasAttribute("required")) value = filler(el);
    data.append(name, value);
  }
  // The button itself, if it has a name, is part of what's sent
  const button = form.querySelector('button[type="submit"][name], input[type="submit"][name], button:not([type])[name]');
  if (button) data.append(button.getAttribute("name"), button.getAttribute("value") ?? "");

  let target;
  try {
    target = new URL(form.getAttribute("action") || first.url, first.url);
  } catch {
    throw new Problem("The form on that page sends its answers to an address that isn't valid.");
  }
  const post = (form.getAttribute("method") ?? "get").toLowerCase() === "post";
  if (!post) target.search = data.toString();

  // Send it, then follow the pages that come after: the portal's answer,
  // then pages that send the browser on by themselves (a "refresh", a
  // script, or an answer in JSON naming the next address), e.g. Spotipo:
  // sign-in → splash ad page → "Loading" page → the venue's website
  const steps = [first.url];
  const pages = []; // the pages after signing in: { url, root }
  let leftTo = null;
  let next = { url: target.href, method: post ? "POST" : "GET" };
  for (let hop = 0; hop < 5 && next; hop++) {
    let page;
    try {
      page = await getPublic(next.url, {
        accept: "text/html,application/json,*/*",
        max: MAX_PAGE,
        what: "page after signing in",
        jar,
        method: next.method,
        form: data,
        stayOn: host,
      });
    } catch (err) {
      if (!pages.length) throw err; // the sign-in itself didn't work
      break; // a later page didn't open: keep what was found
    }
    if (page.leftTo) {
      leftTo = page.leftTo;
      break;
    }
    steps.push(page.url);
    const body = page.body.toString("utf8");
    let goTo = null;
    if (/json/.test(page.type) || /^\s*[[{]/.test(body)) {
      goTo = addressInJson(body);
    } else {
      const root = parse(body, { comment: false, blockTextElements: { script: true, style: true, noscript: false, pre: true } });
      pages.push({ url: page.url, root, html: body });
      goTo =
        root
          .querySelectorAll("meta")
          .find((m) => /refresh/i.test(m.getAttribute("http-equiv") ?? ""))
          ?.getAttribute("content")
          ?.match(/url\s*=\s*['"]?([^'";]+)/i)?.[1] ?? scriptGoesTo(body, page.url);
    }
    next = null;
    if (!goTo) break;
    let nextUrl;
    try {
      nextUrl = new URL(goTo, page.url);
    } catch {
      break;
    }
    if (!/^https?:$/.test(nextUrl.protocol)) break;
    if (nextUrl.host !== host) {
      leftTo = nextUrl.href;
      break;
    }
    if (steps.includes(nextUrl.href)) break;
    next = { url: nextUrl.href, method: "GET" };
  }

  const result = { steps, blocked: "", pictures: [], heading: "", message: "", leftTo };
  if (!pages.length) return result; // went straight on to another website

  for (const { root: r } of pages) for (const el of r.querySelectorAll("script, noscript, template")) el.remove();
  // The portal's answer is the same form again: it didn't let the test through
  const answer = pages[0].root;
  const again = formOf(answer);
  const sameForm =
    again &&
    form.querySelectorAll("[name]").some((el) =>
      again.querySelectorAll("[name]").some((e) => e.getAttribute("name") === el.getAttribute("name") && el.getAttribute("type") !== "hidden"),
    );
  if (sameForm) {
    result.blocked =
      errorOn(answer) || "It came back to the same sign-in form, so the portal didn't let the test sign-in through.";
    return result;
  }

  // The words: from the first page after signing in that has some
  for (const { root: r } of pages) {
    result.heading ||=
      [...r.querySelectorAll("h1"), ...r.querySelectorAll("h2"), ...r.querySelectorAll("h3")]
        .map(words)
        .find((t) => t && t.length <= 120 && !/^loading/i.test(t)) ?? "";
    result.message ||=
      r
        .querySelectorAll("p")
        .filter((el) => !el.closest("footer"))
        .map(words)
        .find((t) => t.length >= 8 && t.length <= 300 && !/^loading/i.test(t)) ?? "";
  }

  // The pictures on every page after signing in (a splash page can have
  // several), not logos or icons, with where tapping each one goes.
  // Pictures that were already on the sign-in page (its logo and
  // background) don't count.
  const firstHtml = first.body.toString("utf8");
  const seen = new Set(picturesInText(firstHtml, first.url));
  for (const img of root.querySelectorAll("img")) {
    try {
      seen.add(new URL(img.getAttribute("src") ?? "", first.url).href);
    } catch {
      // not a usable address
    }
  }
  const found = [];
  for (const { url: base, root: r, html: pageHtml } of pages) {
    const add = (src, link = "") => {
      let address;
      try {
        address = new URL(src, base).href;
      } catch {
        return;
      }
      if (seen.has(address)) return;
      seen.add(address);
      found.push({ address, link });
    };
    for (const img of r.querySelectorAll("img")) {
      const hint = ["src", "alt", "class", "id"].map((a) => img.getAttribute(a) ?? "").join(" ").toLowerCase();
      const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src");
      const width = Number(img.getAttribute("width")) || 0;
      if (!src || /^data:image\/gif/.test(src) || /logo|brand|icon|pixel|spacer|track|avatar|loading|spinner/.test(hint)) continue;
      if (width && width < 120) continue;
      let link = img.closest("a")?.getAttribute("href") ?? "";
      try {
        link = link ? new URL(link, base).href : "";
      } catch {
        link = "";
      }
      add(src, /^https?:/.test(link) ? link : "");
    }
    // Pictures set as a background (style="background-image: url(…)")
    for (const el of r.querySelectorAll("[style]")) {
      const u = urlIn(el.getAttribute("style"));
      if (u && !/logo|icon|sprite|spinner|loading/i.test(u)) add(u);
    }
    // Pictures a script puts on the page after it opens (Spotipo's splash
    // ads): any picture address written in the page's code
    for (const u of picturesInText(pageHtml, base)) add(u);
  }
  for (const pic of found.slice(0, 8)) {
    const image = await getPicture(pic.address);
    if (image) result.pictures.push({ image, link: pic.link });
    if (result.pictures.length >= 6) break;
  }
  return result;
}

// Every picture address written anywhere in a page's text (its code
// included), except logos, icons and loading spinners
function picturesInText(text, base) {
  const out = [];
  const re = /(?:https?:\/\/|\/)[^\s"'()<>\\,]+?\.(?:jpe?g|png|webp|gif)(?:\?[^\s"'()<>\\]*)?(?=["'()\s<>\\,]|$)/gi;
  for (const m of String(text).replace(/\\\//g, "/").matchAll(re)) {
    if (/logo|icon|favicon|sprite|spinner|loading|loader|pixel|avatar|flag/i.test(m[0])) continue;
    try {
      const address = new URL(m[0], base).href;
      if (!out.includes(address)) out.push(address);
    } catch {
      // not a usable address
    }
  }
  return out;
}

// The next address in a JSON answer ({ "redirect": "/splash/…" } and the
// like), or null
function addressInJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const found = [];
  const walk = (v, key = "") => {
    if (found.length) return;
    if (typeof v === "string") {
      if (/redirect|next|url|location|goto|href/i.test(key) && /^(https?:\/\/|\/)/.test(v)) found.push(v);
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(data);
  return found[0] ?? null;
}
