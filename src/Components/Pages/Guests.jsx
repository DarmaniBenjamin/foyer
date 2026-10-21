// Guests: everyone who signed in during the date range, one row per
// device.
// - One site picked: every question on its form is its own column (the
//   same columns as the Excel download).
// - All sites: the name, email and site of every guest.
// Click a guest for everything they typed and their recent sign-ins.
// The date range is the same one the Dashboard and Reports use.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  FileSpreadsheet,
  LoaderCircle,
  Repeat,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import useData from "../../useData";
import { SIGN_IN_MODES } from "../../data";
import { resolveRange } from "../../dates";
import { guestsIn } from "../../reports";
import { answerText, dateTime, guestEmail, guestName } from "../../guests";
import SiteIcon from "../SiteIcon";
import GuestModal from "../GuestModal";
import DateRangePicker from "../DateRangePicker";
import { secondaryButton } from "../formStyles";

const PAGE = 50;

const SORTS = [
  ["recent", "Last seen"],
  ["visits", "Most visits"],
  ["new", "Newest guests"],
  ["name", "Name A–Z"],
];

function Stat({ icon, label, value }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 sm:p-4">
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand sm:flex">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted sm:text-sm">{label}</p>
        <p className="text-xl font-semibold">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

const selectClass =
  "h-10 min-w-0 rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-brand sm:text-sm";

export default function Guests() {
  const {
    sites,
    guests,
    connections,
    currentSite,
    range: rangeValue,
    setRange,
  } = useData();
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [now] = useState(() => Date.now());
  const range = useMemo(() => resolveRange(rangeValue, now), [rangeValue, now]);

  const siteById = useMemo(
    () => new Map(sites.map((s) => [s.id, s])),
    [sites],
  );
  // The picked site's questions become columns
  const fields = currentSite?.mode === "form" ? currentSite.fields : [];

  // Guests who signed in during the range (the same ones as the Excel)
  const inRange = useMemo(
    () => guestsIn({ connections, guests, site: currentSite, range }),
    [connections, guests, currentSite, range],
  );

  const list = useMemo(() => {
    const words = search.trim().toLowerCase();
    const matching = inRange.filter((g) => {
      if (!words) return true;
      const text = [g.mac, ...Object.values(g.answers ?? {})]
        .join(" ")
        .toLowerCase();
      return text.includes(words);
    });
    const byName = (g) => guestName(g, siteById.get(g.siteId)).toLowerCase();
    const order = {
      recent: (a, b) => b.lastSeenAt - a.lastSeenAt,
      visits: (a, b) => b.visits - a.visits || b.lastSeenAt - a.lastSeenAt,
      new: (a, b) => b.firstSeenAt - a.firstSeenAt,
      name: (a, b) => byName(a).localeCompare(byName(b)),
    };
    return matching.sort(order[sort]);
  }, [inRange, search, sort, siteById]);

  const newGuests = list.filter((g) => g.firstSeenAt >= range.from).length;
  const returning = list.filter(
    (g) => g.signInsInRange > 1 || g.firstSeenAt < range.from,
  ).length;

  const reset = () => setShown(PAGE);

  async function download() {
    setDownloading(true);
    try {
      const { downloadGuestExcel } = await import("../../exports");
      await downloadGuestExcel({ sites, guests, connections, site: currentSite, range });
    } catch (err) {
      console.error(err);
      alert(`Couldn't make the Excel file: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker
          value={rangeValue}
          onChange={(value) => {
            setRange(value);
            reset();
          }}
        />
        <button
          type="button"
          onClick={download}
          disabled={downloading || inRange.length === 0}
          className={secondaryButton}
        >
          {downloading ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={18} />
          )}
          Download Excel
        </button>
      </div>

      <p className="max-w-2xl text-sm text-muted">
        {currentSite
          ? `Everyone who signed in to ${currentSite.name}'s Wi-Fi in this period, one row per device.`
          : "Everyone who signed in at every site in this period. Pick a site in the switcher to see each of its questions as a column."}
      </p>

      {currentSite && currentSite.mode !== "form" && (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">
          {currentSite.name} signs guests in with{" "}
          <b className="text-ink">{SIGN_IN_MODES[currentSite.mode].label}</b>, so
          there are no answers, only devices.{" "}
          <Link
            to={`/sites/${currentSite.id}`}
            className="font-semibold text-brand hover:underline"
          >
            Ask questions instead
          </Link>
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={Users} label="Guests" value={list.length} />
        <Stat
          icon={UserPlus}
          label="New"
          value={newGuests}
        />
        <Stat icon={Repeat} label="Came back" value={returning} />
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                reset();
              }}
              placeholder="Find a name, email, answer or MAC"
              className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-base outline-none focus:border-brand sm:text-sm"
            />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`${selectClass} flex-1`}
              aria-label="Sort by"
            >
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">No guests here</p>
            <p className="mt-1 text-sm text-muted">
              Try a longer date range, or clear the search.
            </p>
          </div>
        ) : (
          <>
            {/* Computers: a table (wide forms scroll sideways inside it) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide whitespace-nowrap text-muted uppercase">
                    {currentSite ? (
                      fields.length ? (
                        fields.map((f) => (
                          <th key={f.key} className="px-4 py-3 font-medium">
                            {f.label}
                          </th>
                        ))
                      ) : (
                        <th className="px-4 py-3 font-medium">Device</th>
                      )
                    ) : (
                      <>
                        <th className="px-4 py-3 font-medium">Guest</th>
                        <th className="px-4 py-3 font-medium">Site</th>
                      </>
                    )}
                    <th className="px-4 py-3 font-medium">Sign-ins</th>
                    <th className="px-4 py-3 font-medium">First seen</th>
                    <th className="px-4 py-3 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, shown).map((g) => {
                    const site = siteById.get(g.siteId);
                    return (
                      <tr
                        key={g.id}
                        onClick={() => setOpen(g)}
                        className="cursor-pointer border-t border-line transition-colors hover:bg-brand/5"
                      >
                        {currentSite ? (
                          fields.length ? (
                            fields.map((f) => (
                              <td key={f.key} className="max-w-56 truncate px-4 py-3">
                                {answerText(f, g.answers?.[f.key])}
                              </td>
                            ))
                          ) : (
                            <td className="px-4 py-3 font-mono">{g.mac}</td>
                          )
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <p className="font-medium">{guestName(g, site)}</p>
                              <p className="text-xs text-muted">
                                {guestEmail(g, site) || g.mac}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {site && (
                                <span className="flex items-center gap-2 whitespace-nowrap">
                                  <SiteIcon site={site} size="sm" />
                                  {site.name}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3">{g.signInsInRange}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {dateTime(g.firstSeenAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {dateTime(g.lastSeenAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phones: cards */}
            <div className="divide-y divide-line md:hidden">
              {list.slice(0, shown).map((g) => {
                const site = siteById.get(g.siteId);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setOpen(g)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-brand/5"
                  >
                    {site && <SiteIcon site={site} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{guestName(g, site)}</p>
                      <p className="truncate text-sm text-muted">
                        {guestEmail(g, site) || g.mac}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted">
                      <p>
                        {g.signInsInRange} sign-in{g.signInsInRange === 1 ? "" : "s"}
                      </p>
                      <p>
                        {new Date(g.lastSeenAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {list.length > shown && (
              <div className="border-t border-line p-3 text-center">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className={secondaryButton}
                >
                  Show more ({list.length - shown} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {open && <GuestModal guest={open} onClose={() => setOpen(null)} />}
    </div>
  );
}