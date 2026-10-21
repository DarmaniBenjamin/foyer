// Holds the data every page shares: the admins and who is signed in,
// the controllers, the sites, the vouchers, the guests and their
// sign-ins (connections), which site you're looking at (or "All
// sites"), and the date range the Dashboard and Reports show (This month
// to start with). Who is signed in, the site and the date range are
// remembered on this browser, so they're still there after a reload.

import { useMemo, useState } from "react";
import { DataContext } from "./useData";
import {
  ALL_SITES,
  SITE_COLORS,
  STARTING_CONTROLLERS,
  STARTING_SITES,
  makeSite,
  makeSlug,
} from "./data";
import { STARTING_VOUCHERS, makeCodes, voucherStatus } from "./vouchers";
import { STARTING_ADMINS } from "./admins";
import { STARTING_CONNECTIONS, STARTING_GUESTS } from "./guests";

const SAVED_SITE = "foyer-site";

function savedSiteId() {
  try {
    const saved = localStorage.getItem(SAVED_SITE);
    if (!saved || saved === ALL_SITES) return ALL_SITES;
    return Number(saved);
  } catch {
    return ALL_SITES;
  }
}

const SAVED_RANGE = "foyer-range";

// { preset: "this-month" } or { from, to }
function savedRange() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_RANGE));
    if (saved?.preset || (saved?.from && saved?.to)) return saved;
  } catch {
    // nothing saved, or not readable
  }
  return { preset: "this-month" };
}

const SAVED_SESSION = "foyer-demo-session";

function savedSession() {
  try {
    return Number(localStorage.getItem(SAVED_SESSION)) || null;
  } catch {
    return null;
  }
}

// A made-up MAC address for this browser, so trying the guest page twice
// counts as the same device coming back (like a real phone would)
function demoDeviceMac() {
  const make = () =>
    Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(),
    ).join(":");
  try {
    let mac = localStorage.getItem("foyer-demo-device");
    if (!mac) {
      mac = make();
      localStorage.setItem("foyer-demo-device", mac);
    }
    return mac;
  } catch {
    return make();
  }
}

// "k7qm 3rxa" and "K7QM-3RXA" are the same code
const cleanCode = (code) => String(code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();

const remember = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing: it just isn't remembered
  }
};

const nextId = (list) => Math.max(0, ...list.map((item) => item.id)) + 1;

export default function DataProvider({ children }) {
  const [admins, setAdmins] = useState(STARTING_ADMINS);
  const [adminId, setAdminId] = useState(savedSession);
  const [controllers, setControllers] = useState(STARTING_CONTROLLERS);
  const [sites, setSites] = useState(STARTING_SITES);
  const [vouchers, setVouchers] = useState(STARTING_VOUCHERS);
  const [guests, setGuests] = useState(STARTING_GUESTS);
  const [connections, setConnections] = useState(STARTING_CONNECTIONS);
  const [siteId, setSiteId] = useState(savedSiteId);
  const [range, setRangeState] = useState(savedRange);

  // The signed-in admin, or null
  const currentAdmin = admins.find((a) => a.id === adminId) ?? null;

  // The picked site, or null for "All sites" (also if the saved site
  // was removed)
  const currentSite = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId],
  );

  function pickSite(id) {
    setSiteId(id);
    remember(SAVED_SITE, String(id));
  }

  function setRange(value) {
    setRangeState(value);
    remember(SAVED_RANGE, JSON.stringify(value));
  }

  // ---------- Signing in and admins ----------

  // Returns "" when it worked, or what's wrong
  function signIn(email, password) {
    const admin = admins.find(
      (a) => a.email === email.trim().toLowerCase() && a.password === password,
    );
    if (!admin) return "That email or password is wrong.";
    setAdminId(admin.id);
    remember(SAVED_SESSION, String(admin.id));
    updateAdmin(admin.id, { lastActiveAt: Date.now() });
    return "";
  }

  function signOut() {
    setAdminId(null);
    remember(SAVED_SESSION, null);
  }

  function addAdmin(values) {
    const id = nextId(admins);
    setAdmins((list) => [
      ...list,
      { ...values, id, createdAt: Date.now(), lastActiveAt: null },
    ]);
  }

  function updateAdmin(id, changes) {
    setAdmins((list) =>
      list.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    );
  }

  function removeAdmin(id) {
    setAdmins((list) => list.filter((a) => a.id !== id));
  }

  // ---------- Controllers ----------

  function addController(values) {
    const id = nextId(controllers);
    setControllers((list) => [...list, { ...values, id, lastTest: null }]);
  }

  function updateController(id, changes) {
    setControllers((list) =>
      list.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    );
  }

  function deleteController(id) {
    setControllers((list) => list.filter((c) => c.id !== id));
  }

  // ---------- Sites ----------

  // values: { name, controllerId, mode }. Returns the new site.
  function addSite(values) {
    const id = nextId(sites);
    const site = makeSite({
      ...values,
      id,
      slug: makeSlug(
        values.name,
        sites.map((s) => s.slug),
      ),
      color: SITE_COLORS[sites.length % SITE_COLORS.length],
    });
    setSites((list) => [...list, site]);
    return site;
  }

  function updateSite(id, changes) {
    setSites((list) =>
      list.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    );
  }

  function deleteSite(id) {
    setSites((list) => list.filter((s) => s.id !== id));
    setVouchers((list) => list.filter((v) => v.siteId !== id));
    setGuests((list) => list.filter((g) => g.siteId !== id));
    setConnections((list) => list.filter((c) => c.siteId !== id));
  }

  // ---------- Vouchers ----------

  // values: { siteId, count, batch, minutes, maxUses, downKbps, upKbps,
  // dataMb, validUntil }. Returns the new vouchers.
  function addVouchers({ count, ...values }) {
    const taken = new Set(
      vouchers.filter((v) => v.siteId === values.siteId).map((v) => v.code),
    );
    let id = nextId(vouchers);
    const createdAt = Date.now();
    const made = makeCodes(count, taken).map((code) => ({
      ...values,
      id: id++,
      code,
      uses: 0,
      createdAt,
    }));
    setVouchers((list) => [...made, ...list]);
    return made;
  }

  function deleteVouchers(ids) {
    const gone = new Set(ids);
    setVouchers((list) => list.filter((v) => !gone.has(v.id)));
  }

  // ---------- Guests ----------

  // Removes a guest and everything they typed (e.g. when they ask to be
  // forgotten). Their sign-ins still count in the reports, without them.
  function deleteGuest(id) {
    setGuests((list) => list.filter((g) => g.id !== id));
    setConnections((list) =>
      list.map((c) => (c.guestId === id ? { ...c, guestId: null } : c)),
    );
  }

  // ---------- A guest signing in on a site's page ----------
  // FOR NOW (no server yet): checks the voucher and saves the guest and
  // their sign-in here. The server will also let them on through the
  // site's controller. Returns { error } or { minutes }.
  function recordSignIn(site, { answers = {}, code = "" }) {
    const now = Date.now();
    let voucher = null;
    if (site.mode === "voucher") {
      voucher = vouchers.find(
        (v) => v.siteId === site.id && cleanCode(v.code) === cleanCode(code),
      );
      if (!voucher) return { error: "That code isn't right. Check it and try again." };
      const status = voucherStatus(voucher, now);
      if (status === "used") return { error: "That code has already been used." };
      if (status === "expired") return { error: "That code has expired." };
    }

    const mac = demoDeviceMac();
    const existing = guests.find((g) => g.siteId === site.id && g.mac === mac);
    const guestId = existing?.id ?? nextId(guests);
    if (existing) {
      setGuests((list) =>
        list.map((g) =>
          g.id === existing.id
            ? {
                ...g,
                answers: { ...g.answers, ...answers },
                visits: g.visits + 1,
                lastSeenAt: now,
              }
            : g,
        ),
      );
    } else {
      setGuests((list) => [
        ...list,
        { id: guestId, siteId: site.id, mac, answers, visits: 1, firstSeenAt: now, lastSeenAt: now },
      ]);
    }

    const minutes = voucher?.minutes ?? site.minutes;
    if (voucher)
      setVouchers((list) =>
        list.map((v) => (v.id === voucher.id ? { ...v, uses: v.uses + 1 } : v)),
      );
    setConnections((list) => [
      ...list,
      {
        id: nextId(list),
        siteId: site.id,
        guestId,
        mac,
        method: site.mode,
        minutes,
        ok: true,
        at: now,
      },
    ]);
    return { minutes };
  }

  const value = {
    admins,
    currentAdmin,
    signIn,
    signOut,
    addAdmin,
    updateAdmin,
    removeAdmin,
    recordSignIn,
    controllers,
    sites,
    vouchers,
    guests,
    connections,
    currentSite,
    pickSite,
    range,
    setRange,
    addController,
    updateController,
    deleteController,
    addSite,
    updateSite,
    deleteSite,
    addVouchers,
    deleteVouchers,
    deleteGuest,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}