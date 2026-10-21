// The "Make vouchers" box: how many codes, for which site, how long each
// lasts, how many devices can use each one, and optional limits.
import { useState } from "react";
import { Printer, TriangleAlert } from "lucide-react";
import Modal from "./Modal";
import useData from "../useData";
import { SIGN_IN_MODES, formatMinutes } from "../data";
import { batchName } from "../vouchers";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "./formStyles";

const TIME_CHOICES = [60, 120, 240, 480, 1440, 4320, 10080];

// "2.5" Mbps → 2500 kbps; empty = no limit (the site's limit is used)
const toKbps = (text) => {
  const n = parseFloat(text);
  return n > 0 ? Math.round(n * 1000) : null;
};

// "2026-10-31" → the end of that day, in ms
function endOfDay(text) {
  if (!text) return null;
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}

export default function VoucherModal({ siteId, onMade, onPrint, onClose }) {
  const { sites, addVouchers } = useData();
  // Voucher sites first
  const ordered = [...sites].sort(
    (a, b) => (b.mode === "voucher") - (a.mode === "voucher"),
  );
  const [site, setSite] = useState(
    siteId ?? ordered.find((s) => s.mode === "voucher")?.id ?? ordered[0]?.id,
  );
  const [count, setCount] = useState("10");
  const [minutes, setMinutes] = useState(240);
  const [maxUses, setMaxUses] = useState("1");
  const [validUntil, setValidUntil] = useState("");
  const [down, setDown] = useState("");
  const [up, setUp] = useState("");
  const [dataMb, setDataMb] = useState("");
  const [batch, setBatch] = useState(() => batchName());
  const [error, setError] = useState("");
  const [made, setMade] = useState(null);

  const chosen = sites.find((s) => s.id === Number(site));
  // Today as "2026-10-21" (this device's date, not UTC's)
  const [today] = useState(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  function save() {
    const n = parseInt(count, 10);
    const uses = parseInt(maxUses, 10);
    if (!chosen) return setError("Pick a site.");
    if (!(n >= 1 && n <= 500)) return setError("Make between 1 and 500 at a time.");
    if (!(uses >= 1 && uses <= 100))
      return setError("Devices per code is between 1 and 100.");
    if (validUntil && endOfDay(validUntil) < Date.now())
      return setError("The last day to use them can't be in the past.");
    document.activeElement?.blur();
    const vouchers = addVouchers({
      siteId: chosen.id,
      count: n,
      batch: batch.trim() || batchName(),
      minutes,
      maxUses: uses,
      downKbps: toKbps(down),
      upKbps: toKbps(up),
      dataMb: parseInt(dataMb, 10) || null,
      validUntil: endOfDay(validUntil),
    });
    setMade(vouchers);
    onMade?.(vouchers);
  }

  if (made)
    return (
      <Modal
        title="Vouchers made"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className={secondaryButton}>
              Done
            </button>
            <button
              type="button"
              onClick={() => onPrint(made)}
              className={primaryButton}
            >
              <Printer size={18} />
              Print them
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {made.length} voucher{made.length === 1 ? "" : "s"} for{" "}
          <b className="text-ink">{chosen.name}</b>, each good for{" "}
          {formatMinutes(minutes)}. They're in the list as “{made[0].batch}”.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {made.slice(0, 12).map((v) => (
            <code
              key={v.id}
              className="rounded-lg bg-page px-2 py-1 font-mono text-sm"
            >
              {v.code}
            </code>
          ))}
          {made.length > 12 && (
            <span className="px-2 py-1 text-sm text-muted">
              and {made.length - 12} more
            </span>
          )}
        </div>
      </Modal>
    );

  return (
    <Modal
      title="Make vouchers"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            Make vouchers
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="v-site">
            Site
          </label>
          <select
            id="v-site"
            value={site ?? ""}
            onChange={(e) => setSite(Number(e.target.value))}
            className={inputClass}
          >
            {ordered.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.mode !== "voucher" ? ` (${SIGN_IN_MODES[s.mode].label})` : ""}
              </option>
            ))}
          </select>
          {chosen && chosen.mode !== "voucher" && (
            <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              {chosen.name} signs guests in with{" "}
              {SIGN_IN_MODES[chosen.mode].label}, so guests won't be asked for
              a code until it's set to Voucher (Sites → Sign-in).
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="v-count">
              How many
            </label>
            <input
              id="v-count"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="v-uses">
              Devices per code
            </label>
            <input
              id="v-uses"
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <span className={labelClass}>Time on each device</span>
          <div className="flex flex-wrap gap-2">
            {TIME_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`h-10 rounded-xl border px-3 text-sm font-medium transition ${
                  minutes === m
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line hover:border-brand/40 hover:bg-brand/5"
                }`}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>
          <p className={hintClass}>Counted from when the guest first uses the code.</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="v-until">
            Last day to use them (optional)
          </label>
          <input
            id="v-until"
            type="date"
            min={today}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <span className={labelClass}>Limits (optional)</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Download", down, setDown, "Mbps"],
              ["Upload", up, setUp, "Mbps"],
              ["Data", dataMb, setDataMb, "MB"],
            ].map(([label, value, setValue, unit]) => (
              <div key={label} className="relative">
                <input
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={label}
                  aria-label={`${label} limit`}
                  className={`${inputClass} pr-14`}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
                  {unit}
                </span>
              </div>
            ))}
          </div>
          <p className={hintClass}>Empty: the site's own limits are used.</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="v-batch">
            Batch name
          </label>
          <input
            id="v-batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>
            To find, print or delete these codes together later, e.g. “Room
            cards October”.
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}