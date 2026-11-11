// A splash ad built in the page builder (Splash ads → an ad → Build a
// page), kept in ads.design. The page is a list of sections, top to
// bottom. Each section has 1 to 3 columns side by side (one under the
// other on phones), and each column has blocks: words, a picture, a
// button, a video or some space. A section can have a picture behind it,
// with its blocks on top.
//
// design = { background, width, sections: [section] }
//   background: the colour behind everything
//   width: how wide the page gets on a computer (px)
// section = { id, columns: [column], gap, bg, image, imageFit, imageX,
//   imageY, dim, padY, padX, marginTop, marginBottom, radius, minHeight,
//   fillScreen, align, stack, hide, tablet, phone }
//   fillScreen: at least as tall as the guest's screen
// column = { id, span, blocks: [block], bg, padY, padX, radius }
// block = { id, type, marginTop, marginBottom, align, hide, tablet, phone,
//   …what its type needs (BLOCKS) }
//
// Sizes and spacing can be different on a tablet or phone: what's in
// tablet: {…} changes the computer look on tablets, and phone: {…} the
// tablet look on phones (see lookOn). hide: the devices it doesn't show on.
//
// cleanDesign() checks a design from the page before it's saved, so only
// these things, with sensible values, get kept.

// width and height: the screen the builder shows for each
export const DEVICES = {
  desktop: { label: "Computer", width: 1280, height: 800 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  phone: { label: "Phone", width: 390, height: 844 },
};

// The device a screen this wide counts as
export const deviceFor = (width) => (width < 640 ? "phone" : width < 1024 ? "tablet" : "desktop");

// An item's settings on a device: the computer's, with the tablet's
// changes on tablets, and the tablet's and phone's changes on phones
export function lookOn(item, device) {
  if (!item || device === "desktop") return item;
  if (device === "tablet") return { ...item, ...item.tablet };
  return { ...item, ...item.tablet, ...item.phone };
}

export const FONTS = {
  sans: { label: "Clean", stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" },
  serif: { label: "Classic", stack: "ui-serif, Georgia, 'Times New Roman', serif" },
  rounded: { label: "Rounded", stack: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Arial Rounded MT Bold', system-ui, sans-serif" },
  mono: { label: "Typewriter", stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
};

// What each kind of block has, and what it starts with
export const BLOCKS = {
  text: { label: "Words", start: { text: "Your words here", size: 18, bold: false, italic: false, color: "#ffffff", font: "sans", lineHeight: 1.4, uppercase: false } },
  image: { label: "Picture", start: { src: "", width: 100, radius: 12, link: "", alt: "", shadow: false } },
  button: { label: "Button", start: { text: "Find out more", link: "", color: "#2563eb", textColor: "#ffffff", size: 16, radius: 12, full: false, bold: true } },
  video: { label: "Video", start: { source: "upload", src: "", url: "", width: 100, radius: 12, sound: false, loop: true, controls: false } },
  space: { label: "Space", start: { height: 24 } },
};

const SECTION_START = {
  gap: 16,
  bg: "",
  image: "",
  imageFit: "cover",
  imageX: 50,
  imageY: 50,
  dim: 0,
  padY: 32,
  padX: 24,
  marginTop: 0,
  marginBottom: 0,
  radius: 0,
  minHeight: 0,
  fillScreen: false,
  align: "middle",
  stack: true,
  hide: [],
};
const COLUMN_START = { span: 1, bg: "", padY: 0, padX: 0, radius: 0 };
const BLOCK_START = { marginTop: 0, marginBottom: 12, align: "center", hide: [] };

export const newId = () => Math.random().toString(36).slice(2, 10);

export function makeBlock(type, values = {}) {
  return { id: newId(), type, ...BLOCK_START, ...BLOCKS[type].start, ...values };
}
export function makeColumn(blocks = [], values = {}) {
  return { id: newId(), ...COLUMN_START, ...values, blocks };
}
export function makeSection(columns, values = {}) {
  return { id: newId(), ...SECTION_START, ...values, columns };
}

// Ready-made sections to start from
export const SECTION_TEMPLATES = {
  hero: {
    label: "Picture with words on top",
    make: () =>
      makeSection(
        [
          makeColumn([
            makeBlock("text", { text: "Welcome", size: 40, bold: true }),
            makeBlock("text", { text: "Something worth knowing about, in a line or two." }),
            makeBlock("button", { text: "Find out more" }),
          ]),
        ],
        { bg: "#1f2937", minHeight: 420, dim: 0.35, padY: 48 },
      ),
  },
  split: {
    label: "Words and picture side by side",
    make: () =>
      makeSection(
        [
          makeColumn([
            makeBlock("text", { text: "Tonight", size: 32, bold: true, align: "left" }),
            makeBlock("text", { text: "Tell guests what's on.", align: "left" }),
            makeBlock("button", { text: "Book now", align: "left" }),
          ]),
          makeColumn([makeBlock("image")]),
        ],
        { bg: "#111827", phone: { padY: 24 } },
      ),
  },
  picture: { label: "A picture", make: () => makeSection([makeColumn([makeBlock("image", { marginBottom: 0 })])], { padY: 0, padX: 0 }) },
  pictures2: {
    label: "Two pictures",
    make: () => makeSection([makeColumn([makeBlock("image", { marginBottom: 0 })]), makeColumn([makeBlock("image", { marginBottom: 0 })])], { padY: 16, padX: 16 }),
  },
  pictures3: {
    label: "Three pictures",
    make: () =>
      makeSection(
        [1, 2, 3].map(() => makeColumn([makeBlock("image", { marginBottom: 0 })])),
        { padY: 16, padX: 16 },
      ),
  },
  words: {
    label: "Words",
    make: () =>
      makeSection([
        makeColumn([makeBlock("text", { text: "A heading", size: 28, bold: true }), makeBlock("text", { text: "Some words under it." })]),
      ]),
  },
  video: { label: "A video", make: () => makeSection([makeColumn([makeBlock("video", { marginBottom: 0 })])], { padY: 0, padX: 0 }) },
  empty: { label: "Empty section", make: () => makeSection([makeColumn([])], { minHeight: 120 }) },
};

// A new built ad: the ad's pictures (if it has some), or a section to
// start from
export function startDesign(pictures = []) {
  const sections = pictures.length
    ? pictures.map((p) =>
        makeSection([makeColumn([makeBlock("image", { src: p.image, link: p.link ?? "", radius: 0, marginBottom: 0 })])], {
          padY: 0,
          padX: 0,
        }),
      )
    : [SECTION_TEMPLATES.hero.make()];
  return { background: "#000000", width: 960, sections };
}

// The first picture in a design (for the ads list), or ""
export function firstPicture(design) {
  for (const s of design?.sections ?? []) {
    if (s.image) return s.image;
    for (const c of s.columns) for (const b of c.blocks) if (b.type === "image" && b.src) return b.src;
  }
  return "";
}

// YouTube or Vimeo address → the address of its player, or ""
export function videoPlayer(url, { sound = false, loop = true, controls = false } = {}) {
  const u = String(url ?? "").trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m)
    return `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&mute=${sound ? 0 : 1}&playsinline=1&rel=0&modestbranding=1&controls=${controls ? 1 : 0}${loop ? `&loop=1&playlist=${m[1]}` : ""}`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m)
    return `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=${sound ? 0 : 1}&loop=${loop ? 1 : 0}&controls=${controls ? 1 : 0}&playsinline=1`;
  return "";
}

// ---------- Checking a design before it's saved ----------

const num = (v, low, high, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};
const color = (v, fallback = "") => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v).toLowerCase() : fallback);
const pick = (v, choices, fallback) => (choices.includes(v) ? v : fallback);
const words = (v, max) => String(v ?? "").slice(0, max);
const link = (v) => {
  const s = String(v ?? "").trim();
  return /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(s) && s.length <= 2000 ? s : "";
};
// Pictures and videos: uploaded to Foyer (/media/…), or a web address
const mediaUrl = (v) => {
  const s = String(v ?? "").trim();
  if (/^\/media\/[\w-]{8,40}$/.test(s)) return s;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(s) && s.length < 3_000_000) return s;
  return link(s);
};
const devices = (v) => (Array.isArray(v) ? v.filter((d) => d in DEVICES) : []);
const id = (v) => (/^[\w-]{1,20}$/.test(String(v ?? "")) ? String(v) : newId());

// The settings that can be different on a tablet or phone, and how to check them
const SECTION_STYLE = {
  gap: (v) => num(v, 0, 80, 16),
  imageX: (v) => num(v, 0, 100, 50),
  imageY: (v) => num(v, 0, 100, 50),
  dim: (v) => num(v, 0, 0.9, 0),
  padY: (v) => num(v, 0, 240, 32),
  padX: (v) => num(v, 0, 240, 24),
  marginTop: (v) => num(v, 0, 240, 0),
  marginBottom: (v) => num(v, 0, 240, 0),
  radius: (v) => num(v, 0, 60, 0),
  minHeight: (v) => num(v, 0, 1600, 0),
  fillScreen: Boolean,
  align: (v) => pick(v, ["top", "middle", "bottom"], "middle"),
  imageFit: (v) => pick(v, ["cover", "contain"], "cover"),
};
const COLUMN_STYLE = {
  span: (v) => num(v, 1, 3, 1),
  padY: (v) => num(v, 0, 240, 0),
  padX: (v) => num(v, 0, 240, 0),
  radius: (v) => num(v, 0, 60, 0),
};
const BLOCK_STYLE = {
  marginTop: (v) => num(v, 0, 240, 0),
  marginBottom: (v) => num(v, 0, 240, 12),
  align: (v) => pick(v, ["left", "center", "right"], "center"),
  size: (v) => num(v, 8, 120, 16),
  lineHeight: (v) => num(v, 0.8, 3, 1.4),
  width: (v) => num(v, 5, 100, 100),
  radius: (v) => num(v, 0, 999, 12),
  height: (v) => num(v, 0, 600, 24),
  bold: Boolean,
  italic: Boolean,
  uppercase: Boolean,
  full: Boolean,
};

// What the builder writes to tablet: {…} / phone: {…} when you change it
// while looking at a tablet or phone
// (sizes and spacing; bold, italic and the like are the same everywhere)
const SAME_EVERYWHERE = ["bold", "italic", "uppercase", "full"];
export const DEVICE_KEYS = {
  section: Object.keys(SECTION_STYLE),
  column: Object.keys(COLUMN_STYLE),
  block: Object.keys(BLOCK_STYLE).filter((k) => !SAME_EVERYWHERE.includes(k)),
};

function styleOf(raw, rules) {
  const out = {};
  for (const [k, check] of Object.entries(rules)) if (raw && k in raw) out[k] = check(raw[k]);
  return out;
}
const overrides = (raw, rules) => ({
  tablet: styleOf(raw?.tablet, rules),
  phone: styleOf(raw?.phone, rules),
});

function cleanBlock(raw) {
  const type = pick(raw?.type, Object.keys(BLOCKS), null);
  if (!type) return null;
  const b = { id: id(raw.id), type, hide: devices(raw.hide), ...overrides(raw, BLOCK_STYLE) };
  b.marginTop = BLOCK_STYLE.marginTop(raw.marginTop);
  b.marginBottom = BLOCK_STYLE.marginBottom(raw.marginBottom);
  b.align = BLOCK_STYLE.align(raw.align);
  if (type === "text")
    Object.assign(b, {
      text: words(raw.text, 3000),
      size: BLOCK_STYLE.size(raw.size),
      bold: Boolean(raw.bold),
      italic: Boolean(raw.italic),
      uppercase: Boolean(raw.uppercase),
      color: color(raw.color, "#ffffff"),
      font: pick(raw.font, Object.keys(FONTS), "sans"),
      lineHeight: BLOCK_STYLE.lineHeight(raw.lineHeight),
    });
  if (type === "image")
    Object.assign(b, {
      src: mediaUrl(raw.src),
      width: BLOCK_STYLE.width(raw.width),
      radius: BLOCK_STYLE.radius(raw.radius),
      link: link(raw.link),
      alt: words(raw.alt, 200),
      shadow: Boolean(raw.shadow),
    });
  if (type === "button")
    Object.assign(b, {
      text: words(raw.text, 80),
      link: link(raw.link),
      color: color(raw.color, "#2563eb"),
      textColor: color(raw.textColor, "#ffffff"),
      size: BLOCK_STYLE.size(raw.size),
      radius: BLOCK_STYLE.radius(raw.radius),
      full: Boolean(raw.full),
      bold: raw.bold !== false,
    });
  if (type === "video")
    Object.assign(b, {
      source: pick(raw.source, ["upload", "link"], "upload"),
      src: mediaUrl(raw.src),
      url: link(raw.url),
      width: BLOCK_STYLE.width(raw.width),
      radius: BLOCK_STYLE.radius(raw.radius),
      sound: Boolean(raw.sound),
      loop: raw.loop !== false,
      controls: Boolean(raw.controls),
    });
  if (type === "space") b.height = BLOCK_STYLE.height(raw.height);
  return b;
}

export function cleanDesign(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 30).map((s) => ({
    id: id(s?.id),
    ...styleOf({ ...SECTION_START, ...s }, SECTION_STYLE),
    bg: color(s?.bg),
    image: mediaUrl(s?.image),
    stack: s?.stack !== false,
    hide: devices(s?.hide),
    ...overrides(s, SECTION_STYLE),
    columns: (Array.isArray(s?.columns) && s.columns.length ? s.columns : [{}]).slice(0, 3).map((c) => ({
      id: id(c?.id),
      ...styleOf({ ...COLUMN_START, ...c }, COLUMN_STYLE),
      bg: color(c?.bg),
      ...overrides(c, COLUMN_STYLE),
      blocks: (Array.isArray(c?.blocks) ? c.blocks : []).slice(0, 30).map(cleanBlock).filter(Boolean),
    })),
  }));
  return {
    background: color(raw.background, "#000000"),
    width: num(raw.width, 320, 1600, 960),
    sections,
  };
}
