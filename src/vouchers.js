// Voucher codes: making them, and working out whether each one can
// still be used. Example vouchers are here too, for "npm run db:demo".

// No 0/O, 1/I/L or 5/S, so codes are easy to read off a printed card
const LETTERS = "ABCDEFGHJKMNPQRTUVWXYZ2346789";

// "K7QM-3RXA"
export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => LETTERS[b % LETTERS.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

// count new codes that no voucher in `taken` (a Set) already has
export function makeCodes(count, taken) {
  const codes = [];
  while (codes.length < count) {
    const code = makeCode();
    if (!taken.has(code)) {
      taken.add(code);
      codes.push(code);
    }
  }
  return codes;
}

// "Batch 21 Oct, 1:05 PM"
export function batchName(date = new Date()) {
  return `Batch ${date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
  })}, ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

// "ready" (no uses yet), "in-use" (some uses left), "used" or "expired"
export function voucherStatus(voucher, now = Date.now()) {
  if (voucher.uses >= voucher.maxUses) return "used";
  if (voucher.validUntil && voucher.validUntil < now) return "expired";
  return voucher.uses > 0 ? "in-use" : "ready";
}

export const VOUCHER_STATUSES = {
  ready: { label: "Ready", badge: "bg-brand/10 text-brand" },
  "in-use": { label: "In use", badge: "bg-emerald-50 text-emerald-800" },
  used: { label: "Used up", badge: "bg-page text-muted" },
  expired: { label: "Expired", badge: "bg-amber-50 text-amber-700" },
};

// Example vouchers for Harbour View Hotel (site 3)
function exampleVouchers() {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const taken = new Set();
  const batches = [
    { name: "Batch 1 Oct, 9:00 AM", minutes: 1440, count: 8, at: now - 20 * day, validUntil: now - 2 * day },
    { name: "Batch 15 Oct, 2:30 PM", minutes: 240, count: 12, at: now - 6 * day, validUntil: null },
  ];
  let id = 1;
  const list = [];
  for (const batch of batches) {
    makeCodes(batch.count, taken).forEach((code, i) => {
      list.push({
        id: id++,
        siteId: 3,
        code,
        batch: batch.name,
        minutes: batch.minutes,
        maxUses: 1,
        uses: i % 3 === 0 ? 1 : 0,
        downKbps: null,
        upKbps: null,
        dataMb: null,
        validUntil: batch.validUntil,
        createdAt: batch.at,
      });
    });
  }
  return list;
}

export const STARTING_VOUCHERS = exampleVouchers();