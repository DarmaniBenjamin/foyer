// A card with a title, a bar chart, "Show numbers" to see the same
// numbers as a table, and a download button that saves the chart as a
// picture (with the site and dates on it). With `series` (New /
// Returning guests), it shows a legend and a column for each.
import { useState } from "react";
import { Download, LoaderCircle, Table2 } from "lucide-react";
import BarChart from "./BarChart";
import { APP_COLORS } from "./chartColors";
import useData from "../useData";
import { formatRange, rangeForFile, resolveRange } from "../dates";

export default function ChartCard({ title, detail, data, series, unit, height }) {
  const [table, setTable] = useState(false);
  const [saving, setSaving] = useState(false);
  const { currentSite, range: rangeValue } = useData();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  async function download() {
    setSaving(true);
    try {
      const range = resolveRange(rangeValue, Date.now());
      const where = currentSite ? currentSite.name : "All sites";
      const { downloadChart } = await import("../chartDownload");
      await downloadChart({
        title,
        subtitle: `${where} · ${formatRange(range)}`,
        data,
        series,
        height,
        fileName: `${title} - ${where} - ${rangeForFile(range)}`,
      });
    } catch (err) {
      console.error(err);
      alert(`Couldn't make the picture: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="min-w-0 rounded-xl border border-line bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {detail && <p className="text-sm text-muted">{detail}</p>}
          {series && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {series.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: APP_COLORS.series[s.key] }}
                  />
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
              table ? "bg-brand/10 text-brand" : "text-muted hover:bg-brand/5 hover:text-ink"
            }`}
          >
            <Table2 size={14} />
            {table ? "Show graph" : "Show numbers"}
          </button>
          {total > 0 && (
            <button
              type="button"
              onClick={download}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-brand/5 hover:text-brand disabled:opacity-60"
              aria-label="Download the chart as a picture"
              title="Download as a picture"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
            </button>
          )}
        </div>
      </div>
      {total === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No sign-ins in this period.
        </p>
      ) : table ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm whitespace-nowrap">
            {series && (
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1 font-medium" />
                  {series.map((s) => (
                    <th key={s.key} className="pb-1 text-right font-medium">
                      {s.name.split(" ")[0]}
                    </th>
                  ))}
                  <th className="pb-1 text-right font-medium">Total</th>
                </tr>
              </thead>
            )}
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line first:border-t-0">
                  <td className="py-1.5 text-muted">{d.title}</td>
                  {series?.map((s) => (
                    <td key={s.key} className="py-1.5 text-right tabular-nums">
                      {(d.parts?.[s.key] ?? 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-medium tabular-nums">
                    {d.value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <BarChart data={data} series={series} unit={unit} height={height} />
      )}
    </section>
  );
}
