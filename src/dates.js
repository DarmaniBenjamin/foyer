// Date ranges for the Dashboard and Reports: "This month", "Last 30
// days", a whole month like October, or any two days picked on the
// calendar. Times are in ms, in this device's time zone.

const DAY = 24 * 60 * 60 * 1000;

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const startOfDay = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
export const endOfDay = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
};

// The 1st to the last day (28th, 29th, 30th or 31st) of a month.
// month: 0 = January
export function monthRange(year, month) {
  return {
    from: new Date(year, month, 1).getTime(),
    to: new Date(year, month + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

// Quick picks. Kept by name (e.g. "this-month"), so "This month" is
// still this month tomorrow.
export const PRESETS = [
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["this-year", "This year"],
];

// A saved choice ({ preset } or { from, to }) → { from, to }
export function resolveRange(value, now = Date.now()) {
  const d = new Date(now);
  switch (value?.preset) {
    case "this-month":
      return { from: monthRange(d.getFullYear(), d.getMonth()).from, to: endOfDay(now) };
    case "last-month":
      return monthRange(d.getFullYear(), d.getMonth() - 1);
    case "this-year":
      return { from: new Date(d.getFullYear(), 0, 1).getTime(), to: endOfDay(now) };
    case "7":
    case "30":
    case "90":
      return {
        from: startOfDay(now - (Number(value.preset) - 1) * DAY),
        to: endOfDay(now),
      };
    default:
      return value?.from ? { from: value.from, to: value.to } : resolveRange({ preset: "this-month" }, now);
  }
}

// Is this range exactly one whole month? → { year, month } or null
export function wholeMonth({ from, to }) {
  const f = new Date(from);
  if (f.getDate() !== 1 || f.getHours() !== 0) return null;
  const full = monthRange(f.getFullYear(), f.getMonth());
  return full.to === to ? { year: f.getFullYear(), month: f.getMonth() } : null;
}

const dayText = (ms, withYear) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });

// "October 2026", "3 – 17 Oct 2026", "3 Sept – 17 Oct 2026"
export function formatRange(range) {
  const month = wholeMonth(range);
  if (month) return `${MONTHS[month.month]} ${month.year}`;
  const f = new Date(range.from);
  const t = new Date(range.to);
  if (f.getFullYear() !== t.getFullYear())
    return `${dayText(range.from, true)} – ${dayText(range.to, true)}`;
  if (f.getMonth() === t.getMonth()) {
    if (f.getDate() === t.getDate()) return dayText(range.from, true);
    return `${f.getDate()} – ${dayText(range.to, true)}`;
  }
  return `${dayText(range.from)} – ${dayText(range.to, true)}`;
}

// For file names: "Oct 2026" or "2026-10-03 to 2026-10-17"
export function rangeForFile(range) {
  const month = wholeMonth(range);
  if (month) return `${SHORT_MONTHS[month.month]} ${month.year}`;
  const iso = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return `${iso(range.from)} to ${iso(range.to)}`;
}

// How many days a range covers
export const daysIn = ({ from, to }) =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY) + 1;