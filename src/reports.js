// The numbers behind the Dashboard, the Reports page and the downloads:
// sign-ins over time, popular hours and weekdays, and totals, for one
// site or all of them, in a date range.
import { SHORT_MONTHS, WEEKDAYS, daysIn, startOfDay } from "./dates";

// Popular times are counted in 2-hour blocks, like Spotipo's:
// 12 AM – 2 AM, 2 AM – 4 AM ... 10 PM – 12 AM
const clock = (h) => `${h % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;

// The sign-ins (connections that worked) for a site (or all: site =
// null) in a range
export function connectionsIn(connections, site, range) {
  return connections.filter(
    (c) =>
      c.ok &&
      c.at >= range.from &&
      c.at <= range.to &&
      (!site || c.siteId === site.id),
  );
}

// Each guest's very first sign-in (ms), to tell new guests from
// returning ones
function firstSignIns(connections) {
  const first = new Map();
  for (const c of connections) {
    if (!c.ok || !c.guestId) continue;
    const seen = first.get(c.guestId);
    if (seen === undefined || c.at < seen) first.set(c.guestId, c.at);
  }
  return first;
}

// Everything the reports show, worked out once.
// The sign-ins graph splits each bar into New guests (that guest's first
// ever sign-in) and Returning guests (every sign-in after that).
export function buildReport({ connections, guests, sites, site, range }) {
  const list = connectionsIn(connections, site, range);
  const firstAt = firstSignIns(connections);
  const days = daysIn(range);
  const byMonth = days > 92;

  // ---- Sign-ins over time: per day, or per month for long ranges ----
  const series = [];
  if (byMonth) {
    const d = new Date(range.from);
    let y = d.getFullYear();
    let m = d.getMonth();
    const last = new Date(range.to);
    while (y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth())) {
      series.push({
        key: `${y}-${m}`,
        label: SHORT_MONTHS[m],
        title: `${SHORT_MONTHS[m]} ${y}`,
        value: 0,
        parts: { new: 0, returning: 0 },
      });
      m += 1;
      if (m === 12) {
        m = 0;
        y += 1;
      }
    }
  } else {
    for (let i = 0; i < days; i++) {
      const date = new Date(startOfDay(range.from));
      date.setDate(date.getDate() + i);
      series.push({
        key: date.getTime(),
        // "21" with "Wed" under it. The graph shows "21 Oct" instead on
        // the first labelled day of each month (group, longLabel)
        label: String(date.getDate()),
        longLabel: `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`,
        group: `${date.getFullYear()}-${date.getMonth()}`,
        sublabel: date.toLocaleDateString("en-GB", { weekday: "short" }),
        title: date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        value: 0,
        parts: { new: 0, returning: 0 },
      });
    }
  }
  const seriesIndex = new Map(series.map((s, i) => [s.key, i]));

  const byHour = Array.from({ length: 12 }, (_, b) => ({
    key: b,
    label: clock(b * 2),
    title: `${clock(b * 2)} – ${clock(b * 2 + 2)}`,
    value: 0,
  }));
  const byWeekday = WEEKDAYS.map((name, i) => ({ key: i, label: name, title: name, value: 0 }));

  const guestIds = new Set();
  const perGuest = new Map();
  const perSite = new Map();

  for (const c of list) {
    const d = new Date(c.at);
    const key = byMonth ? `${d.getFullYear()}-${d.getMonth()}` : startOfDay(c.at);
    const i = seriesIndex.get(key);
    if (i !== undefined) {
      series[i].value += 1;
      const isNew = c.guestId && firstAt.get(c.guestId) === c.at;
      series[i].parts[isNew ? "new" : "returning"] += 1;
    }
    byHour[Math.floor(d.getHours() / 2)].value += 1;
    byWeekday[(d.getDay() + 6) % 7].value += 1;
    const who = c.guestId ?? `mac:${c.mac}`;
    guestIds.add(who);
    perGuest.set(who, (perGuest.get(who) ?? 0) + 1);
    const s = perSite.get(c.siteId) ?? { signIns: 0, guests: new Set() };
    s.signIns += 1;
    s.guests.add(who);
    perSite.set(c.siteId, s);
  }

  const inScope = guests.filter((g) => !site || g.siteId === site.id);
  const newGuests = inScope.filter(
    (g) => g.firstSeenAt >= range.from && g.firstSeenAt <= range.to,
  ).length;
  const returning = [...perGuest.entries()].filter(([who, n]) => {
    if (n > 1) return true;
    const g = typeof who === "number" ? inScope.find((x) => x.id === who) : null;
    return g ? g.firstSeenAt < range.from : false;
  }).length;

  const busiest = (items) =>
    items.reduce((best, item) => (item.value > (best?.value ?? 0) ? item : best), null);

  const siteRows = sites
    .map((s) => ({
      site: s,
      signIns: perSite.get(s.id)?.signIns ?? 0,
      guests: perSite.get(s.id)?.guests.size ?? 0,
    }))
    .sort((a, b) => b.signIns - a.signIns);

  return {
    range,
    byMonth,
    signIns: list.length,
    guests: guestIds.size,
    newGuests,
    returning,
    perDay: list.length / days,
    series,
    byHour,
    byWeekday,
    busiestDay: busiest(series),
    busiestHour: busiest(byHour),
    busiestWeekday: busiest(byWeekday),
    siteRows,
    latest: [...list].sort((a, b) => b.at - a.at).slice(0, 8),
  };
}

// The guests who signed in during the range (for the Excel export),
// with how many times they did
export function guestsIn({ connections, guests, site, range }) {
  const counts = new Map();
  for (const c of connectionsIn(connections, site, range))
    if (c.guestId) counts.set(c.guestId, (counts.get(c.guestId) ?? 0) + 1);
  return guests
    .filter((g) => counts.has(g.id))
    .map((g) => ({ ...g, signInsInRange: counts.get(g.id) }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}