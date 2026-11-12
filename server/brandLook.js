// Site settings → Look → Colours from the company's website: reads a
// company's website and finds its brand colours and its logo, for the
// page to show. Nothing is changed here: the admin picks what to use.
//
// Colours, strongest first:
//   - the colour phones show in the browser bar (<meta name="theme-color">)
//   - colours the site names as its own (--primary, --brand, --accent…,
//     e.g. WordPress / Elementor's global colours)
//   - its buttons', menus' and header's colours
//   - every other colour in its CSS, a little each
// Whites, blacks and greys are left out: they're not what makes a brand.
// The logo's own colours are added by the page, which can look at its
// pixels (src/Components/BrandFromWebsite.jsx).
//
// Only public websites, like Copy an existing portal (importPortal.js).
import { parse } from "node-html-parser";
import { Problem } from "./shapes.js";
import { declarations, getPicture, getPublic, readColor, rules } from "./importPortal.js";

const MAX_PAGE = 3 * 1024 * 1024;
const MAX_CSS = 1024 * 1024;
const MAX_SHEETS = 6;

// Stylesheets from common add-ons, whose colours aren't the company's
const ADD_ON = /bootstrap|font-?awesome|fonts\.googleapis|jquery-ui|animate(\.min)?\.css|swiper|slick|owl\.carousel|block-library|dashicons|select2|lightbox|fancybox|woocommerce-(layout|smallscreen)/i;
// CSS variables that name a brand colour, and ones that don't
const BRAND_NAME = /primary|brand|accent|main|theme|secondary|highlight|cta|link|button/i;
const NOT_BRAND = /text|font|white|black|gr[ae]y|border|shadow|muted|light|dark|neutral|bg-?body|wp--preset/i;
// Where a site's own colours usually are
const BRAND_PLACE = /(^|[\s,>.#_-])(btn|button|cta|nav|navbar|header|menu|hero|banner|topbar|top-bar|masthead|site-header|primary)\b|^\s*(button|a)\b/i;

// { hex } → hue/saturation/lightness, to leave out greys
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}
const isGrey = (hex) => {
  const { s, l } = hsl(hex);
  return s < 0.15 || l > 0.95 || l < 0.06;
};
const distance = (a, b) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  return Math.hypot(((x >> 16) & 255) - ((y >> 16) & 255), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255));
};

// The colours in some CSS value: "#fff", "rgb(…)", "red"…
const colorsIn = (value) =>
  (String(value).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b[a-z]+\b/gi) ?? [])
    .map(readColor)
    .filter((c) => c && c.alpha > 0.5)
    .map((c) => c.hex);

// The logo: a picture called logo / brand (header first), a logo drawn
// in the page (<svg>), then the phone home-screen icon, then the favicon
function findLogo(root, full) {
  const hint = (el) =>
    ["src", "alt", "class", "id", "title"].map((a) => el.getAttribute?.(a) ?? "").join(" ").toLowerCase();
  const around = (el) => `${hint(el.parentNode ?? {})} ${hint(el.parentNode?.parentNode ?? {})}`;
  const imgs = root.querySelectorAll("img").filter((img) => img.getAttribute("src") || img.getAttribute("data-src"));
  const src = (img) => full(img.getAttribute("src") || img.getAttribute("data-src"));
  const named = (img) => /logo|brand/.test(hint(img)) || /logo|brand/.test(around(img));
  const inHeader = (img) => Boolean(img.closest("header") || img.closest("nav"));
  const img = imgs.find((i) => named(i) && inHeader(i)) ?? imgs.find(named) ?? imgs.find(inHeader);
  if (img) return { address: src(img), from: "the logo on the page" };

  const svg = root
    .querySelectorAll("svg")
    .find((el) => /logo|brand/.test(`${hint(el)} ${around(el)}`));
  if (svg) {
    const text = svg.toString().replace(/^<svg(?![^>]*xmlns=)/, '<svg xmlns="http://www.w3.org/2000/svg"');
    return { address: `data:image/svg+xml;base64,${Buffer.from(text).toString("base64")}`, from: "the logo on the page" };
  }

  const icon =
    root.querySelector('link[rel~="apple-touch-icon"]') ??
    root.querySelector('link[rel~="apple-touch-icon-precomposed"]') ??
    root.querySelector('link[rel~="icon"][sizes]') ??
    root.querySelector('link[rel~="icon"]');
  if (icon?.getAttribute("href")) return { address: full(icon.getAttribute("href")), from: "the site's icon" };
  return { address: full("/favicon.ico"), from: "the site's icon" };
}

// { website, name, colors: [{ hex, score }] strongest first, logo (a
// data: link, or null), logoFrom }
export async function readBrand(address) {
  let start = String(address ?? "").trim();
  if (!start) throw new Problem("Enter the company's website.");
  const typed = /^https?:\/\//i.test(start);
  if (!typed) start = `https://${start}`;
  const get = (u) => getPublic(u, { accept: "text/html,*/*", max: MAX_PAGE, what: "website" });
  let page;
  try {
    page = await get(start);
  } catch (err) {
    // Typed without https://, and only works without it
    if (typed) throw err;
    page = await get(start.replace(/^https:/, "http:")).catch(() => {
      throw err;
    });
  }
  if (!/html|xml/.test(page.type)) throw new Problem("That address isn't a web page.");
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

  const scores = new Map(); // hex → score
  const add = (hex, score) => {
    if (!hex || isGrey(hex)) return;
    scores.set(hex, (scores.get(hex) ?? 0) + score);
  };
  // Colours that are everywhere add up, but only so far
  const everywhere = new Map();
  const addSmall = (hex) => {
    const n = everywhere.get(hex) ?? 0;
    if (n >= 15) return;
    everywhere.set(hex, n + 1);
    add(hex, 0.2);
  };

  // 1. The browser-bar colour
  for (const meta of root.querySelectorAll('meta[name="theme-color"], meta[name="msapplication-TileColor"]'))
    for (const hex of colorsIn(meta.getAttribute("content"))) add(hex, 10);

  // 2–4. The CSS: the page's own and its stylesheets (not add-ons')
  const sheets = [root.querySelectorAll("style").map((st) => st.textContent).join("\n")];
  const links = root
    .querySelectorAll('link[rel~="stylesheet"]')
    .map((l) => full(l.getAttribute("href")))
    .filter((href) => href && !ADD_ON.test(href))
    .slice(0, MAX_SHEETS);
  const fetched = await Promise.all(
    links.map((href) =>
      getPublic(href, { accept: "text/css,*/*", max: MAX_CSS, what: "stylesheet" })
        .then((css) => css.body.toString("utf8"))
        .catch(() => ""),
    ),
  );
  sheets.push(...fetched);
  const cssRules = sheets.flatMap((css) => rules(css).map((r) => ({ ...r, decls: declarations(r.body) })));

  const vars = {};
  for (const rule of cssRules) for (const [k, v] of rule.decls) if (k.startsWith("--")) vars[k] = v;
  const resolve = (value) => {
    let v = String(value);
    for (let i = 0; i < 4 && /var\(/.test(v); i++)
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => vars[name] ?? fallback ?? "");
    return v;
  };

  for (const [name, value] of Object.entries(vars))
    if (BRAND_NAME.test(name) && !NOT_BRAND.test(name))
      for (const hex of colorsIn(resolve(value))) add(hex, /secondary/i.test(name) ? 5 : 8);

  for (const rule of cssRules) {
    const place = BRAND_PLACE.test(rule.selector) && !/:(hover|focus|active|visited)/i.test(rule.selector);
    for (const [k, v] of rule.decls) {
      if (k.startsWith("--")) continue;
      const hexes = colorsIn(resolve(v));
      if (place && (k === "background" || k === "background-color")) hexes.forEach((h) => add(h, 3));
      else if (place && k === "color") hexes.forEach((h) => add(h, 1.5));
      else if (/color|background|border|fill|stroke/.test(k)) hexes.forEach(addSmall);
    }
  }
  for (const el of root.querySelectorAll("[style]"))
    for (const [k, v] of declarations(el.getAttribute("style")))
      if (/color|background/.test(k)) colorsIn(v).forEach((h) => add(h, 1));

  // Close colours count as one (the stronger one)
  const colors = [];
  for (const [hex, score] of [...scores].sort((a, b) => b[1] - a[1])) {
    const near = colors.find((c) => distance(c.hex, hex) < 40);
    if (near) near.score += score;
    else colors.push({ hex, score });
  }
  colors.sort((a, b) => b.score - a.score);

  const found = findLogo(root, full);
  const logo = await getPicture(found.address);
  const name =
    root.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() ||
    root.querySelector("title")?.textContent?.trim().split(/\s[|–—-]\s/)[0] ||
    new URL(page.url).hostname;

  if (!colors.length && !logo)
    throw new Problem(
      "No colours or logo could be read from that website. It may draw itself with JavaScript, or block visitors like Foyer. Upload the logo under Logo instead.",
    );
  return {
    website: page.url,
    name: name.slice(0, 120),
    colors: colors.slice(0, 8).map((c) => ({ hex: c.hex, score: Math.round(c.score * 10) / 10 })),
    logo,
    logoFrom: logo ? found.from : null,
  };
}
