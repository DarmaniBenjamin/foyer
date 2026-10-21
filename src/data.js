// The shapes of controllers and sites, the lists and helpers the pages
// share, and example data. The example data only goes into a database
// with "npm run db:demo" (for trying Foyer on your own computer); the
// pages get the real data from the server.

// ---------- Controllers ----------

// The UniFi and Omada controllers on the Linode.
// kind: "unifi" | "omada"
// url: the controller's address with its port
// username: UniFi: a local admin. Omada: a Hotspot Operator.
// timeUnit (Omada only): "auto" | "us" | "ms"
// lastTest: the last Test connection's result, or null
export const STARTING_CONTROLLERS = [
  {
    id: 1,
    name: "UniFi controller",
    kind: "unifi",
    url: "https://unifi.example.com:8443",
    username: "portal",
    allowSelfSigned: false,
    timeUnit: "auto",
    lastTest: null,
  },
  {
    id: 2,
    name: "Omada controller",
    kind: "omada",
    url: "https://omada.example.com:8043",
    username: "portal-operator",
    allowSelfSigned: false,
    timeUnit: "auto",
    lastTest: null,
  },
];

export const CONTROLLER_KINDS = {
  unifi: { label: "UniFi", defaultPort: 8443 },
  omada: { label: "Omada", defaultPort: 8043 },
};

// ---------- Sites ----------

// "All sites": the overview of every site
export const ALL_SITES = "all";

export const SIGN_IN_MODES = {
  form: { label: "Form", detail: "Guests fill in your questions" },
  terms: { label: "Accept terms", detail: "Guests only tick the terms" },
  voucher: { label: "Voucher", detail: "Guests type a voucher code" },
};

// The kinds of questions a form can ask
export const FIELD_TYPES = {
  text: "Text",
  email: "Email",
  phone: "Phone number",
  choice: "Pick from a list",
  checkbox: "Tick box",
};

// Ready-made questions for "Add question"
export const FIELD_PRESETS = [
  { label: "First name", type: "text", required: true },
  { label: "Last name", type: "text", required: true },
  { label: "Email", type: "email", required: true },
  { label: "Phone number", type: "phone", required: false },
  {
    label: "Send me news and offers",
    type: "checkbox",
    required: false,
    consent: true,
  },
];

// Colours new sites get for their icon and button, in turn
export const SITE_COLORS = [
  "#1d64d8",
  "#0e7490",
  "#c2410c",
  "#0f766e",
  "#9333ea",
  "#e11d48",
  "#4d7c0f",
  "#b45309",
];

// "First name" → "first_name". Each question's key never changes after
// it's made, so the guest Excel export keeps its columns even if the
// question is renamed.
export function makeKey(label, taken = []) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "question";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`;
  return key;
}

// "Grand Anse Mall" → "grand-anse-mall", for the site's portal address
export function makeSlug(name, taken = []) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "site";
  let slug = base;
  for (let n = 2; taken.includes(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function makeField(preset, taken = []) {
  return {
    key: makeKey(preset.label, taken),
    label: preset.label,
    type: preset.type,
    required: preset.required,
    options: preset.options ?? [],
    // A tick box that is the guest agreeing to marketing (shown as
    // "Consented" on the Guests page)
    consent: Boolean(preset.consent),
  };
}

function defaultFields() {
  const taken = [];
  return FIELD_PRESETS.slice(0, 3).map((preset) => {
    const field = makeField(preset, taken);
    taken.push(field.key);
    return field;
  });
}

// Countries for phone numbers: the site's own is picked first on its
// sign-in page (dial: the code put in front of the number)
export const COUNTRIES = [
  { code: "GD", name: "Grenada", dial: "+1 473" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "TT", name: "Trinidad and Tobago", dial: "+1 868" },
  { code: "BB", name: "Barbados", dial: "+1 246" },
  { code: "VC", name: "St Vincent and the Grenadines", dial: "+1 784" },
  { code: "LC", name: "St Lucia", dial: "+1 758" },
  { code: "DM", name: "Dominica", dial: "+1 767" },
  { code: "AG", name: "Antigua and Barbuda", dial: "+1 268" },
  { code: "KN", name: "St Kitts and Nevis", dial: "+1 869" },
  { code: "JM", name: "Jamaica", dial: "+1 876" },
  { code: "BS", name: "Bahamas", dial: "+1 242" },
  { code: "GY", name: "Guyana", dial: "+592" },
  { code: "VG", name: "British Virgin Islands", dial: "+1 284" },
  { code: "KY", name: "Cayman Islands", dial: "+1 345" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "AU", name: "Australia", dial: "+61" },
];

// Every time zone this browser knows ("America/Grenada"...)
export const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/Grenada", "America/New_York", "Europe/London", "UTC"];

// Everything a new site starts with.
// slug: its part of the portal's web address (Omada: /omada/<slug>)
// siteKey: UniFi only: the UniFi site's name ("default", or the short
//   code in the controller's address bar), used in /guest/s/<siteKey>/
// fields: the form's questions, in order
// requireTerms: form and voucher sites also ask guests to tick the terms
// look: the portal's logo (a picture), colours and words. The page can
//   have a background picture; the box in the middle has its own colour
//   and see-through-ness (cardOpacity, 0.3 to 1). labels: "above" the
//   boxes, or "inside" them (greyed out until the guest types).
// countryCode: the country picked first for phone numbers
// timezone: the site's time zone (for its reports)
// verifyEmailDomain: refuse email addresses with a misspelt or fake
//   domain (e.g. gmial.com)
// minutes: how long each sign-in lasts
// downKbps / upKbps / dataMb: speed and data limits (null = no limit)
// redirectUrl: where guests go after signing in (empty = where they
//   were going)
export function makeSite({ id, name, controllerId, mode, color, slug }) {
  return {
    id,
    name,
    slug,
    controllerId,
    siteKey: "default",
    mode,
    active: true,
    fields: defaultFields(),
    requireTerms: mode === "terms",
    countryCode: "GD",
    timezone: "America/Grenada",
    verifyEmailDomain: true,
    look: {
      logo: null,
      color,
      background: "#f4f6fb",
      backgroundImage: null,
      cardColor: "#ffffff",
      cardOpacity: 1,
      labels: "above",
      footer: "Powered by Protonic Solutions Inc.",
      heading: `Welcome to ${name}`,
      message:
        mode === "voucher"
          ? "Enter your voucher code to get online."
          : "Sign in to get free Wi-Fi.",
      button: "Connect",
      success: "You're connected. Enjoy the Wi-Fi!",
      terms:
        "By connecting, you agree to use this Wi-Fi responsibly and lawfully. The network may be monitored, and access can be ended at any time.",
    },
    minutes: 120,
    downKbps: null,
    upKbps: null,
    dataMb: null,
    redirectUrl: "",
  };
}

function exampleSites() {
  const mall = makeSite({
    id: 1,
    name: "Grand Anse Mall",
    slug: "grand-anse-mall",
    controllerId: 1,
    mode: "form",
    color: "#0e7490",
  });
  mall.fields.push({
    key: "favourite_store",
    label: "What is your favourite store?",
    type: "choice",
    required: false,
    options: ["Supermarket", "Pharmacy", "Clothing", "Electronics", "Other"],
    consent: false,
  });
  mall.fields.push({
    key: "marketing_emails",
    label: "By connecting to this Wi-Fi, you agree to receive occasional marketing emails.",
    type: "checkbox",
    required: false,
    options: [],
    consent: true,
  });
  // Like a Spotipo page: a dark see-through box, labels inside the boxes
  mall.look = {
    ...mall.look,
    background: "#1f2a37",
    cardColor: "#171515",
    cardOpacity: 0.92,
    labels: "inside",
    heading: "Free Wi-Fi Access",
    message: "Please fill out the form below.",
  };
  return [
    mall,
    makeSite({
      id: 2,
      name: "Spice Island Café",
      slug: "spice-island-cafe",
      controllerId: 2,
      mode: "terms",
      color: "#c2410c",
    }),
    makeSite({
      id: 3,
      name: "Harbour View Hotel",
      slug: "harbour-view-hotel",
      controllerId: 1,
      mode: "voucher",
      color: "#0f766e",
    }),
    makeSite({
      id: 4,
      name: "Carenage Bistro",
      slug: "carenage-bistro",
      controllerId: 2,
      mode: "form",
      color: "#9333ea",
    }),
    makeSite({
      id: 5,
      name: "Island Fitness",
      slug: "island-fitness",
      controllerId: 1,
      mode: "form",
      color: "#e11d48",
    }),
  ];
}

export const STARTING_SITES = exampleSites();

// ---------- Small helpers ----------

// "Grand Anse Mall" → "GA"
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Dark or white text, whichever is easier to read on a colour
export function textOn(hex) {
  let h = String(hex ?? "").replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
    ? "#111827"
    : "#ffffff";
}

// 120 → "2 hours", 90 → "1 hour 30 minutes"
export function formatMinutes(total) {
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const part = (n, word) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : "");
  return (
    [part(days, "day"), part(hours, "hour"), part(minutes, "minute")]
      .filter(Boolean)
      .join(" ") || "0 minutes"
  );
}

// "2 minutes ago", for when something last happened (times in ms)
export function timeAgo(ms) {
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}