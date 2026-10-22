// A bar chart, drawn as SVG. Used on the Dashboard and Reports (with the
// app's colours and a hover tooltip), and drawn again in fixed light
// colours as a picture for the Word report (exports.js).
//
// data: [{ key, label, title, value, parts }]
//   label: under the bar ("" for none). sublabel: a second, lighter line
//   under it (the weekday on the sign-ins graph). group and longLabel:
//   the first labelled bar of each group (month) shows longLabel ("1 Oct")
//   instead. title: the tooltip's heading.
//   parts (only with `series`): { new: 3, returning: 12 }, drawn as
//   bars side by side (first series on the left) so they're easy to
//   compare.
// series: [{ key, name }] to split each day into bars (see chartColors.js)
//
// Every bar is the same thin width (BAR) on every graph.
// - On the page the graph fills its card: the bars are spread out evenly
//   across it, so it fits any screen. On a phone too narrow for that,
//   the bars get thinner to fit.
// - As a picture (the download and the Word report) it's always the same
//   fixed size, whatever the screen: the bars joined up, with only a
//   hairline between them, so its width comes from how many bars it has.
import { useLayoutEffect, useRef, useState } from "react";
import { APP_COLORS } from "./chartColors";

export const BAR = 14; // every bar's width
const DAY_GAP = 2; // between days (or hours)
const IN_GAP = 1; // between New and Returning on the same day
const LEFT = 36; // room for the numbers on the side
const RIGHT = 4;

// How wide one day (or hour) is: its bars and the gap after them
const bandOf = (series) => {
  const count = series ? series.length : 1;
  return BAR * count + IN_GAP * (count - 1) + DAY_GAP;
};

// The picture's size: { width, height } (it adds its legend)
export function chartSize(data, series, height = 240) {
  return {
    width: LEFT + bandOf(series) * Math.max(1, data.length) + RIGHT,
    height: height + (series ? 26 : 0),
  };
}

// Roughly how wide a label is at 11px
const textWidth = (text) => String(text ?? "").length * 6.2 + 4;

// Clean steps for the side numbers: 1, 2, 5, 10, 20, 50...
function niceStep(rough) {
  if (rough <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  for (const m of [1, 2, 5, 10]) if (m * power >= rough) return m * power;
  return 10 * power;
}

const compact = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K` : String(n);

// A bar: square at the bottom, rounded at the top
function barPath(x, y, w, h) {
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export default function BarChart({
  data,
  series,
  height = 240,
  unit = "sign-ins",
  colors = APP_COLORS,
  fontFamily = "inherit",
  forPicture = false,
}) {
  const [hover, setHover] = useState(null);
  const boxRef = useRef(null);
  const [measured, setMeasured] = useState(0); // the card's width

  useLayoutEffect(() => {
    if (forPicture || !boxRef.current) return;
    const box = boxRef.current;
    const observer = new ResizeObserver(([entry]) => setMeasured(Math.round(entry.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, [forPicture]);

  // The picture: its fixed size. On the page: the card's width.
  const joined = chartSize(data, series, height).width;
  const W = forPicture || !measured ? joined : Math.max(240, measured);
  // The picture has its legend drawn in (on screen it's above the chart),
  // so it's that much taller, and the bars stay the same size
  const legendH = forPicture && series ? 26 : 0;
  const H = height + legendH;
  const left = LEFT;
  const right = RIGHT;
  const top = 12 + legendH;
  const twoLines = data.some((d) => d.sublabel);
  const bottom = twoLines ? 40 : 26;
  const innerW = W - left - right;
  const innerH = H - top - bottom;
  // Side-by-side bars only go as high as the biggest part
  const maxValue = Math.max(
    0,
    ...data.map((d) =>
      series ? Math.max(0, ...series.map((s) => d.parts?.[s.key] ?? 0)) : d.value,
    ),
  );
  // About 6 steps on the side (0, 10, 20 … 60), so a bar of 50 next to one
  // of 20 is easy to read off
  const step = niceStep(maxValue / 6);
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  // Each day's (or hour's) share of the width; its bars sit in the middle
  const band = innerW / Math.max(1, data.length);
  const count = series ? series.length : 1;
  // BAR wide, or thinner when there isn't room (a phone)
  const inGap = series && band > 8 ? IN_GAP : 0;
  const barW = Math.max(1, Math.min(BAR, (band - Math.min(DAY_GAP, band * 0.1) - inGap * (count - 1)) / count));
  const fullW = barW * count + inGap * (count - 1);
  // Only as many labels under the bars as fit without overlapping. When
  // the full names don't fit under every bar, the short ones are used
  // (M T W… on the day-of-the-week graph).
  const labelled = data.filter((d) => d.label);
  const widestOf = (pick) => Math.max(0, ...labelled.map((d) => textWidth(pick(d))));
  const useShort =
    labelled.length > 0 &&
    labelled.every((d) => d.short) &&
    widestOf((d) => d.longLabel || d.label) > band;
  const labelOf = (d) => (useShort ? d.short : d.label);
  // Spaced by the everyday labels ("12", "Wed"); the month name on the
  // first day ("1 Oct") is a little wider, but its neighbours are short
  const widest = useShort
    ? widestOf((d) => d.short)
    : Math.max(widestOf((d) => d.label), widestOf((d) => d.sublabel ?? ""));
  const every = Math.max(1, Math.ceil(widest / band));
  const shownLabels = new Set(labelled.map((d) => d.key).filter((_, i) => i % every === 0));
  // The words under each labelled bar: its month too when it's the first
  // labelled bar of that month
  const labelText = new Map();
  let lastGroup = null;
  for (const d of data) {
    if (!shownLabels.has(d.key)) continue;
    const first = d.group !== undefined && d.group !== lastGroup;
    labelText.set(d.key, first && d.longLabel && !useShort ? d.longLabel : labelOf(d));
    lastGroup = d.group;
  }
  function bar(d, i) {
    const x0 = left + band * i + band / 2 - fullW / 2;
    const base = top + innerH;
    // On screen the bars grow up one after another (index.css, chart-bar)
    const grow = forPicture
      ? {}
      : { className: "chart-bar", style: { animationDelay: `${Math.min(i * 18, 400)}ms` } };
    if (!series) {
      const h = (d.value / max) * innerH;
      return h > 0 ? (
        <path {...grow} d={barPath(x0, base - h, barW, h)} fill={hover === i ? colors.hover : colors.bar} />
      ) : null;
    }
    // Side by side, in the order of `series`. A day with only New (or
    // only Returning) guests has its one bar in the middle, so there's
    // no empty space where the other bar would be.
    const shown = series.filter((s) => (d.parts?.[s.key] ?? 0) > 0);
    const shownW = barW * shown.length + inGap * Math.max(0, shown.length - 1);
    const start = left + band * i + band / 2 - shownW / 2;
    return shown.map((s, n) => {
      const h = ((d.parts?.[s.key] ?? 0) / max) * innerH;
      return (
        <path
          key={s.key}
          {...grow}
          d={barPath(start + n * (barW + inGap), base - h, barW, h)}
          fill={colors.series[s.key]}
          opacity={hover !== null && hover !== i ? 0.8 : 1}
        />
      );
    });
  }

  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fontFamily={fontFamily}
      role="img"
      style={forPicture ? undefined : { display: "block", overflow: "visible" }}
    >
      {forPicture && <rect width={W} height={H} fill="#ffffff" />}
      {legendH > 0 &&
        series.map((s, n) => (
          <g key={s.key} transform={`translate(${left + n * 150}, 4)`}>
            <rect width="12" height="12" rx="3" fill={colors.series[s.key]} />
            <text x="18" y="10.5" fontSize="12" fill="#344054">
              {s.name}
            </text>
          </g>
        ))}
      {ticks.map((t) => {
        const y = top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y} y2={y} stroke={colors.grid} strokeWidth="1" />
            <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill={colors.text}>
              {compact(t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = left + band * i + band / 2;
        return (
          <g key={d.key}>
            {bar(d, i)}
            {shownLabels.has(d.key) && (
              <text x={cx} y={H - (twoLines ? 22 : 8)} textAnchor="middle" fontSize="11" fill={colors.text}>
                {labelText.get(d.key)}
                {d.sublabel && (
                  <tspan x={cx} dy="14" fontSize="10" opacity="0.7">
                    {d.sublabel}
                  </tspan>
                )}
              </text>
            )}
            {!forPicture && (
              <rect
                x={left + band * i}
                y={top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(i)}
              >
                <title>{`${d.title}: ${d.value.toLocaleString()} ${unit}`}</title>
              </rect>
            )}
          </g>
        );
      })}
    </svg>
  );

  if (forPicture) return svg;

  const shown = hover !== null ? data[hover] : null;
  return (
    <div ref={boxRef} className="w-full min-w-0 overflow-x-auto overflow-y-visible">
      <div className="relative" style={{ width: W, minHeight: height }}>
      {svg}
      {shown && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{
            left: Math.min(W - 70, Math.max(70, left + band * hover + band / 2)),
          }}
        >
          <p className="text-muted">{shown.title}</p>
          <p className="font-semibold">
            {shown.value.toLocaleString()} {unit}
          </p>
          {series?.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-muted">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: colors.series[s.key] }}
              />
              {s.name}: {(shown.parts?.[s.key] ?? 0).toLocaleString()}
            </p>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}