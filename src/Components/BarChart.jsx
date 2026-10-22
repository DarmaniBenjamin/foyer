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
// On screen it's drawn at the width of its box (measured), so the text
// stays the same size on a phone and a big screen. As a picture it's
// drawn at the width it had on screen (width), so the download looks
// exactly like the page.
import { useLayoutEffect, useRef, useState } from "react";
import { APP_COLORS } from "./chartColors";

const PICTURE_WIDTH = 720; // a picture's width when there's no screen size
const SINGLE_BAR = 14; // the widest a bar gets on the Popular times graphs

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
  width,
}) {
  const boxRef = useRef(null);
  // 0 until the box has been measured
  const [measured, setMeasured] = useState(0);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    if (forPicture || !boxRef.current) return;
    const box = boxRef.current;
    const observer = new ResizeObserver(([entry]) =>
      setMeasured(Math.max(240, Math.round(entry.contentRect.width))),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [forPicture]);

  const W = forPicture ? Math.round(width || PICTURE_WIDTH) : measured;
  // The picture has its legend drawn in (on screen it's above the chart),
  // so it's that much taller, and the bars stay the same size
  const legendH = forPicture && series ? 26 : 0;
  const H = height + legendH;
  const left = 36;
  const right = 4;
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
  const step = niceStep(maxValue / 4);
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const band = innerW / Math.max(1, data.length);
  // Bars right next to each other: a 2px gap between days (less when
  // there are lots of them), 1px between New and Returning
  const count = series ? series.length : 1;
  const dayGap = Math.min(2, band * 0.1);
  const inGap = series && band > 8 ? 1 : 0;
  // Popular times (one bar each, no series) are kept as thin as one of
  // the sign-ins graph's bars, so they don't come out fat
  const widest = series ? 80 : SINGLE_BAR;
  const barW = Math.max(1, Math.min(widest, (band - dayGap - inGap * (count - 1)) / count));
  const fullW = barW * count + inGap * (count - 1);
  // Only as many labels under the bars as fit without overlapping
  const fit = Math.max(2, Math.floor(innerW / 34));
  const labelledKeys = data.filter((d) => d.label).map((d) => d.key);
  const every = Math.ceil(labelledKeys.length / fit);
  const shownLabels = new Set(labelledKeys.filter((_, i) => i % every === 0));
  // The words under each labelled bar: its month too when it's the first
  // labelled bar of that month
  const labelText = new Map();
  let lastGroup = null;
  for (const d of data) {
    if (!shownLabels.has(d.key)) continue;
    const first = d.group !== undefined && d.group !== lastGroup;
    labelText.set(d.key, first && d.longLabel ? d.longLabel : d.label);
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
    <div ref={boxRef} className="relative w-full min-w-0" style={{ minHeight: height }}>
      {measured > 0 && svg}
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
  );
}