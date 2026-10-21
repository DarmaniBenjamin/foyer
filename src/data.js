// Example data so the admin site can be built and tried before the
// server exists. It resets when the page reloads. Later the same shapes
// come from the server instead.

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

// Everything a new site starts with.
// slug: its part of the portal's web address (Omada: /omada/<slug>)
// siteKey: UniFi only: the UniFi site's name ("default", or the short
//   code in the controller's address bar), used in /guest/s/<siteKey>/
// fields: the form's questions, in order
// requireTerms: form and voucher sites also ask guests to tick the terms
// look: the portal's logo (a picture), colours and words
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
    look: {
      logo: null,
      color,
      background: "#f4f6fb",
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
  });
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