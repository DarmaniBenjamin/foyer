// The "New splash ad" / "Edit splash ad" box, with a small phone
// preview of how guests will see it. An ad has one picture or several:
// several are shown one under the other, and guests scroll through them
// like a web page. The arrows set their order, top to bottom.
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { shrinkFile } from "./LogoPicker";
import SplashAd from "./SplashAd";
import useData from "../useData";
import { AD_PICTURES, AD_SECONDS, AD_WHEN, adPictures } from "../ads";
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

const validLink = (link) => !link || /^https?:\/\/\S+\.\S+/.test(link);

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-brand/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30";

const choice = (on) =>
  `rounded-lg border px-3 text-sm font-semibold transition ${
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
  // [{ image, link }], top to bottom
  const [pictures, setPictures] = useState(() => adPictures(ad));
  const [adding, setAdding] = useState(false);
  const fileRef = useRef(null);
  const [when, setWhen] = useState(ad?.when ?? "before");
  const [seconds, setSeconds] = useState(ad?.seconds ?? 5);
  const [starts, setStarts] = useState(dayText(ad?.startsAt));
  const [ends, setEnds] = useState(dayText(ad?.endsAt));
  const [active, setActive] = useState(ad?.active ?? true);
  const [preview, setPreview] = useState(0); // changes to replay it
  const [error, setError] = useState("");

  async function addFiles(e) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // so picking the same files again still works
    if (!files.length) return;
    const room = AD_PICTURES - pictures.length;
    if (room <= 0) return setError(`An ad can have up to ${AD_PICTURES} pictures.`);
    setAdding(true);
    setError(files.length > room ? `Only the first ${room} were added: an ad can have up to ${AD_PICTURES} pictures.` : "");
    const added = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push({ image: await shrinkFile(file, "ad"), link: "" });
      } catch (err) {
        setError(err.message);
      }
    }
    setPictures((list) => [...list, ...added]);
    setAdding(false);
  }

  const change = (i, changes) =>
    setPictures((list) => list.map((p, j) => (j === i ? { ...p, ...changes } : p)));
  function move(i, by) {
    setPictures((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  }

  function save() {
    if (!name.trim()) return setError("Give the ad a name.");
    if (!pictures.length) return setError("Add at least one picture.");
    const clean = pictures.map((p) => ({ image: p.image, link: p.link.trim() }));
    if (!clean.every((p) => validLink(p.link))) return setError("A link should start with https://");
    const startsAt = toTime(starts, false);
    const endsAt = toTime(ends, true);
    if (startsAt && endsAt && endsAt < startsAt)
      return setError("The end date is before the start date.");
    document.activeElement?.blur();
    onSave({
      siteId: Number(site),
      name: name.trim(),
      image: clean[0].image,
      link: clean[0].link,
      more: clean.slice(1),
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
          <span className={labelClass}>Pictures</span>
          {pictures.length > 0 && (
            <ul className="mb-2 divide-y divide-line rounded-lg border border-line">
              {pictures.map((p, i) => (
                <li key={i} className="flex items-center gap-2 p-2">
                  <img src={p.image} alt="" className="h-16 w-12 shrink-0 rounded-md bg-black object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-muted">
                      {pictures.length > 1 ? (i === 0 ? "Top" : i === pictures.length - 1 ? "Bottom" : `Number ${i + 1}`) : "The picture"}
                    </p>
                    <input
                      value={p.link}
                      onChange={(e) => change(i, { link: e.target.value })}
                      placeholder="Link when tapped (optional)"
                      inputMode="url"
                      autoCapitalize="none"
                      aria-label={`Picture ${i + 1} link`}
                      className={`${inputClass} ${validLink(p.link.trim()) ? "" : "border-red-300"}`}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col sm:flex-row">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={iconButton} aria-label={`Move picture ${i + 1} up`}>
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === pictures.length - 1}
                      className={iconButton}
                      aria-label={`Move picture ${i + 1} down`}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPictures((list) => list.filter((_, j) => j !== i))}
                    className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
                    aria-label={`Remove picture ${i + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={adding || pictures.length >= AD_PICTURES}
            className={secondaryButton}
          >
            <ImagePlus size={16} />
            {adding ? "Adding…" : pictures.length ? "Add more pictures" : "Add pictures"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={addFiles}
            className="hidden"
          />
          <p className={hintClass}>
            One picture fills the screen. With more, guests scroll down through them like a web page, in
            this order. You can pick several at once (up to {AD_PICTURES}). Tall pictures fit phones best,
            e.g. 1080 × 1350.
          </p>
        </div>

        {pictures.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <div
              key={preview}
              className="relative h-[360px] w-[200px] overflow-hidden rounded-[1.75rem] border-[6px] border-ink bg-black"
            >
              <SplashAd
                ad={{
                  name: name || "Advert",
                  image: pictures[0].image,
                  link: pictures[0].link,
                  more: pictures.slice(1),
                  seconds,
                }}
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
                className={`${choice(seconds === s)} h-9`}
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}