// The "Add device" / "Edit device" box for the device whitelist
import { useState } from "react";
import Modal from "./Modal";
import useData from "../useData";
import { normalizeMac } from "../whitelist";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "./formStyles";

const toKbps = (text) => {
  const n = parseFloat(text);
  return n > 0 ? Math.round(n * 1000) : null;
};
const toMbps = (kbps) => (kbps ? String(kbps / 1000) : "");

// ms ↔ "2026-10-31" (this device's date)
function dayText(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function endOfDay(text) {
  if (!text) return null;
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}

// entry: the one being edited, or null to add. siteId: the site picked
// in the switcher, used for a new device.
export default function WhitelistModal({ entry, siteId, onSave, onClose }) {
  const { sites, whitelist } = useData();
  const [site, setSite] = useState(entry?.siteId ?? siteId ?? sites[0]?.id);
  const [mac, setMac] = useState(entry?.mac ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [until, setUntil] = useState(dayText(entry?.expiresAt));
  const [down, setDown] = useState(toMbps(entry?.downKbps));
  const [up, setUp] = useState(toMbps(entry?.upKbps));
  const [dataMb, setDataMb] = useState(entry?.dataMb ? String(entry.dataMb) : "");
  const [error, setError] = useState("");

  function save() {
    const clean = normalizeMac(mac);
    if (!clean)
      return setError("Enter the device's MAC address, like 08:57:FB:7F:4A:88.");
    if (
      whitelist.some(
        (w) => w.id !== entry?.id && w.siteId === Number(site) && w.mac === clean,
      )
    )
      return setError("That device is already on this site's whitelist.");
    if (!note.trim()) return setError("Add a note so you know what the device is.");
    document.activeElement?.blur();
    onSave({
      siteId: Number(site),
      mac: clean,
      note: note.trim(),
      expiresAt: endOfDay(until),
      downKbps: toKbps(down),
      upKbps: toKbps(up),
      dataMb: parseInt(dataMb, 10) || null,
    });
  }

  return (
    <Modal
      title={entry ? "Edit device" : "Add device"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            {entry ? "Save" : "Add device"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="w-site">
            Site
          </label>
          <select
            id="w-site"
            value={site}
            onChange={(e) => setSite(Number(e.target.value))}
            className={inputClass}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="w-mac">
            MAC address
          </label>
          <input
            id="w-mac"
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            onBlur={() => normalizeMac(mac) && setMac(normalizeMac(mac))}
            placeholder="08:57:FB:7F:4A:88"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
          <p className={hintClass}>
            On the device's network settings, or in the controller's client
            list. Dashes and dots are fine too. Turn off “private address”
            on phones, or it changes.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="w-note">
            Note
          </label>
          <input
            id="w-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Mall FireStick"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="w-until">
            Ends on (optional)
          </label>
          <input
            id="w-until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>Empty: it never ends.</p>
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
          <p className={hintClass}>Empty: unlimited.</p>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}