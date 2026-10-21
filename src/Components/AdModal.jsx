// The "New splash ad" / "Edit splash ad" box, with a small phone
// preview of how guests will see it
import { useState } from "react";
import Modal from "./Modal";
import LogoPicker from "./LogoPicker";
import SplashAd from "./SplashAd";
import useData from "../useData";
import { AD_SECONDS, AD_WHEN } from "../ads";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "./formStyles";

// ms ↔ "2026-10-31" (this device's date)
function dayText(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTime(text, endOfDay) {
  if (!text) return null;
  const [y, m, d] = text.split("-").map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59).getTime()
    : new Date(y, m - 1, d).getTime();
}

const choice = (on) =>
  `rounded-xl border px-3 text-sm font-semibold transition ${
    on
      ? "border-brand bg-brand/10 text-brand"
      : "border-line text-muted hover:border-brand/40 hover:bg-brand/5"
  }`;

// ad: the one being edited, or null for a new one. siteId: the site
// picked in the switcher, used for a new ad.
export default function AdModal({ ad, siteId, onSave, onClose }) {
  const { sites } = useData();
  const [site, setSite] = useState(ad?.siteId ?? siteId ?? sites[0]?.id);
  const [name, setName] = useState(ad?.name ?? "");
  const [image, setImage] = useState(ad?.image ?? null);
  const [link, setLink] = useState(ad?.link ?? "");
  const [when, setWhen] = useState(ad?.when ?? "before");
  const [seconds, setSeconds] = useState(ad?.seconds ?? 5);
  const [starts, setStarts] = useState(dayText(ad?.startsAt));
  const [ends, setEnds] = useState(dayText(ad?.endsAt));
  const [active, setActive] = useState(ad?.active ?? true);
  const [preview, setPreview] = useState(0); // changes to replay it
  const [error, setError] = useState("");

  function save() {
    if (!name.trim()) return setError("Give the ad a name.");
    if (!image) return setError("Upload the ad's picture.");
    const cleanLink = link.trim();
    if (cleanLink && !/^https?:\/\/\S+\.\S+/.test(cleanLink))
      return setError("The link should start with https://");
    const startsAt = toTime(starts, false);
    const endsAt = toTime(ends, true);
    if (startsAt && endsAt && endsAt < startsAt)
      return setError("The end date is before the start date.");
    document.activeElement?.blur();
    onSave({
      siteId: Number(site),
      name: name.trim(),
      image,
      link: cleanLink,
      when,
      seconds,
      startsAt,
      endsAt,
      active,
    });
  }

  return (
    <Modal
      title={ad ? "Edit splash ad" : "New splash ad"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            {ad ? "Save" : "Add ad"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ad-name">
              Name
            </label>
            <input
              id="ad-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Christmas sale"
              className={inputClass}
            />
            <p className={hintClass}>Only you see this.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="ad-site">
              Site
            </label>
            <select
              id="ad-site"
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
        </div>

        <div>
          <span className={labelClass}>Picture</span>
          <LogoPicker kind="ad" value={image} onChange={setImage} />
        </div>

        {image && (
          <div className="flex flex-col items-center gap-2">
            <div
              key={preview}
              className="relative h-[360px] w-[200px] overflow-hidden rounded-[1.75rem] border-[6px] border-ink bg-black"
            >
              <SplashAd
                ad={{ name: name || "Advert", image, link, seconds }}
                onDone={() => setPreview((n) => n + 1)}
                preview
              />
            </div>
            <button
              type="button"
              onClick={() => setPreview((n) => n + 1)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Play the preview again
            </button>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="ad-link">
            Link (optional)
          </label>
          <input
            id="ad-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.example.com"
            inputMode="url"
            autoCapitalize="none"
            className={inputClass}
          />
          <p className={hintClass}>Where tapping the picture goes. Taps are counted.</p>
        </div>

        <div>
          <span className={labelClass}>When it shows</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(AD_WHEN).map(([value, info]) => (
              <button
                key={value}
                type="button"
                onClick={() => setWhen(value)}
                className={`${choice(when === value)} py-2 text-left`}
              >
                <span className="block">{info.label}</span>
                <span className="block text-xs font-normal text-muted">{info.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Guests can skip it after</span>
          <div className="flex flex-wrap gap-2">
            {AD_SECONDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeconds(s)}
                className={`${choice(seconds === s)} h-10`}
              >
                {s} seconds
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ad-starts">
              Starts on (optional)
            </label>
            <input
              id="ad-starts"
              type="date"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ad-ends">
              Ends on (optional)
            </label>
            <input
              id="ad-ends"
              type="date"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Show this ad
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}