// Site settings → Look → Copy an existing portal: reads another captive
// portal's sign-in page (e.g. Spotipo's) from its web address and finds
// its logo, background picture, words, button colour and questions, for
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

const urlIn = (text) => text?.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1] ?? null;
const BACKGROUND_PLACE = /(^|[\s,>.#-])(html|body|bg|background|backdrop|wrapper|landing|splash|page|main|container|hero|cover)\b/i;

// What the page offers to copy:
// { logo, backgroundImage, heading, message, button, footer, color,
//   fields: [{ label, type, required, options, consent }], terms, found }
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

  // The background: a style="" on the page, then the page's CSS (its
  // own <style> and up to 3 linked stylesheets), on something page-sized
  let backgroundUrl = null;
  const styled = root.querySelectorAll("[style]").find((el) => /background[^;]*url\(/i.test(el.getAttribute("style")));
  if (styled) backgroundUrl = full(urlIn(styled.getAttribute("style")));
  if (!backgroundUrl) {
    const sheets = [{ css: root.querySelectorAll("style").map((s) => s.textContent).join("\n"), base: page.url }];
    for (const link of root.querySelectorAll('link[rel~="stylesheet"]').slice(0, 3)) {
      const href = full(link.getAttribute("href"));
      if (!href) continue;
      try {
        const css = await getPublic(href, { accept: "text/css,*/*", max: MAX_CSS, what: "stylesheet" });
        sheets.push({ css: css.body.toString("utf8"), base: css.url });
      } catch {
        // a missing stylesheet just means less to copy
      }
    }
    const found = [];
    for (const { css, base } of sheets)
      for (const rule of rules(css)) {
        const u = urlIn(rule.body.match(/background(-image)?\s*:[^;]*/i)?.[0]);
        if (!u || /logo|icon|sprite|\.svg/i.test(u)) continue;
        try {
          found.push({ url: new URL(u, base).href, place: BACKGROUND_PLACE.test(rule.selector) });
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

  // The button colour: the page's theme colour, or the button's own
  const color =
    root.querySelector('meta[name="theme-color"]')?.getAttribute("content")?.match(/#[0-9a-f]{6}\b/i)?.[0] ??
    submit?.getAttribute("style")?.match(/background(-color)?\s*:\s*(#[0-9a-f]{6})\b/i)?.[2] ??
    null;

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

  const result = { logo, backgroundImage, heading, message, button, footer, color, fields, terms };
  const anything = logo || backgroundImage || fields.length || heading || message;
  if (!anything)
    throw new Problem(
      "Nothing could be read from that page. It probably draws itself with JavaScript after it opens, so there's no logo or questions in what it sends.",
    );
  return result;
}
