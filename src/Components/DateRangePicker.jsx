// The date range picker on the Dashboard and Reports.
// - Quick picks: This month, Last month, Last 7 / 30 / 90 days, This year
// - Whole month: pick a year, then a month (the 1st to its last day)
// - Custom: click the first day on the calendar, then the last day
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  MONTHS,
  PRESETS,
  SHORT_MONTHS,
  WEEKDAYS,
  endOfDay,
  formatRange,
  monthRange,
  resolveRange,
  startOfDay,
  wholeMonth,
} from "../dates";

function MonthPicker({ range, onPick, now }) {
  const today = new Date(now);
  const picked = wholeMonth(range);
  const [year, setYear] = useState(
    picked?.year ?? new Date(range.from).getFullYear(),
  );
  const navButton =
    "rounded-lg p-1.5 text-muted transition hover:bg-brand/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className={navButton}
          aria-label="Year before"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">{year}</span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= today.getFullYear()}
          className={navButton}
          aria-label="Year after"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {SHORT_MONTHS.map((name, month) => {
          const future =
            year > today.getFullYear() ||
            (year === today.getFullYear() && month > today.getMonth());
          const active = picked?.year === year && picked?.month === month;
          return (
            <button
              key={name}
              type="button"
              disabled={future}
              onClick={() => onPick(monthRange(year, month))}
              title={`${MONTHS[month]} ${year}`}
              className={`h-10 rounded-lg text-sm font-medium transition disabled:opacity-30 ${
                active
                  ? "bg-brand text-white"
                  : "hover:bg-brand/10 hover:text-brand disabled:hover:bg-transparent disabled:hover:text-inherit"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Calendar({ range, onPick, now }) {
  const [shown, setShown] = useState(() => {
    const d = new Date(range.to);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  // The first day clicked, while waiting for the last one
  const [start, setStart] = useState(null);
  const [hover, setHover] = useState(null);

  const first = new Date(shown.year, shown.month, 1);
  const days = new Date(shown.year, shown.month + 1, 0).getDate();
  const blanks = (first.getDay() + 6) % 7; // weeks start on Monday
  const today = startOfDay(now);

  const from = start ?? range.from;
  const to = start ? (hover ?? start) : range.to;
  const low = Math.min(from, to);
  const high = Math.max(from, to);

  function move(by) {
    const d = new Date(shown.year, shown.month + by, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() });
  }

  function click(day) {
    if (start === null) return setStart(day);
    const a = Math.min(start, day);
    const b = Math.max(start, day);
    setStart(null);
    onPick({ from: a, to: endOfDay(b) });
  }

  const atLatest =
    shown.year > new Date(now).getFullYear() ||
    (shown.year === new Date(now).getFullYear() &&
      shown.month >= new Date(now).getMonth());

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          className="rounded-lg p-1.5 text-muted transition hover:bg-brand/5 hover:text-ink"
          aria-label="Month before"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">
          {MONTHS[shown.month]} {shown.year}
        </span>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={atLatest}
          className="rounded-lg p-1.5 text-muted transition hover:bg-brand/5 hover:text-ink disabled:opacity-30"
          aria-label="Month after"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d.slice(0, 2)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = new Date(shown.year, shown.month, i + 1).getTime();
          const future = day > today;
          const inRange = day >= startOfDay(low) && day <= high;
          const edge = day === startOfDay(low) || day === startOfDay(high);
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => click(day)}
              onMouseEnter={() => setHover(day)}
              className={`h-9 text-sm transition disabled:opacity-30 ${
                edge
                  ? "rounded-lg bg-brand font-semibold text-white"
                  : inRange
                    ? "bg-brand/10 text-brand"
                    : "rounded-lg hover:bg-brand/10"
              } ${day === today && !edge ? "font-semibold underline underline-offset-4" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {start === null ? "Click the first day." : "Now click the last day."}
      </p>
    </div>
  );
}

// value: { preset } or { from, to }. onChange gets the same shapes.
export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("month");
  const [now] = useState(() => Date.now());
  const boxRef = useRef(null);
  const range = resolveRange(value, now);

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

  function pick(next) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold transition hover:border-brand/40 hover:bg-brand/5"
        aria-expanded={open}
      >
        <CalendarDays size={18} className="text-brand" />
        {formatRange(range)}
        <ChevronDown size={16} className="text-muted" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-[min(calc(100vw-2rem),36rem)] rounded-2xl border border-line bg-white p-2 shadow-xl sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-2">
          <div className="grid grid-cols-2 gap-0.5 sm:block sm:space-y-0.5 sm:border-r sm:border-line sm:pr-2">
            {PRESETS.map(([preset, label]) => {
              const active = value?.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => pick({ preset })}
                  className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition ${
                    active ? "font-semibold text-brand" : "hover:bg-brand/5"
                  }`}
                >
                  {label}
                  {active && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-line pt-2 sm:mt-0 sm:border-t-0 sm:pt-0">
            <div className="mb-3 grid grid-cols-2 rounded-lg bg-page p-1">
              {[
                ["month", "Whole month"],
                ["custom", "Pick days"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`h-8 rounded-md text-xs font-semibold transition ${
                    tab === id ? "bg-white text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="px-1 pb-1">
              {tab === "month" ? (
                <MonthPicker range={range} onPick={pick} now={now} />
              ) : (
                <Calendar range={range} onPick={pick} now={now} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}