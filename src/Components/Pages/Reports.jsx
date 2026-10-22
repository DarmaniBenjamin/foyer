// Reports: the graphs Spotipo gave each month, for the site picked in
// the site switcher (or all sites), over any date range, plus the two
// downloads to send to the client: the guest list (Excel) and the
// report with its graphs (Word).
import { useMemo, useState } from "react";
import {
  CircleAlert,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
} from "lucide-react";
import useData from "../../useData";
import { formatRange, resolveRange } from "../../dates";
import { buildReport, guestsIn } from "../../reports";
import { SIGN_IN_MODES } from "../../data";
import DateRangePicker from "../DateRangePicker";
import ExcelDateFormat, { useExcelDateFormat } from "../ExcelDateFormat";
import ChartCard from "../ChartCard";
import { GUEST_SERIES } from "../chartColors";
import StatTile from "../StatTile";
import SiteIcon from "../SiteIcon";

function DownloadButton({ icon, title, detail, onClick, busy, disabled }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="group flex w-full items-center gap-4 rounded-xl border border-line bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
        {busy ? (
          <LoaderCircle size={22} className="animate-spin" />
        ) : (
          <Icon size={22} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold group-hover:text-brand">
          {title}
        </span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </button>
  );
}

export default function Reports() {
  const {
    sites,
    guests,
    connections,
    currentSite,
    can,
    range: rangeValue,
    setRange,
  } = useData();
  // The guest list is guest data: client logins need access to it
  const canGuests = can("guests");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const [dateFormat, setDateFormat] = useExcelDateFormat();

  const range = useMemo(() => resolveRange(rangeValue, now), [rangeValue, now]);
  const report = useMemo(
    () => buildReport({ connections, guests, sites, site: currentSite, range }),
    [connections, guests, sites, currentSite, range],
  );
  const guestCount = useMemo(
    () =>
      (currentSite ? [currentSite] : sites).reduce(
        (sum, s) =>
          sum + guestsIn({ connections, guests, site: s, range }).length,
        0,
      ),
    [connections, guests, sites, currentSite, range],
  );

  async function download(kind) {
    setBusy(kind);
    setError("");
    try {
      // Loaded only when needed (the Excel and Word tools are big)
      const exports = await import("../../exports");
      const args = { sites, guests, connections, site: currentSite, range, dateFormat };
      if (kind === "excel") await exports.downloadGuestExcel(args);
      else await exports.downloadWordReport(args);
    } catch (err) {
      console.error(err);
      setError(`Couldn't make the file: ${err.message}`);
    } finally {
      setBusy("");
    }
  }

  const where = currentSite ? currentSite.name : "All sites";
  const period = formatRange(range);
  const busiest = (item) => (item && item.value > 0 ? item.title : "—");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={rangeValue} onChange={setRange} />
        <p className="text-sm text-muted">
          {where} · {report.signIns.toLocaleString()} sign-ins
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {canGuests && (
          <DownloadButton
            icon={FileSpreadsheet}
            title="Guest list (Excel)"
            detail={`${guestCount.toLocaleString()} guests, ${
              currentSite
                ? currentSite.mode === "form"
                  ? "every question its own column"
                  : "devices only (no form)"
                : "one sheet per site"
            } · ${period}`}
            busy={busy === "excel"}
            disabled={guestCount === 0}
            onClick={() => download("excel")}
          />
        )}
        <DownloadButton
          icon={FileText}
          title="Report with graphs (Word)"
          detail={`Totals, sign-ins graph and popular times · ${period}`}
          busy={busy === "word"}
          onClick={() => download("word")}
        />
      </div>
      {canGuests && guestCount > 0 && (
        <ExcelDateFormat value={dateFormat} onChange={setDateFormat} />
      )}
      {error && (
        <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Sign-ins"
          value={report.signIns.toLocaleString()}
          detail={`${report.perDay.toFixed(1)} a day`}
        />
        <StatTile
          label="Guests"
          value={report.guests.toLocaleString()}
          detail="Different devices"
        />
        <StatTile
          label="New guests"
          value={report.newGuests.toLocaleString()}
          detail="First time ever"
        />
        <StatTile
          label="Came back"
          value={report.returning.toLocaleString()}
          detail="More than one visit"
        />
      </div>

      <ChartCard
        title={report.byMonth ? "Sign-ins per month" : "Sign-ins per day"}
        detail={`Busiest: ${busiest(report.busiestDay)}`}
        data={report.series}
        series={GUEST_SERIES}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Popular times"
          detail={`Busiest: ${busiest(report.busiestHour)}`}
          data={report.byHour}
          height={220}
        />
        <ChartCard
          title="Popular times: by day of the week"
          detail={`Busiest: ${busiest(report.busiestWeekday)}`}
          data={report.byWeekday}
          height={220}
        />
      </div>

      {!currentSite && (
        <section className="rounded-xl border border-line bg-white">
          <h3 className="px-5 pt-5 pb-3 font-semibold">Sites</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs tracking-wide text-muted uppercase">
                  <th className="px-5 py-2 font-medium">Site</th>
                  <th className="px-5 py-2 font-medium">Sign-in</th>
                  <th className="px-5 py-2 text-right font-medium">Sign-ins</th>
                  <th className="px-5 py-2 text-right font-medium">Guests</th>
                </tr>
              </thead>
              <tbody>
                {report.siteRows.map((r) => (
                  <tr key={r.site.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <SiteIcon site={r.site} size="sm" />
                        {r.site.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {SIGN_IN_MODES[r.site.mode].label}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {r.signIns.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {r.guests.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}