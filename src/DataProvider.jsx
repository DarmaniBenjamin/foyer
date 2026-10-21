// Holds the data every page shares: the controllers, the sites, the
// vouchers, the guests and their sign-ins (connections), and which site
// you're looking at (or "All sites").
//
// The site you pick is remembered on this browser, so it's still picked
// after a reload.
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
import { STARTING_VOUCHERS, makeCodes } from "./vouchers";
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

const nextId = (list) => Math.max(0, ...list.map((item) => item.id)) + 1;

export default function DataProvider({ children }) {
  const [controllers, setControllers] = useState(STARTING_CONTROLLERS);
  const [sites, setSites] = useState(STARTING_SITES);
  const [vouchers, setVouchers] = useState(STARTING_VOUCHERS);
  const [guests, setGuests] = useState(STARTING_GUESTS);
  const [connections, setConnections] = useState(STARTING_CONNECTIONS);
  const [siteId, setSiteId] = useState(savedSiteId);

  // The picked site, or null for "All sites" (also if the saved site
  // was removed)
  const currentSite = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId],
  );

  function pickSite(id) {
    setSiteId(id);
    try {
      localStorage.setItem(SAVED_SITE, String(id));
    } catch {
      // Private browsing: it just isn't remembered
    }
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

  const value = {
    controllers,
    sites,
    vouchers,
    guests,
    connections,
    currentSite,
    pickSite,
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