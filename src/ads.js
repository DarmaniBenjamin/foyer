// Splash ads: a picture shown full screen on a site's guest page for a
// few seconds, like Spotipo's campaigns. Example ads are here too,
// for "npm run db:demo".
//
// siteId: the site it shows on
// name: what you call it (guests don't see this)
// image: the picture (a "data:" link, made by LogoPicker)
// link: where tapping the picture goes (optional)
// seconds: how long before the guest can skip it
// when: "before" (as the page opens) or "after" (after they connect)
// active: on or off
// startsAt / endsAt: when it runs (ms, or null = no start / no end)
// views / clicks: how many guests saw it and tapped it

export const AD_WHEN = {
  before: { label: "Before signing in", detail: "As the guest page opens" },
  after: { label: "After connecting", detail: "Before the “connected” page" },
};

export const AD_SECONDS = [3, 5, 10, 15];

// "running", "off", "scheduled" (starts later) or "ended"
export function adStatus(ad, now = Date.now()) {
  if (!ad.active) return "off";
  if (ad.startsAt && ad.startsAt > now) return "scheduled";
  if (ad.endsAt && ad.endsAt < now) return "ended";
  return "running";
}

// One running ad for a site and moment, picked at random so several
// ads take turns, or null
export function pickAd(ads, siteId, when, now = Date.now()) {
  const running = ads.filter(
    (a) => a.siteId === siteId && a.when === when && adStatus(a, now) === "running",
  );
  return running.length ? running[Math.floor(Math.random() * running.length)] : null;
}

// Views to clicks, e.g. "4.2%"
export function clickRate(ad) {
  if (!ad.views) return "—";
  return `${((ad.clicks / ad.views) * 100).toFixed(1)}%`;
}

// A simple made-up poster for the examples
function examplePicture(title, line, from, to) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="1080" height="1350" fill="url(#g)"/>
<circle cx="900" cy="220" r="260" fill="#fff" opacity="0.08"/>
<circle cx="140" cy="1180" r="320" fill="#fff" opacity="0.06"/>
<text x="540" y="640" font-family="Geist, Arial, sans-serif" font-size="110" font-weight="700" fill="#fff" text-anchor="middle">${title}</text>
<text x="540" y="760" font-family="Geist, Arial, sans-serif" font-size="52" fill="#fff" opacity="0.9" text-anchor="middle">${line}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const day = 24 * 60 * 60 * 1000;

export const STARTING_ADS = [
  {
    id: 1,
    siteId: 1,
    name: "Back to school sale",
    image: examplePicture("Back to School", "Up to 30% off this week", "#0e7490", "#1d64d8"),
    link: "https://www.example.com",
    seconds: 5,
    when: "before",
    active: true,
    startsAt: null,
    endsAt: Date.now() + 20 * day,
    views: 1284,
    clicks: 57,
    createdAt: Date.now() - 25 * day,
  },
  {
    id: 2,
    siteId: 1,
    name: "Food court specials",
    image: examplePicture("Food Court", "Lunch combos from $25", "#c2410c", "#9333ea"),
    link: "",
    seconds: 3,
    when: "after",
    active: false,
    startsAt: null,
    endsAt: null,
    views: 312,
    clicks: 0,
    createdAt: Date.now() - 60 * day,
  },
  {
    id: 3,
    siteId: 3,
    name: "Sunset dinner",
    image: examplePicture("Sunset Dinner", "Book at the front desk", "#0f766e", "#b45309"),
    link: "",
    seconds: 5,
    when: "after",
    active: true,
    startsAt: null,
    endsAt: null,
    views: 96,
    clicks: 4,
    createdAt: Date.now() - 10 * day,
  },
];