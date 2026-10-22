// Holds the data every page shares, loaded from Foyer's server (see
// api.js and server/): who is signed in, the users, the controllers, the
// sites, the vouchers, the device whitelist, the splash ads, the guests
// and their sign-ins (connections). Also which site you're looking at
// (or "All sites") and the date range the Dashboard and Reports show,
// which are remembered on this browser.
//
// Changes are sent to the server. Most show straight away and are saved
// in the background; if the server says no, a message pops up at the
// bottom and the data is loaded again, so the page shows what's really
// saved. Adding something waits for the server (it gives the new id).
//
// The server only sends a client login their own sites and what their
// access allows. can(area, level) says whether the signed-in person may
// see or change an area, so the pages can hide what they can't use.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, RefreshCw, X } from "lucide-react";
import { DataContext } from "./useData";
import { ALL_SITES } from "./data";
import { canAccess } from "./admins";
import { TAB_ID, api } from "./api";

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

const remember = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: it just isn't remembered
  }
};

const EMPTY = {
  users: [],
  controllers: [],
  sites: [],
  vouchers: [],
  whitelist: [],
  ads: [],
  guests: [],
  connections: [],
};

// The message at the bottom when the server said no
function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" role="alert">
      <div className="flex max-w-md items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 shadow-xl ring-1 ring-red-200">
        <CircleAlert size={18} className="mt-0.5 shrink-0" />
        <p className="flex-1">{message}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// "A new version of Foyer is ready", with Reload
function NewVersion() {
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" role="status">
      <div className="pop-in flex max-w-md items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-xl">
        <p className="flex-1">Foyer was updated. Reload to get the new version.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white"
        >
          <RefreshCw size={14} />
          Reload
        </button>
      </div>
    </div>
  );
}

export default function DataProvider({ children }) {
  // "loading" (finding out who is signed in), "ready" or "error"
  const [status, setStatus] = useState("loading");
  const [startError, setStartError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [siteId, setSiteId] = useState(savedSiteId);
  const [range, setRangeState] = useState(savedRange);
  const [problem, setProblem] = useState("");
  const closeProblem = useCallback(() => setProblem(""), []);

  const isClient = currentAdmin?.role === "client";

  // ---------- Loading ----------

  const loadData = useCallback(async () => {
    const loaded = await api("/data");
    setCurrentAdmin(loaded.user);
    setData({ ...EMPTY, ...loaded });
  }, []);

  const start = useCallback(async () => {
    try {
      const me = await api("/auth/me");
      setNeedsSetup(me.needsSetup);
      setCurrentAdmin(me.user);
      if (me.user) await loadData();
      setStatus("ready");
    } catch (err) {
      setStartError(err.message);
      setStatus("error");
    }
  }, [loadData]);

  useEffect(() => {
    start();
  }, [start]);

  // ---------- Live updates (server/live.js) ----------
  // While signed in, a change made anywhere (another tab, another admin,
  // a guest signing in) loads the data again here. A tab in the
  // background waits until it's looked at. A new version of Foyer
  // reloads background tabs, and offers a Reload to the one in front.
  const [newVersion, setNewVersion] = useState(false);
  const signedIn = Boolean(currentAdmin);
  useEffect(() => {
    if (!signedIn || typeof EventSource === "undefined") return;
    const live = new EventSource("/api/live");
    let build = null;
    let timer = null;
    let waiting = false; // a change came while the tab was hidden

    const refresh = () => {
      clearTimeout(timer);
      if (document.hidden) {
        waiting = true;
        return;
      }
      // Several changes close together load once
      timer = setTimeout(() => {
        loadData().catch((err) => {
          if (err.status === 401) {
            setCurrentAdmin(null);
            setData(EMPTY);
          }
        });
      }, 400);
    };

    live.addEventListener("hello", (e) => {
      const said = JSON.parse(e.data);
      if (build === null) build = said.build;
      else {
        // Connected again (Foyer restarted, or the network dropped):
        // something may have changed meanwhile
        if (said.build !== build) {
          if (document.hidden) return window.location.reload();
          setNewVersion(true);
        }
        refresh();
      }
    });
    live.addEventListener("changed", (e) => {
      if (JSON.parse(e.data).from !== TAB_ID) refresh();
    });

    const onShow = () => {
      if (!document.hidden && waiting) {
        waiting = false;
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live.close();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [signedIn, loadData]);

  // Runs a change on the server. If it fails: the message pops up and
  // the data is loaded again (or, signed out elsewhere, the sign-in page
  // shows). Returns the server's answer, or null.
  async function send(path, options) {
    try {
      return await api(path, options);
    } catch (err) {
      if (err.status === 401) {
        setCurrentAdmin(null);
        setData(EMPTY);
        return null;
      }
      setProblem(err.message);
      loadData().catch(() => {});
      return null;
    }
  }

  // Changes one list in the data
  const change = (name, fn) => setData((d) => ({ ...d, [name]: fn(d[name]) }));
  const replace = (name, row) =>
    change(name, (list) => list.map((item) => (item.id === row.id ? row : item)));

  // ---------- Which site, which dates ----------

  // The picked site, or null for "All sites" (also if the saved site
  // was removed, or isn't one of a client's sites)
  const currentSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) ?? null,
    [data.sites, siteId],
  );

  function pickSite(id) {
    setSiteId(id);
    remember(SAVED_SITE, String(id));
  }

  function setRange(value) {
    setRangeState(value);
    remember(SAVED_RANGE, JSON.stringify(value));
  }

  const can = (area, level = "read") => canAccess(currentAdmin, area, level);

  // ---------- Signing in and out ----------

  // Returns "" when it worked, or what's wrong
  async function signIn(email, password) {
    try {
      const { user } = await api("/auth/login", { method: "POST", body: { email, password } });
      setCurrentAdmin(user);
      setStatus("loading");
      await loadData();
      setStatus("ready");
      return "";
    } catch (err) {
      setStatus("ready");
      return err.message;
    }
  }

  // The first admin, from the /setup/<code> page. Returns "" or what's wrong.
  async function setUp(values) {
    try {
      await api("/setup", { method: "POST", body: values });
      setNeedsSetup(false);
      await start();
      return "";
    } catch (err) {
      return err.message;
    }
  }

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setCurrentAdmin(null);
    setData(EMPTY);
  }

  // My account. Both return "" or what's wrong.
  async function updateProfile(values) {
    try {
      const { user } = await api("/auth/me", { method: "PATCH", body: values });
      setCurrentAdmin(user);
      replace("users", user);
      return "";
    } catch (err) {
      return err.message;
    }
  }

  async function changePassword(current, password) {
    try {
      await api("/auth/password", { method: "POST", body: { current, password } });
      return "";
    } catch (err) {
      return err.message;
    }
  }

  // ---------- Users (the Users page) ----------
  // Both return "" or what's wrong, so the box can show it

  async function addAdmin(values) {
    try {
      const user = await api("/users", { method: "POST", body: values });
      change("users", (list) => [...list, user]);
      return "";
    } catch (err) {
      return err.message;
    }
  }

  async function updateAdmin(id, values) {
    try {
      const user = await api(`/users/${id}`, { method: "PATCH", body: values });
      replace("users", user);
      if (user.id === currentAdmin?.id) setCurrentAdmin(user);
      return "";
    } catch (err) {
      return err.message;
    }
  }

  function removeAdmin(id) {
    change("users", (list) => list.filter((u) => u.id !== id));
    send(`/users/${id}`, { method: "DELETE" });
  }

  // ---------- Controllers ----------

  async function addController(values) {
    const row = await send("/controllers", { method: "POST", body: values });
    if (row) change("controllers", (list) => [...list, row]);
  }

  async function updateController(id, changes) {
    change("controllers", (list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    const row = await send(`/controllers/${id}`, { method: "PATCH", body: changes });
    if (row) replace("controllers", row);
  }

  // Test connection: the server signs in to the controller and saves
  // the result on it
  async function testController(id) {
    const row = await send(`/controllers/${id}/test`, { method: "POST" });
    if (row) replace("controllers", row);
  }

  function deleteController(id) {
    change("controllers", (list) => list.filter((c) => c.id !== id));
    change("sites", (list) =>
      list.map((s) => (s.controllerId === id ? { ...s, controllerId: null } : s)),
    );
    send(`/controllers/${id}`, { method: "DELETE" });
  }

  // ---------- Sites ----------

  // values: { name, controllerId, mode }. Returns the new site, or null.
  async function addSite(values) {
    const site = await send("/sites", { method: "POST", body: values });
    if (site) change("sites", (list) => [...list, site]);
    return site;
  }

  // Shows straight away (the editor's "unsaved changes" bar goes), then
  // saves the whole site
  function updateSite(id, changes) {
    const old = data.sites.find((s) => s.id === id);
    if (!old) return;
    const whole = { ...old, ...changes };
    replace("sites", whole);
    send(`/sites/${id}`, { method: "PATCH", body: whole });
  }

  // Maintenance mode (Maintenance page). siteIds: [1, 2] or "all";
  // mode: "off", "notice" or "open". Returns "" or what's wrong.
  async function setMaintenance(siteIds, mode, message) {
    try {
      const changed = await api("/maintenance/mode", {
        method: "PUT",
        body: { siteIds, mode, message },
      });
      const byId = new Map(changed.map((s) => [s.id, s]));
      change("sites", (list) => list.map((s) => byId.get(s.id) ?? s));
      return "";
    } catch (err) {
      return err.message;
    }
  }

  // Site settings → Controller → Set up on UniFi. Returns
  // { site, done: [steps in words] } or { error }.
  async function setUpUnifi(siteId, body) {
    try {
      const result = await api(`/sites/${siteId}/unifi-setup`, { method: "POST", body });
      change("sites", (list) => list.map((s) => (s.id === siteId ? result.site : s)));
      return result;
    } catch (err) {
      return { error: err.message };
    }
  }

  // The same for Omada (with the controller's Open API)
  async function setUpOmada(siteId, body) {
    try {
      const result = await api(`/sites/${siteId}/omada-setup`, { method: "POST", body });
      change("sites", (list) => list.map((s) => (s.id === siteId ? result.site : s)));
      return result;
    } catch (err) {
      return { error: err.message };
    }
  }

  // Site settings → Controller → Undo (kind: "unifi" or "omada").
  // Returns "" or what's wrong.
  async function undoUnifi(siteId, kind = "unifi") {
    try {
      const site = await api(`/sites/${siteId}/${kind}-undo`, { method: "POST" });
      change("sites", (list) => list.map((s) => (s.id === siteId ? site : s)));
      return "";
    } catch (err) {
      return err.message;
    }
  }

  function deleteSite(id) {
    setData((d) => ({
      ...d,
      sites: d.sites.filter((s) => s.id !== id),
      vouchers: d.vouchers.filter((v) => v.siteId !== id),
      whitelist: d.whitelist.filter((w) => w.siteId !== id),
      ads: d.ads.filter((a) => a.siteId !== id),
      guests: d.guests.filter((g) => g.siteId !== id),
      connections: d.connections.filter((c) => c.siteId !== id),
      users: d.users.map((u) => ({ ...u, siteIds: (u.siteIds ?? []).filter((s) => s !== id) })),
    }));
    send(`/sites/${id}`, { method: "DELETE" });
  }

  // ---------- Vouchers ----------

  // values: { siteId, count, batch, minutes, maxUses, downKbps, upKbps,
  // dataMb, validUntil }. Returns the new vouchers, or null.
  async function addVouchers(values) {
    const made = await send("/vouchers", { method: "POST", body: values });
    if (made) change("vouchers", (list) => [...made, ...list]);
    return made;
  }

  function deleteVouchers(ids) {
    const gone = new Set(ids);
    change("vouchers", (list) => list.filter((v) => !gone.has(v.id)));
    send("/vouchers/delete", { method: "POST", body: { ids } });
  }

  // ---------- Device whitelist ----------

  async function addWhitelist(values) {
    const row = await send("/whitelist", { method: "POST", body: values });
    if (row) change("whitelist", (list) => [row, ...list]);
  }

  async function updateWhitelist(id, changes) {
    change("whitelist", (list) => list.map((w) => (w.id === id ? { ...w, ...changes } : w)));
    const row = await send(`/whitelist/${id}`, { method: "PATCH", body: changes });
    if (row) replace("whitelist", row);
  }

  function deleteWhitelist(id) {
    change("whitelist", (list) => list.filter((w) => w.id !== id));
    send(`/whitelist/${id}`, { method: "DELETE" });
  }

  // ---------- Splash ads ----------

  async function addAd(values) {
    const row = await send("/ads", { method: "POST", body: values });
    if (row) change("ads", (list) => [row, ...list]);
  }

  async function updateAd(id, changes) {
    change("ads", (list) => list.map((a) => (a.id === id ? { ...a, ...changes } : a)));
    const row = await send(`/ads/${id}`, { method: "PATCH", body: changes });
    if (row) replace("ads", row);
  }

  function deleteAd(id) {
    change("ads", (list) => list.filter((a) => a.id !== id));
    send(`/ads/${id}`, { method: "DELETE" });
  }

  // ---------- Guests ----------

  // Removes a guest and everything they typed (e.g. when they ask to be
  // forgotten). Their sign-ins still count in the reports, without them.
  function deleteGuest(id) {
    setData((d) => ({
      ...d,
      guests: d.guests.filter((g) => g.id !== id),
      connections: d.connections.map((c) => (c.guestId === id ? { ...c, guestId: null } : c)),
    }));
    send(`/guests/${id}`, { method: "DELETE" });
  }

  const value = {
    status,
    startError,
    retry: () => {
      setStatus("loading");
      start();
    },
    // Loads everything again from the server (e.g. after a clean-up)
    reload: () => loadData().catch(() => {}),
    needsSetup,
    admins: data.users,
    currentAdmin,
    isClient,
    can,
    signIn,
    setUp,
    signOut,
    updateProfile,
    changePassword,
    addAdmin,
    updateAdmin,
    removeAdmin,
    controllers: data.controllers,
    sites: data.sites,
    vouchers: data.vouchers,
    whitelist: data.whitelist,
    ads: data.ads,
    guests: data.guests,
    connections: data.connections,
    currentSite,
    pickSite,
    range,
    setRange,
    addController,
    updateController,
    testController,
    deleteController,
    addSite,
    updateSite,
    setMaintenance,
    setUpUnifi,
    setUpOmada,
    undoUnifi,
    deleteSite,
    addVouchers,
    deleteVouchers,
    addWhitelist,
    updateWhitelist,
    deleteWhitelist,
    addAd,
    updateAd,
    deleteAd,
    deleteGuest,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
      {problem && <Toast message={problem} onClose={closeProblem} />}
      {newVersion && <NewVersion />}
    </DataContext.Provider>
  );
}
