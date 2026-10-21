// Holds the data every page shares: the controllers, the sites, and
// which site you're looking at (or "All sites").
//
// The site you pick is remembered on this browser, so it's still picked
// after a reload.
import { useMemo, useState } from "react";
import { DataContext } from "./useData";
import {
  ALL_SITES,
  STARTING_CONTROLLERS,
  STARTING_SITES,
} from "./data";

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

export default function DataProvider({ children }) {
  const [controllers, setControllers] = useState(STARTING_CONTROLLERS);
  const [sites] = useState(STARTING_SITES);
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
    const id = Math.max(0, ...controllers.map((c) => c.id)) + 1;
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

  const value = {
    controllers,
    sites,
    currentSite,
    pickSite,
    addController,
    updateController,
    deleteController,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}