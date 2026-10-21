// The people who can sign in to Foyer, and the example ones used until
// the server exists.
// - Admins (role "admin", you and your team) see and change everything.
// - Client logins (role "client", like Spotipo's client accounts) see
//   only their own sites (siteIds), with Read, Read & write or No access
//   to each area (access). They always see their sites' Dashboard and
//   Reports, and never Sites, Controllers or Users.
//
// FOR NOW (no server yet): passwords are kept as typed, in memory only,
// so the sign-in page can be tried. The server will keep only scrambled
// copies (like Uplink) and check them itself, and only send a client
// their own sites' data.

export const DEMO_EMAIL = "admin@example.com";
export const DEMO_PASSWORD = "foyer-demo";

export const ROLES = {
  admin: { label: "Admin", detail: "Your team: every site and every setting" },
  client: { label: "Client", detail: "A customer: only their sites, with the access you pick" },
};

// What a client login can be given access to (named as in Spotipo)
export const ACCESS_AREAS = [
  { key: "guests", label: "Guest data", detail: "Guests page and Excel download. Write: forget guests." },
  { key: "ads", label: "Campaigns", detail: "Splash ads. Write: add, change and turn them on or off." },
  { key: "vouchers", label: "Voucher data", detail: "Vouchers and printing. Write: make and delete them." },
  { key: "whitelist", label: "Device whitelisting", detail: "Write: add, change and remove devices." },
];

export const ACCESS_LEVELS = {
  none: "No access",
  read: "Read",
  write: "Read & write",
};

export const NO_ACCESS = { guests: "none", ads: "none", vouchers: "none", whitelist: "none" };

// Can this person see (level "read") or change (level "write") an area?
// Areas: the ACCESS_AREAS keys, plus "reports" (Dashboard and Reports)
// and the admin-only "sites", "controllers" and "admins".
export function canAccess(user, area, level = "read") {
  if (!user) return false;
  if (user.role !== "client") return true;
  if (area === "reports") return level === "read";
  const have = user.access?.[area] ?? "none";
  return level === "read" ? have !== "none" : have === "write";
}

const day = 24 * 60 * 60 * 1000;

export const STARTING_ADMINS = [
  {
    id: 1,
    name: "Darmani Benjamin",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    role: "admin",
    siteIds: [],
    access: NO_ACCESS,
    createdAt: Date.now() - 40 * day,
    lastActiveAt: Date.now(),
  },
  {
    id: 2,
    name: "Support Team",
    email: "support@example.com",
    password: "support-demo",
    role: "admin",
    siteIds: [],
    access: NO_ACCESS,
    createdAt: Date.now() - 12 * day,
    lastActiveAt: Date.now() - 3 * day,
  },
  {
    id: 3,
    name: "Mall Manager",
    email: "manager@example.com",
    password: "client-demo",
    role: "client",
    siteIds: [1],
    access: { guests: "read", ads: "write", vouchers: "none", whitelist: "read" },
    createdAt: Date.now() - 30 * day,
    lastActiveAt: Date.now() - 6 * day,
  },
];

export const PASSWORD_RULE = "Use at least 10 characters for the password.";

export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// "Darmani Benjamin" → "DB"
export function adminInitials(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}