// Maintenance (admins only):
// - Maintenance mode: while you work on a site's Wi-Fi, show guests a
//   "Wi-Fi under maintenance" page, or let them straight on without the
//   sign-in page. Whitelisted devices always get on.
// - System health: the server, the database and the controllers.
// - Clean-up: delete guest data older than a number of months.
// - Backup: everything in the database as one file.
import { useCallback, useEffect, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Database,
  Download,
  HardDrive,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  Server,
  Trash2,
  Wrench,
} from "lucide-react";
import useData from "../../useData";
import { api } from "../../api";
import { timeAgo } from "../../data";
import SiteIcon from "../SiteIcon";
import Modal from "../Modal";
import { dangerButton, labelClass, secondaryButton } from "../formStyles";

const MODES = [
  ["off", "Normal", "The sign-in page as usual"],
  ["notice", "Maintenance page", "Guests see your message and can't sign in"],
  ["open", "Let guests on", "Everyone gets on without the sign-in page"],
];

const DEFAULT_MESSAGE = "We're working on the Wi-Fi. Please try again a little later.";

const day = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const megabytes = (bytes) =>
  bytes > 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;

function Card({ icon, title, hint, action, children }) {
  const Icon = icon;
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ModePicker({ value, onPick, busy }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-line p-1">
      {MODES.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          disabled={busy}
          onClick={() => onPick(mode)}
          className={`h-9 rounded-lg px-2 text-xs font-semibold transition disabled:opacity-60 ${
            value === mode
              ? mode === "off"
                ? "bg-brand/10 text-brand"
                : "bg-amber-50 text-amber-700"
              : "text-muted hover:bg-brand/5 hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MaintenanceMode() {
  const { sites, setMaintenance } = useData();
  const [message, setMessage] = useState(
    () => sites.find((s) => s.maintenance?.message)?.maintenance.message ?? DEFAULT_MESSAGE,
  );
  const [busy, setBusy] = useState(null); // a site id, "all", or null
  const [error, setError] = useState("");
  const modeOf = (site) => site.maintenance?.mode ?? "off";
  const allSame = sites.length && sites.every((s) => modeOf(s) === modeOf(sites[0]));

  async function pick(siteIds, mode) {
    setBusy(siteIds === "all" ? "all" : siteIds[0]);
    setError(await setMaintenance(siteIds, mode, message.trim()));
    setBusy(null);
  }

  const inMaintenance = sites.filter((s) => modeOf(s) !== "off").length;

  return (
    <Card
      icon={Wrench}
      title="Maintenance mode"
      hint="While you work on a site's Wi-Fi. Whitelisted devices (TVs, FireSticks) always get on."
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map(([mode, label, detail]) => (
          <div key={mode} className="rounded-xl bg-page px-3 py-2">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted">{detail}</p>
          </div>
        ))}
      </div>

      <div>
        <label className={labelClass} htmlFor="m-message">
          Message on the maintenance page
        </label>
        <textarea
          id="m-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={500}
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm"
        />
        <p className="mt-1 text-xs text-muted">
          Used when you next switch a site to Maintenance page.
        </p>
      </div>

      <div className="divide-y divide-line rounded-xl border border-line">
        <div className="flex flex-col gap-2 bg-page/60 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">All sites</p>
            <p className="text-xs text-muted">
              {inMaintenance
                ? `${inMaintenance} of ${sites.length} in maintenance`
                : "All working as usual"}
            </p>
          </div>
          <div className="sm:w-96">
            <ModePicker
              value={allSame ? modeOf(sites[0]) : null}
              busy={busy !== null}
              onPick={(mode) => pick("all", mode)}
            />
          </div>
        </div>
        {sites.map((site) => (
          <div key={site.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SiteIcon site={site} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{site.name}</p>
                {modeOf(site) !== "off" && site.maintenance?.since && (
                  <p className="text-xs text-amber-700">Since {timeAgo(site.maintenance.since)}</p>
                )}
              </div>
              {busy === site.id && <LoaderCircle size={16} className="animate-spin text-muted" />}
            </div>
            <div className="sm:w-96">
              <ModePicker
                value={modeOf(site)}
                busy={busy !== null}
                onPick={(mode) => pick([site.id], mode)}
              />
            </div>
          </div>
        ))}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Card>
  );
}

function Status({ ok, children }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${ok ? "text-emerald-800" : "text-red-700"}`}>
      <Icon size={16} />
      {children}
    </span>
  );
}

function SystemHealth() {
  const { testController } = useData();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      setHealth(await api("/maintenance/health"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testAll() {
    setTesting(true);
    for (const c of health?.controllers ?? []) await testController(c.id);
    await load();
    setTesting(false);
  }

  const refresh = (
    <button
      type="button"
      onClick={load}
      className="rounded-lg p-2 text-muted transition hover:bg-page hover:text-brand"
      aria-label="Check again"
      title="Check again"
    >
      <RefreshCw size={18} />
    </button>
  );

  return (
    <Card icon={Server} title="System health" action={refresh}>
      {error ? (
        <Status ok={false}>{error}</Status>
      ) : !health ? (
        <LoaderCircle size={20} className="animate-spin text-muted" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <p className="mb-1 flex items-center gap-2 text-sm text-muted">
                <Server size={16} /> Server
              </p>
              <Status ok>Running</Status>
              <p className="mt-1 text-xs text-muted">
                Started {timeAgo(health.server.startedAt)} · Node {health.server.node} ·{" "}
                {health.server.memoryMb} MB memory
              </p>
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="mb-1 flex items-center gap-2 text-sm text-muted">
                <Database size={16} /> Database
              </p>
              <Status ok>Answered in {health.database.answeredInMs} ms</Status>
              <p className="mt-1 text-xs text-muted">
                {health.database.version} · {megabytes(health.database.sizeBytes)} · tables in “
                {health.database.area}”
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ["Sites", health.counts.sites],
              ["Guests", health.counts.guests],
              ["Sign-ins", health.counts.connections],
              ["Vouchers", health.counts.vouchers],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl bg-page px-3 py-2">
                <p className="text-xs text-muted">{label}</p>
                <p className="font-semibold">{n.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Controllers</p>
              <button
                type="button"
                onClick={testAll}
                disabled={testing || !health.controllers.length}
                className={`${secondaryButton} h-9`}
              >
                {testing ? <LoaderCircle size={16} className="animate-spin" /> : <PlugZap size={16} />}
                Test all
              </button>
            </div>
            {health.controllers.length === 0 ? (
              <p className="text-sm text-muted">No controllers yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {health.controllers.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    {c.lastTest ? (
                      <span className="text-xs text-muted sm:text-right">
                        <Status ok={c.lastTest.ok}>
                          {c.lastTest.ok ? "Connected" : "Couldn't connect"} ·{" "}
                          {timeAgo(c.lastTest.at)}
                        </Status>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Not tested yet</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function CleanUp() {
  const { reload } = useData();
  const [months, setMonths] = useState(24);
  const [found, setFound] = useState(null); // { connections, guests, before }
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");

  async function run(check) {
    setBusy(true);
    setError("");
    try {
      const result = await api("/maintenance/cleanup", {
        method: "POST",
        body: { months, check },
      });
      if (check) setFound(result);
      else {
        setDone(result);
        setFound(null);
        reload();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const nothing = found && found.connections === 0 && found.guests === 0;

  return (
    <Card
      icon={HardDrive}
      title="Clean up old guest data"
      hint="Deletes sign-ins older than this, and guests not seen since then with what they typed. Reports for those months will be empty."
    >
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className={labelClass} htmlFor="m-months">
            Keep the last
          </label>
          <select
            id="m-months"
            value={months}
            onChange={(e) => {
              setMonths(Number(e.target.value));
              setFound(null);
              setDone(null);
            }}
            className="h-11 rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-brand sm:text-sm"
          >
            {[6, 12, 24, 36, 60].map((n) => (
              <option key={n} value={n}>
                {n} months
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => run(true)} disabled={busy} className={secondaryButton}>
          {busy && !confirming ? <LoaderCircle size={16} className="animate-spin" /> : null}
          Check what would go
        </button>
      </div>

      {found && (
        <div className="flex flex-col gap-3 rounded-xl bg-page p-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            {nothing
              ? `Nothing older than ${day(found.before)}.`
              : `${found.connections.toLocaleString()} sign-ins and ${found.guests.toLocaleString()} guests from before ${day(found.before)}.`}
          </p>
          {!nothing && (
            <button type="button" onClick={() => setConfirming(true)} className={dangerButton}>
              <Trash2 size={16} />
              Delete them
            </button>
          )}
        </div>
      )}
      {done && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Deleted {done.connections.toLocaleString()} sign-ins and{" "}
          {done.guests.toLocaleString()} guests from before {day(done.before)}.
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {confirming && (
        <Modal
          title="Delete old guest data?"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" onClick={() => setConfirming(false)} className={secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={() => run(false)} disabled={busy} className={dangerButton}>
                {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">
            This can't be undone. Download a backup first if you might need
            them.
          </p>
        </Modal>
      )}
    </Card>
  );
}

function Backup() {
  return (
    <Card
      icon={Download}
      title="Backup"
      hint="Everything in Foyer as one file: sites, guests, sign-ins, vouchers, users and controllers. Passwords stay scrambled. Keep it somewhere safe: it has guests' details in it."
    >
      <a href="/api/maintenance/backup" className={`${secondaryButton} w-full sm:w-auto`}>
        <Download size={16} />
        Download backup
      </a>
    </Card>
  );
}

export default function Maintenance() {
  return (
    <div className="space-y-5">
      <MaintenanceMode />
      <div className="grid gap-5 xl:grid-cols-2">
        <SystemHealth />
        <div className="space-y-5">
          <CleanUp />
          <Backup />
        </div>
      </div>
    </div>
  );
}
