// The site picker at the bottom of the sidebar, above Sign out. It shows
// the site you're looking at; click it to switch to another site, or to
// "All sites" for an overview of every site.
//
// While you're editing a site (Sites → a site), switching opens the
// site you picked instead. From Sites or Controllers (only in the menu
// on All sites), picking a site opens its Site settings.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Check, ChevronsUpDown, LayoutGrid, Search } from "lucide-react";
import useData from "../useData";
import { ALL_SITES } from "../data";
import SiteIcon from "./SiteIcon";

function AllSitesIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
      <LayoutGrid size={18} />
    </span>
  );
}

function Option({ selected, onClick, icon, name, detail }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
        selected ? "bg-brand/10" : "hover:bg-brand/5"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      {selected && <Check size={18} className="shrink-0 text-brand" />}
    </button>
  );
}

export default function SiteSwitcher({ onPicked }) {
  const { sites, controllers, currentSite, pickSite } = useData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const boxRef = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Clicking anywhere else, or Escape, closes the list
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id) {
    pickSite(id);
    if (/^\/sites\/\d+/.test(pathname))
      navigate(id === ALL_SITES ? "/sites" : `/sites/${id}`);
    else if (id !== ALL_SITES && /^\/(sites|controllers)\/?$/.test(pathname))
      navigate(`/sites/${id}`);
    setOpen(false);
    setSearch("");
    onPicked?.();
  }

  const controllerName = (site) =>
    controllers.find((c) => c.id === site.controllerId)?.name ??
    "No controller";

  const shown = sites.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div ref={boxRef} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full left-0 z-50 mb-2 rounded-xl border border-line bg-white p-2 shadow-xl">
          {sites.length > 5 && (
            <div className="relative mb-2">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a site"
                className="h-9 w-full rounded-lg border border-line pr-3 pl-9 text-base outline-none focus:border-brand sm:text-sm"
              />
            </div>
          )}
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            <Option
              selected={!currentSite}
              onClick={() => choose(ALL_SITES)}
              icon={<AllSitesIcon />}
              name="All sites"
              detail={`Overview of ${sites.length} sites`}
            />
            <div className="mx-2 my-1 border-t border-line" />
            {shown.map((site) => (
              <Option
                key={site.id}
                selected={currentSite?.id === site.id}
                onClick={() => choose(site.id)}
                icon={<SiteIcon site={site} />}
                name={site.name}
                detail={controllerName(site)}
              />
            ))}
            {shown.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-muted">
                No site called “{search}”
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg border border-line px-2 py-2 text-left transition hover:border-brand/40 hover:bg-brand/5"
      >
        {currentSite ? <SiteIcon site={currentSite} /> : <AllSitesIcon />}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium tracking-wide text-muted uppercase">
            Site
          </span>
          <span className="block truncate text-sm font-semibold">
            {currentSite ? currentSite.name : "All sites"}
          </span>
        </span>
        <ChevronsUpDown size={18} className="shrink-0 text-muted" />
      </button>
    </div>
  );
}