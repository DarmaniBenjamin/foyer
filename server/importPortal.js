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
async function getPublic(address, { accept, max, what }) {
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
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { "User-Agent": AGENT, Accept: accept },
      });
    } catch (err) {
      throw new Problem(
        err.name === "TimeoutError"
          ? `${url.hostname} took too long to answer.`
          : `Couldn't reach ${url.hostname} (${err.cause?.code ?? err.message}).`,
      );
    }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url);
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
    if (type === "checkbox" && /terms|conditions|policy|agree|accept/i.test(label)) {
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
      consent: kind === "checkbox" && /news|offer|promo|marketing|updates|email me/i.test(label),
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
  };
  const anything = logo || backgroundImage || fields.length || heading || message;
  if (!anything)
    throw new Problem(
      "Nothing could be read from that page. It probably draws itself with JavaScript after it opens, so there's no logo or questions in what it sends.",
    );
  return result;
}
