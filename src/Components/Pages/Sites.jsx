// Sites: every client site with a guest Wi-Fi portal, as a list like an
// email inbox: one row per site. Click one to set up its sign-in page;
// the site you picked in the site switcher is marked "Selected".
//   ● green: the portal is on   ○ grey: off   ● red: its controller is offline
//   the number on the right: sign-ins today
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Plus, Search } from "lucide-react";
import useData from "../../useData";
import { SIGN_IN_MODES, formatMinutes } from "../../data";
import { startOfDay } from "../../dates";
import NewSiteModal from "../NewSiteModal";
import { primaryButton } from "../formStyles";

function SiteRow({ site, controller, selected, today, onOpen }) {
  const down = controller?.lastTest?.ok === false;
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
      type="button"
      onClick={onOpen}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand/5 sm:gap-4 ${
        selected ? "bg-brand/5" : ""
      }`}
    >
      <span title={state.words} aria-label={state.words} className={`h-2.5 w-2.5 shrink-0 rounded-full ${state.dot}`} />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:w-64 sm:shrink-0">
          <span className={`truncate font-semibold group-hover:text-brand ${site.active ? "" : "text-muted"}`}>
            {site.name}
          </span>
          {selected && (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              Selected
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted">{details.join(" · ")}</p>
      </div>
      <span
        title="Sign-ins today"
        className={`shrink-0 text-right text-sm tabular-nums ${today ? "font-semibold text-ink" : "text-muted"}`}
      >
        {today.toLocaleString()}
        <span className="hidden font-normal text-muted lg:inline"> today</span>
      </span>
      <ChevronRight
        size={18}
        className="hidden shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand sm:block"
      />
    </button>
  );
}

export default function Sites() {
  const { sites, controllers, connections, currentSite, addSite, pickSite } = useData();
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
  const today = useMemo(() => {
    const from = midnight;
    const counts = new Map();
    for (const c of connections) if (c.ok && c.at >= from) counts.set(c.siteId, (counts.get(c.siteId) ?? 0) + 1);
    return counts;
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
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {shown.map((site) => (
            <SiteRow
              key={site.id}
              site={site}
              controller={controllers.find((c) => c.id === site.controllerId)}
              selected={currentSite?.id === site.id}
              today={today.get(site.id) ?? 0}
              onOpen={() => open(site)}
            />
          ))}
          {shown.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">No site called “{search.trim()}”.</p>
          )}
        </div>
      )}

      {adding && (
        <NewSiteModal onCreate={create} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}