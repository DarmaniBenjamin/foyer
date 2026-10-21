// Guests: everyone who has signed in at a site (one per device), and
// their sign-ins ("connections"). Helpers to show them, and example
// guests for "npm run db:demo".
import { STARTING_SITES } from "./data.js";

// ---------- Showing guests ----------

// The guest's name from the form, or "Guest ·A1:B2" from the device
export function guestName(guest, site) {
  const a = guest.answers ?? {};
  const full = [a.first_name, a.last_name].filter(Boolean).join(" ");
  if (full) return full;
  const textField = site?.fields.find((f) => f.type === "text" && a[f.key]);
  if (textField) return a[textField.key];
  return `Guest ·${guest.mac.slice(-5)}`;
}

// The first email answer, or ""
export function guestEmail(guest, site) {
  const field = site?.fields.find((f) => f.type === "email");
  return (field && guest.answers?.[field.key]) || "";
}

// One answer as text: tick boxes are Yes/No, missing ones are "—"
export function answerText(field, value) {
  if (field.type === "checkbox") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

// "21 Oct 2026, 1:05 PM"
export function dateTime(ms) {
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

// ---------- Example guests ----------

// The same "random" guests every time the page loads (a seeded random)
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Aaliyah", "Andre", "Brianna", "Curtis", "Danielle", "Dwayne", "Emily", "Jason", "Kayla", "Kevin", "Keisha", "Marcus", "Nadia", "Nathan", "Renee", "Ryan", "Shanice", "Tyrone", "Vanessa", "Zara", "Michael", "Sarah", "David", "Chloe"];
const LAST = ["Alexander", "Baptiste", "Charles", "Clarke", "Francis", "George", "Hosten", "James", "John", "Joseph", "Mitchell", "Noel", "Paul", "Peters", "Phillip", "Thomas", "Williams", "Bain", "Lewis", "Roberts"];
const MAILS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];

// How busy each hour of the day is (0 = midnight), for realistic
// "popular times" in the reports
const HOUR_WEIGHT = [0, 0, 0, 0, 0, 0, 1, 2, 4, 5, 6, 8, 10, 10, 8, 6, 6, 8, 9, 8, 6, 4, 2, 1];

function pickWeighted(rand, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

function makeMac(rand) {
  const hex = () =>
    Math.floor(rand() * 256)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return Array.from({ length: 6 }, hex).join(":");
}

function exampleAnswers(rand, site) {
  const first = FIRST[Math.floor(rand() * FIRST.length)];
  const last = LAST[Math.floor(rand() * LAST.length)];
  const answers = {};
  for (const field of site.fields) {
    if (field.key === "first_name") answers[field.key] = first;
    else if (field.key === "last_name") answers[field.key] = last;
    else if (field.type === "email")
      answers[field.key] =
        `${first}.${last}${Math.floor(rand() * 90) + 10}@${MAILS[Math.floor(rand() * MAILS.length)]}`.toLowerCase();
    else if (field.type === "phone")
      answers[field.key] = `+1 473 4${Math.floor(rand() * 90 + 10)}-${Math.floor(rand() * 9000 + 1000)}`;
    else if (field.type === "choice")
      answers[field.key] = field.options[Math.floor(rand() * field.options.length)];
    else if (field.type === "checkbox") answers[field.key] = rand() < 0.4;
    else answers[field.key] = "";
  }
  return answers;
}

function exampleGuests() {
  const rand = seeded(2026);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const guests = [];
  const connections = [];
  let guestId = 1;
  let connectionId = 1;

  for (const site of STARTING_SITES) {
    const count = 60 + Math.floor(rand() * 90);
    for (let g = 0; g < count; g++) {
      // More guests in recent months; some come back often
      const firstDay = Math.floor(Math.pow(rand(), 1.4) * 150);
      const visits = 1 + Math.floor(Math.pow(rand(), 3) * 12);
      const times = [];
      for (let v = 0; v < visits; v++) {
        const daysAgo = v === 0 ? firstDay : Math.floor(rand() * firstDay);
        const date = new Date(now - daysAgo * day);
        // Weekends are busier
        if ((date.getDay() === 0 || date.getDay() === 6) && rand() < 0.3) continue;
        date.setHours(pickWeighted(rand, HOUR_WEIGHT), Math.floor(rand() * 60), 0, 0);
        if (date.getTime() <= now) times.push(date.getTime());
      }
      if (times.length === 0) continue;
      times.sort((a, b) => a - b);

      const guest = {
        id: guestId++,
        siteId: site.id,
        mac: makeMac(rand),
        answers: site.mode === "form" ? exampleAnswers(rand, site) : {},
        visits: times.length,
        firstSeenAt: times[0],
        lastSeenAt: times[times.length - 1],
      };
      guests.push(guest);
      for (const at of times)
        connections.push({
          id: connectionId++,
          siteId: site.id,
          guestId: guest.id,
          mac: guest.mac,
          method: site.mode,
          minutes: site.minutes,
          ok: true,
          at,
        });
    }
  }
  return { guests, connections };
}

const example = exampleGuests();
export const STARTING_GUESTS = example.guests;
export const STARTING_CONNECTIONS = example.connections;