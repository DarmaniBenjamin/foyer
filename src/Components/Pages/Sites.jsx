// Sites: every client site with a guest Wi-Fi portal, as a short list
// like an email inbox: one thin row per site, just its name. Click one to
// set up its sign-in page. The site picked in the site switcher (or the
// one you were on before "All sites") has a blue outline.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search } from "lucide-react";
import useData from "../../useData";
import NewSiteModal from "../NewSiteModal";
import { primaryButton } from "../formStyles";

function SiteRow({ site, marked, onOpen }) {
  // The site you were on before "All sites" is brought into view
  const row = useRef(null);
  useEffect(() => {
    if (marked) row.current?.scrollIntoView({ block: "nearest" });
  }, [marked]);

  return (
    <button
      ref={row}
      type="button"
      onClick={onOpen}
      className={`block w-full truncate rounded-lg border bg-white px-4 py-2.5 text-left text-sm font-medium shadow-sm transition hover:border-brand/40 hover:text-brand ${
        marked ? "border-brand/50 ring-[3px] ring-brand/10" : "border-line"
      }`}
    >
      {site.name}
    </button>
  );
}

export default function Sites() {
  const { sites, currentSite, lastSite, addSite, pickSite } = useData();
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
        <div className="space-y-1.5">
          {shown.map((site) => (
            <SiteRow
              key={site.id}
              site={site}
              marked={(currentSite ?? lastSite)?.id === site.id}
              onOpen={() => open(site)}
            />
          ))}
          {shown.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-4 py-4 text-center text-sm text-muted">
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