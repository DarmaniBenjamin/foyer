// Dashboard: a quick look at how the guest Wi-Fi is being used, for the
// site picked in the site switcher (or all sites), over the date range
// picked here (shared with the Reports page).
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import useData from "../../useData";
import { resolveRange } from "../../dates";
import { buildReport } from "../../reports";
import { guestName } from "../../guests";
import { timeAgo } from "../../data";
import DateRangePicker from "../DateRangePicker";
import ChartCard from "../ChartCard";
import { GUEST_SERIES } from "../chartColors";
import StatTile from "../StatTile";
import SiteIcon from "../SiteIcon";

export default function Dashboard() {
  const {
    sites,
    guests,
    connections,
    currentSite,
    can,
    pickSite,
    range: rangeValue,
    setRange,
  } = useData();
  const [now] = useState(() => Date.now());
  const range = useMemo(() => resolveRange(rangeValue, now), [rangeValue, now]);
  const report = useMemo(
    () => buildReport({ connections, guests, sites, site: currentSite, range }),
    [connections, guests, sites, currentSite, range],
  );
  const guestById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const topSignIns = Math.max(1, ...report.siteRows.map((r) => r.signIns));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={rangeValue} onChange={setRange} />
        <Link
          to="/reports"
          className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          Reports and downloads
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Sign-ins" value={report.signIns.toLocaleString()} detail={`${report.perDay.toFixed(1)} a day`} />
        <StatTile label="Guests" value={report.guests.toLocaleString()} detail="Different devices" />
        <StatTile label="New guests" value={report.newGuests.toLocaleString()} detail="First time ever" />
        <StatTile
          label="Busiest time"
          value={report.busiestHour?.value ? report.busiestHour.title.split(" – ")[0] : "—"}
          detail={report.busiestWeekday?.value ? `${report.busiestWeekday.title}s are busiest` : ""}
        />
      </div>

      <ChartCard
        title={report.byMonth ? "Sign-ins per month" : "Sign-ins per day"}
        detail={currentSite ? currentSite.name : "All sites"}
        data={report.series}
        series={GUEST_SERIES}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {currentSite ? (
          <ChartCard
            title="Popular times"
            detail="Sign-ins by time of day"
            data={report.byHour}
            height={220}
          />
        ) : (
          <section className="rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-4 font-semibold">Sites</h3>
            <div className="space-y-3">
              {report.siteRows.map((r) => (
                <button
                  key={r.site.id}
                  type="button"
                  onClick={() => pickSite(r.site.id)}
                  className="group block w-full text-left"
                  title={`Show only ${r.site.name}`}
                >
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <SiteIcon site={r.site} size="sm" />
                    <span className="truncate font-medium group-hover:text-brand">
                      {r.site.name}
                    </span>
                    <span className="ml-auto text-muted tabular-nums">
                      {r.signIns.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-brand-soft">
                    <div
                      className="h-2 rounded-full bg-brand"
                      style={{ width: `${(r.signIns / topSignIns) * 100}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-white p-5">
          <h3 className="mb-3 font-semibold">Latest sign-ins</h3>
          {report.latest.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No sign-ins in this period.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {report.latest.map((c) => {
                const site = siteById.get(c.siteId);
                const guest = guestById.get(c.guestId);
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    {site && <SiteIcon site={site} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {/* Names are guest data: client logins need access */}
                        {!can("guests")
                          ? "Guest"
                          : guest
                            ? guestName(guest, site)
                            : "Removed guest"}
                      </p>
                      <p className="truncate text-xs text-muted">{site?.name}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(c.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}