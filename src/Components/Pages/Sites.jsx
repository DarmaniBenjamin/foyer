// Sites: every client site with a guest Wi-Fi portal. Click one to set
// up its sign-in page; the site you picked in the site switcher is
// marked "Selected".
import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Plus, Search } from "lucide-react";
import useData from "../../useData";
import { CONTROLLER_KINDS, SIGN_IN_MODES, formatMinutes } from "../../data";
import SiteIcon from "../SiteIcon";
import NewSiteModal from "../NewSiteModal";
import { primaryButton } from "../formStyles";

function SiteCard({ site, controller, selected, onOpen }) {
  const details = [
    SIGN_IN_MODES[site.mode].label,
    site.mode === "form" &&
      `${site.fields.length} question${site.fields.length === 1 ? "" : "s"}`,
    formatMinutes(site.minutes),
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md ${
        selected ? "border-brand/50 ring-4 ring-brand/10" : "border-line"
      }`}
    >
      <SiteIcon site={site} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold group-hover:text-brand">{site.name}</h3>
          {selected && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              Selected
            </span>
          )}
          {!site.active && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Portal off
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted">
          {controller
            ? `${controller.name} · ${CONTROLLER_KINDS[controller.kind].label}`
            : "No controller"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {details.map((d) => (
            <span
              key={d}
              className="rounded-full bg-page px-2 py-0.5 text-xs font-medium text-muted"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight
        size={20}
        className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand"
      />
    </button>
  );
}

export default function Sites() {
  const { sites, controllers, currentSite, addSite, pickSite } = useData();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  function open(site) {
    pickSite(site.id);
    navigate(`/sites/${site.id}`);
  }

  function create(values) {
    const site = addSite(values);
    setAdding(false);
    open(site);
  }

  const shown = sites.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

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

      {sites.length > 6 && (
        <div className="relative max-w-sm">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a site"
            className="h-11 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm"
          />
        </div>
      )}

      {sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="font-medium">No sites yet</p>
          <p className="mt-1 text-sm text-muted">
            Add your first client site to make its sign-in page.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {shown.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              controller={controllers.find((c) => c.id === site.controllerId)}
              selected={currentSite?.id === site.id}
              onOpen={() => open(site)}
            />
          ))}
        </div>
      )}

      {adding && (
        <NewSiteModal onCreate={create} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}