// Sites: every client site with a guest Wi-Fi portal, as a list like an
// email inbox: one row per site. Click one to set up its sign-in page;
// the site you picked in the site switcher is marked "Selected".
//   ● green: the portal is on   ○ grey: off   ● red: its controller is offline
//   on the right: when its last guest signed in (like an email's time)
//   under the name: sign-ins today, then the site's controller and setup
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Plus, Search } from "lucide-react";
import useData from "../../useData";
import { SIGN_IN_MODES, formatMinutes } from "../../data";
import { startOfDay } from "../../dates";
import NewSiteModal from "../NewSiteModal";
import { primaryButton } from "../formStyles";

// When the site's last guest signed in, the way an inbox shows a time:
// "10:42 AM" today, "Yesterday", "Nov 20", or "Nov 20, 2025"
function lastTime(ms, midnight) {
  if (!ms) return "No sign-ins yet";
  const d = new Date(ms);
  if (ms >= midnight) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (ms >= midnight - 86400000) return "Yesterday";
  const sameYear = d.getFullYear() === new Date(midnight).getFullYear();
  return d.toLocaleDateString([], { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function SiteRow({ site, controller, selected, previous, today, last, midnight, onOpen }) {
  const down = controller?.lastTest?.ok === false;
  // The site you were on before "All sites" is brought into view
  const row = useRef(null);
  useEffect(() => {
    if (previous) row.current?.scrollIntoView({ block: "nearest" });
  }, [previous]);
  const details = [
    controller ? controller.name : "No controller",
    SIGN_IN_MODES[site.mode].label,
    site.mode === "form" && `${site.fields.length} question${site.fields.length === 1 ? "" : "s"}`,
    formatMinutes(site.minutes),
  ].filter(Boolean);
  const state = !site.active
    ? { dot: "border-2 border-gray-300 bg-transparent", words: "Portal off" }
    : down
      ? { dot: "bg-red-500", words: `${controller.name} is offline` }
      : { dot: "bg-emerald-500", words: "Portal on" };

  return (
    <button
      ref={row}
      type="button"
      onClick={onOpen}
      className={`group flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left shadow-sm transition hover:-translate-y-px hover:border-brand/30 hover:shadow-md sm:gap-4 ${
        selected || previous ? "border-brand/50 ring-[3px] ring-brand/10" : "border-line"
      }`}
    >
      <span title={state.words} aria-label={state.words} className={`h-2.5 w-2.5 shrink-0 rounded-full ${state.dot}`} />
      <div className="min-w-0 flex-1">
        {/* Like a sender and a time */}
        <div className="flex items-baseline gap-3">
          <span className={`min-w-0 truncate font-semibold group-hover:text-brand ${site.active ? "" : "text-muted"}`}>
            {site.name}
          </span>
          {(selected || previous) && (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              {selected ? "Selected" : "Last opened"}
            </span>
          )}
          <span
            title="Last sign-in"
            className={`ml-auto shrink-0 text-xs tabular-nums ${today ? "font-semibold text-ink" : "text-muted"}`}
          >
            {lastTime(last, midnight)}
          </span>
        </div>
        {/* Like the first line of the message */}
        <p className="mt-0.5 truncate text-sm text-muted">
          {today > 0 && (
            <span className="font-medium text-ink">
              {today.toLocaleString()} sign-in{today === 1 ? "" : "s"} today ·{" "}
            </span>
          )}
          {!site.active && <span className="font-medium">Portal off · </span>}
          {down && site.active && <span className="font-medium text-red-600">Controller offline · </span>}
          {details.join(" · ")}
        </p>
      </div>
      <ChevronRight
        size={18}
        className="hidden shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand sm:block"
      />
    </button>
  );
}

export default function Sites() {
  const { sites, controllers, connections, currentSite, lastSite, addSite, pickSite } = useData();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  function open(site) {
    pickSite(site.id);
    navigate(`/sites/${site.id}`);
  }

  // The box stays open until the server has made the site
  async function create(values) {
    const site = await addSite(values);
    if (!site) return;
    setAdding(false);
    open(site);
  }

  const shown = sites.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  // Sign-ins today, per site (from midnight when the page was opened)
  const [midnight] = useState(() => startOfDay(Date.now()));
  // and when each site's last guest signed in
  const { today, last } = useMemo(() => {
    const counts = new Map();
    const latest = new Map();
    for (const c of connections) {
      if (!c.ok) continue;
      if (c.at >= midnight) counts.set(c.siteId, (counts.get(c.siteId) ?? 0) + 1);
      if (c.at > (latest.get(c.siteId) ?? 0)) latest.set(c.siteId, c.at);
    }
    return { today: counts, last: latest };
  }, [connections, midnight]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Each client site has its own guest Wi-Fi sign-in page, with its own
          logo, colours and questions.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`${primaryButton} shrink-0`}
        >
          <Plus size={18} />
          Add site
        </button>
      </div>

      {sites.length > 0 && (
        <div className="relative max-w-sm">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a site"
            className="h-9 w-full rounded-lg border border-line bg-white pr-3 pl-10 text-base outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15 sm:text-sm"
          />
        </div>
      )}

      {sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="font-medium">No sites yet</p>
          <p className="mt-1 text-sm text-muted">
            Add your first client site to make its sign-in page.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((site) => (
            <SiteRow
              key={site.id}
              site={site}
              controller={controllers.find((c) => c.id === site.controllerId)}
              selected={currentSite?.id === site.id}
              previous={lastSite?.id === site.id}
              today={today.get(site.id) ?? 0}
              last={last.get(site.id)}
              midnight={midnight}
              onOpen={() => open(site)}
            />
          ))}
          {shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              No site called “{search.trim()}”.
            </p>
          )}
        </div>
      )}

      {adding && (
        <NewSiteModal onCreate={create} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}