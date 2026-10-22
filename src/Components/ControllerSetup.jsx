// Site settings → Details → Controller: which controller this site's
// guests are let on through, and setting the controller up for Foyer.
//
// UniFi (like Spotipo): Connect → choose the UniFi site (in a box with a
// search) → pick the Wi-Fi network → "Set up on UniFi". Foyer then turns
// on the guest portal with External portal server (your Linode), adds
// the pre-authorization access and turns the guest portal on for that
// Wi-Fi network.
//
// Omada: the Hotspot Operator account can't change settings, so it's
// done by hand in Omada, with the steps and addresses shown here.
import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Lock,
  PlugZap,
  RefreshCw,
  Search,
  Wifi,
} from "lucide-react";
import useData from "../useData";
import { api } from "../api";
import { CONTROLLER_KINDS, timeAgo } from "../data";
import CopyBox from "./CopyBox";
import Modal from "./Modal";
import { hintClass, inputClass, labelClass, primaryButton, secondaryButton } from "./formStyles";

function Step({ n, title, done, children }) {
  return (
    <div className="flex gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-brand/10 text-brand"
        }`}
      >
        {done ? <CircleCheck size={16} /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

function Choice({ selected, onClick, title, detail, badges = [] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        selected ? "border-brand bg-brand/5 ring-[3px] ring-brand/10" : "border-line hover:border-brand/40"
      }`}
    >
      <span
        className={`h-4 w-4 shrink-0 rounded-full border-2 ${
          selected ? "border-brand bg-brand shadow-[inset_0_0_0_2px_white]" : "border-line"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
      </span>
      {badges.map((b) => (
        <span key={b} className="shrink-0 rounded-full bg-page px-2 py-0.5 text-xs text-muted">
          {b}
        </span>
      ))}
    </button>
  );
}

// The box for choosing one of the controller's UniFi sites: search,
// pick one, "Choose this site"
function SitePicker({ sites, current, onChoose, onClose }) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(current);
  const q = search.trim().toLowerCase();
  const shown = sites.filter(
    (s) => s.name.toLowerCase().includes(q) || s.key.toLowerCase().includes(q),
  );
  return (
    <Modal
      title="Choose the UniFi site"
      onClose={onClose}
      onSubmit={() => picked && onChoose(picked)}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={!picked} className={primaryButton}>
            Choose this site
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${sites.length} sites`}
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {shown.map((s) => (
            <Choice
              key={s.key}
              selected={picked === s.key}
              onClick={() => setPicked(s.key)}
              title={s.name}
              detail={s.key}
            />
          ))}
          {shown.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No site called “{search}”</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

const Problem = ({ text }) =>
  text ? (
    <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <CircleAlert size={16} className="mt-0.5 shrink-0" />
      {text}
    </p>
  ) : null;

function ManualUnifi({ draft, set }) {
  const origin = window.location.origin;
  return (
    <details className="rounded-lg border border-line px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-muted">Set it up by hand instead</summary>
      <div className="mt-3 space-y-3">
        <div>
          <label className={labelClass} htmlFor="site-key">
            UniFi site name
          </label>
          <input
            id="site-key"
            value={draft.siteKey}
            onChange={(e) => set({ siteKey: e.target.value.trim() })}
            autoCapitalize="none"
            autoCorrect="off"
            className={`${inputClass} font-mono`}
          />
          <p className={hintClass}>
            "default" for the first site, otherwise the short code in the
            controller's address bar: /manage/<b>abc123de</b>/dashboard.
          </p>
        </div>
        <p className="text-muted">
          In UniFi: <b>Hotspot / Guest portal</b> on, authentication{" "}
          <b>External portal server</b> set to your Linode's IP address, and
          the Linode's IP in <b>Pre-authorization access</b>. Then turn on the
          guest portal on the Wi-Fi network. The Linode's nginx sends guests
          on to:
        </p>
        <CopyBox text={`${origin}/guest/s/${draft.siteKey || "default"}/`} />
      </div>
    </details>
  );
}

function UnifiSetup({ site, draft, set, controller }) {
  const { setUpUnifi } = useData();
  const [changing, setChanging] = useState(false);
  const [unifiSites, setUnifiSites] = useState(null);
  const [wlans, setWlans] = useState(null);
  const [wlanId, setWlanId] = useState(null);
  const [siteKey, setSiteKey] = useState(null); // the UniFi site chosen
  const [choosing, setChoosing] = useState(false); // the site box is open
  const [portalIp, setPortalIp] = useState(draft.unifi?.portalIp ?? "");
  const [busy, setBusy] = useState(""); // "sites", "wlans", "setup"
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const setUp = draft.unifi?.setupAt && site.controllerId === controller.id && !changing;

  async function load(what, path, then) {
    setBusy(what);
    setError("");
    try {
      then(await api(path));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const connect = () => {
    setWlans(null);
    setWlanId(null);
    setDone(null);
    load("sites", `/controllers/${controller.id}/sites`, (list) => {
      setUnifiSites(list);
      // Only one site: no need to choose
      if (list.length === 1) pickSite(list[0].key);
      else setChoosing(true);
    });
  };

  function pickSite(key) {
    setChoosing(false);
    setSiteKey(key);
    setWlanId(null);
    setDone(null);
    load("wlans", `/controllers/${controller.id}/sites/${encodeURIComponent(key)}/wlans`, (list) => {
      setWlans(list);
      const guest = list.filter((w) => w.guestPortal);
      if (guest.length === 1) setWlanId(guest[0].id);
    });
  }

  async function run() {
    setBusy("setup");
    setError("");
    const chosen = unifiSites.find((s) => s.key === siteKey);
    const wlan = wlans.find((w) => w.id === wlanId);
    const result = await setUpUnifi(site.id, {
      controllerId: controller.id,
      siteKey,
      siteName: chosen?.name,
      wlanId,
      wlanName: wlan?.name,
      portalIp: portalIp.trim(),
    });
    setBusy("");
    if (result.error) return setError(result.error);
    // The site is saved with these already, so they don't count as unsaved
    set({
      controllerId: result.site.controllerId,
      siteKey: result.site.siteKey,
      unifi: result.site.unifi,
    });
    setDone(result.done);
    setChanging(false);
  }

  if (setUp)
    return (
      <div className="space-y-3">
        <div className="flex gap-3 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Set up on UniFi · {timeAgo(draft.unifi.setupAt)}</p>
            <p>
              UniFi site <b>{draft.unifi.siteName}</b> ({draft.siteKey}) · Wi-Fi{" "}
              <b>{draft.unifi.wlanName || "network"}</b>
            </p>
            <p className="text-emerald-800 opacity-80">
              External portal server {draft.unifi.portalIp} · pre-authorization{" "}
              {(draft.unifi.allowHosts ?? []).join(", ")}
            </p>
          </div>
        </div>
        {done && (
          <ul className="space-y-1 text-sm text-muted">
            {done.map((d) => (
              <li key={d} className="flex gap-2">
                <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                {d}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">
          Join that Wi-Fi on a phone: this site's sign-in page should open.
        </p>
        <button
          type="button"
          onClick={() => {
            setChanging(true);
            connect();
          }}
          className={secondaryButton}
        >
          <RefreshCw size={16} />
          Change site or Wi-Fi
        </button>
      </div>
    );

  return (
    <div className="space-y-5">
      <Step n={1} title="Connect to the controller" done={Boolean(unifiSites)}>
        {!unifiSites && (
          <button type="button" onClick={connect} disabled={busy === "sites"} className={primaryButton}>
            {busy === "sites" ? <LoaderCircle size={18} className="animate-spin" /> : <PlugZap size={18} />}
            {busy === "sites" ? "Connecting…" : `Connect to ${controller.name}`}
          </button>
        )}
      </Step>

      {unifiSites && (
        <Step n={2} title="Choose the UniFi site" done={Boolean(siteKey)}>
          {siteKey ? (
            <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {unifiSites.find((s) => s.key === siteKey)?.name ?? siteKey}
                </p>
                <p className="truncate text-xs text-muted">{siteKey}</p>
              </div>
              {unifiSites.length > 1 && (
                <button type="button" onClick={() => setChoosing(true)} className={secondaryButton}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setChoosing(true)} className={secondaryButton}>
              <Search size={16} />
              Choose site
            </button>
          )}
          {choosing && (
            <SitePicker
              sites={unifiSites}
              current={siteKey}
              onChoose={pickSite}
              onClose={() => setChoosing(false)}
            />
          )}
        </Step>
      )}

      {(wlans || busy === "wlans") && (
        <Step n={3} title="Pick the guest Wi-Fi network" done={Boolean(wlanId)}>
          {busy === "wlans" ? (
            <LoaderCircle size={20} className="animate-spin text-muted" />
          ) : wlans.length === 0 ? (
            <p className="text-sm text-muted">
              That UniFi site has no Wi-Fi networks yet. Make the guest network
              in UniFi first, then connect again.
            </p>
          ) : (
            <div className="space-y-2">
              {wlans.map((w) => (
                <Choice
                  key={w.id}
                  selected={wlanId === w.id}
                  onClick={() => setWlanId(w.id)}
                  title={w.name}
                  detail={w.security === "Open" ? "Open (no password)" : `Password · ${w.security}`}
                  badges={[
                    ...(w.guestPortal ? ["Guest portal on"] : []),
                    ...(w.enabled ? [] : ["Turned off"]),
                  ]}
                />
              ))}
            </div>
          )}
        </Step>
      )}

      {wlanId && (
        <Step n={4} title="Set up on UniFi">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>
              Guest portal on, with authentication <b>External portal server</b>{" "}
              pointing at your Linode
            </li>
            <li>Your Linode and Foyer added to <b>Pre-authorization access</b></li>
            <li>
              Guest portal turned on for{" "}
              <b>{wlans.find((w) => w.id === wlanId)?.name}</b>
            </li>
          </ul>
          <p className="text-xs text-muted">
            The guest portal settings are shared by the whole UniFi site, so
            any other Wi-Fi there with the guest portal on uses Foyer too.
          </p>
          <div>
            <label className={labelClass} htmlFor="portal-ip">
              Portal server IP (your Linode)
            </label>
            <input
              id="portal-ip"
              value={portalIp}
              onChange={(e) => setPortalIp(e.target.value)}
              placeholder="Leave empty to use the controller's IP"
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
            <p className={hintClass}>
              The public IPv4 address whose nginx sends guests on to Foyer. Usually
              the same server as the controller, so it can stay empty.
            </p>
          </div>
          <button type="button" onClick={run} disabled={busy === "setup"} className={primaryButton}>
            {busy === "setup" ? <LoaderCircle size={18} className="animate-spin" /> : <Wifi size={18} />}
            {busy === "setup" ? "Setting up…" : "Set up on UniFi"}
          </button>
        </Step>
      )}

      <Problem text={error} />
      {changing && (
        <button type="button" onClick={() => setChanging(false)} className="text-sm font-medium text-muted hover:text-ink">
          Cancel
        </button>
      )}
      <ManualUnifi draft={draft} set={set} />
    </div>
  );
}

function OmadaGuide({ site, draft, controller }) {
  const { testController } = useData();
  const [testing, setTesting] = useState(false);
  const origin = window.location.origin;
  const test = controller.lastTest;

  async function runTest() {
    setTesting(true);
    await testController(controller.id);
    setTesting(false);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Omada's Hotspot Operator account can't change settings, so set the
        portal up in Omada with these steps. Open the site in Omada first.
      </p>

      <Step n={1} title="A Hotspot Operator for Foyer" done={test?.ok}>
        <p className="text-sm text-muted">
          <b>Hotspot Manager → Operators → Add</b>, with this site ticked. Its
          name and password go on the controller in Foyer (switch to All
          sites → Controllers).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={runTest} disabled={testing} className={secondaryButton}>
            {testing ? <LoaderCircle size={16} className="animate-spin" /> : <PlugZap size={16} />}
            Test connection
          </button>
          {test && (
            <span className={`text-sm ${test.ok ? "text-emerald-700" : "text-red-700"}`}>
              {test.ok ? "Connected" : "Couldn't connect"} · {timeAgo(test.at)}
            </span>
          )}
        </div>
        {test && !test.ok && <Problem text={test.message} />}
      </Step>

      <Step n={2} title="The portal">
        <p className="text-sm text-muted">
          <b>Site Settings → Authentication → Portal → Create New Portal</b>:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Portal name: anything, e.g. <b>Foyer</b></li>
          <li>SSID &amp; Network: tick the guest Wi-Fi</li>
          <li>
            Authentication Type: <b>External Portal Server</b>
          </li>
          <li>Custom Portal Server URL:</li>
        </ul>
        <CopyBox text={`${origin}/omada/${draft.slug}`} />
        {draft.slug !== site.slug && (
          <p className="flex gap-2 text-xs text-amber-700">
            <Lock size={14} className="mt-0.5 shrink-0" />
            Save your changes first: the address name changed.
          </p>
        )}
      </Step>

      <Step n={3} title="Let phones reach the sign-in page">
        <p className="text-sm text-muted">
          <b>Site Settings → Authentication → Portal → Access Control</b>, turn on{" "}
          <b>Pre-Authentication Access</b> and add Foyer's address:
        </p>
        <CopyBox text={window.location.hostname} />
      </Step>

      <Step n={4} title="Try it">
        <p className="text-sm text-muted">
          Join the guest Wi-Fi on a phone: this site's sign-in page should
          open.
        </p>
      </Step>
    </div>
  );
}

export default function ControllerSetup({ site, draft, set }) {
  const { controllers } = useData();
  const controller = controllers.find((c) => c.id === draft.controllerId);
  return (
    <>
      <div>
        <label className={labelClass} htmlFor="site-controller">
          Controller
        </label>
        <select
          id="site-controller"
          value={draft.controllerId ?? ""}
          onChange={(e) => set({ controllerId: Number(e.target.value) || null })}
          className={inputClass}
        >
          <option value="">Pick a controller</option>
          {controllers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({CONTROLLER_KINDS[c.kind].label})
            </option>
          ))}
        </select>
        {controllers.length === 0 && (
          <p className={hintClass}>
            No controllers yet. Switch to All sites → Controllers to add one.
          </p>
        )}
      </div>
      {controller?.kind === "unifi" && (
        <UnifiSetup key={controller.id} site={site} draft={draft} set={set} controller={controller} />
      )}
      {controller?.kind === "omada" && (
        <OmadaGuide key={controller.id} site={site} draft={draft} controller={controller} />
      )}
    </>
  );
}
