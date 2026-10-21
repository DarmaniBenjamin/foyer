// The device whitelist: devices (by MAC address) that go straight on to
// a site's Wi-Fi without the sign-in page, like a smart TV or a
// FireStick, until their end date. Example entries are here too, until
// the server exists.
//
// When the server is built, it lets each one on through the site's
// controller for as long as the entry lasts, with its limits.

// "aa-bb-cc-dd-ee-ff", "AABB.CCDD.EEFF"... → "AA:BB:CC:DD:EE:FF" (or "")
export function normalizeMac(value) {
  const hex = String(value ?? "")
    .replace(/[^0-9a-f]/gi, "")
    .toUpperCase();
  return hex.length === 12 ? hex.match(/../g).join(":") : "";
}

// "active" or "expired"
export const whitelistStatus = (entry, now = Date.now()) =>
  entry.expiresAt && entry.expiresAt < now ? "expired" : "active";

const year = 365 * 24 * 60 * 60 * 1000;

// siteId, mac, note, expiresAt (ms, or null = never), downKbps / upKbps /
// dataMb (null = no limit)
export const STARTING_WHITELIST = [
  {
    id: 1,
    siteId: 1,
    mac: "08:57:FB:7F:4A:88",
    note: "Mall FireStick",
    expiresAt: Date.now() + 4 * year,
    downKbps: null,
    upKbps: null,
    dataMb: null,
    createdAt: Date.now() - 200 * 24 * 60 * 60 * 1000,
  },
  {
    id: 2,
    siteId: 1,
    mac: "B8:C6:AA:24:F7:8C",
    note: "TV by hotspot",
    expiresAt: null,
    downKbps: null,
    upKbps: null,
    dataMb: null,
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
  },
  {
    id: 3,
    siteId: 3,
    mac: "3C:22:FB:10:9A:01",
    note: "Front desk tablet",
    expiresAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    downKbps: 10000,
    upKbps: 5000,
    dataMb: null,
    createdAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
  },
];