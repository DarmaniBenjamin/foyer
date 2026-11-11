// Site settings → Look → Copy an existing portal: paste another sign-in
// page's address (e.g. a Spotipo portal), see what Foyer found on it,
// tick what to copy (logo, background, words, colours, questions), and it goes into this site's settings. Nothing is
// saved until Save, so it's easy to look at the preview first.
import { useState } from "react";
import { CircleAlert, CircleCheck, Download } from "lucide-react";
import { api } from "../api";
import { FIELD_TYPES, makeField } from "../data";
import { shrinkPicture } from "./LogoPicker";
import WifiLoader from "./WifiLoader";
import { hintClass, inputClass, primaryButton, secondaryButton } from "./formStyles";

function Pick({ checked, onChange, title, children }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 transition hover:border-brand/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs text-muted">{children}</span>
      </span>
    </label>
  );
}

export default function ImportPortal({ draft, set, setLook, onPreviewPage }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(null);
  const [picks, setPicks] = useState({});
  const [done, setDone] = useState(false);

  async function read(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setDone(false);
    setFound(null);
    try {
      const result = await api("/sites/import-look", { method: "POST", body: { url: url.trim() } });
      setFound(result);
      const words = Boolean(result.heading || result.message || result.button || result.footer);
      setPicks({
        logo: Boolean(result.logo),
        background: Boolean(result.backgroundImage),
        words,
        color: Boolean(result.color || result.background || result.cardColor),
        questions: result.fields.length > 0 || result.terms,
      });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function copy() {
    setBusy(true);
    const look = {};
    if (picks.logo) look.logo = await shrinkPicture(found.logo, "logo");
    if (picks.background) {
      look.backgroundImage = await shrinkPicture(found.backgroundImage, "background");
      Object.assign(look, { bgZoom: 1, bgX: 50, bgY: 50, bgDim: 0 });
    }
    if (picks.words)
      for (const key of ["heading", "message", "button", "footer"]) if (found[key]) look[key] = found[key];
    if (picks.color) {
      if (found.color) look.color = found.color;
      if (found.background) look.background = found.background;
      if (found.cardColor) Object.assign(look, { cardColor: found.cardColor, cardOpacity: found.cardOpacity ?? 1 });
    }
    for (const key of Object.keys(look)) if (look[key] === null) delete look[key];
    setLook(look);
    if (picks.questions) {
      const taken = [];
      const fields = found.fields.map((f) => {
        const field = makeField(f, taken);
        taken.push(field.key);
        return field;
      });
      set({
        ...(fields.length ? { mode: "form", fields } : {}),
        requireTerms: found.terms || (fields.length ? draft.requireTerms : true),
      });
    }
    onPreviewPage("signin");
    setBusy(false);
    setFound(null);
    setDone(true);
  }

  const toggle = (key) => (value) => setPicks((p) => ({ ...p, [key]: value }));
  const nothingPicked = !Object.values(picks).some(Boolean);

  return (
    <div className="space-y-3">
      <form onSubmit={read} className="flex flex-col gap-2 sm:flex-row">
        <input
          id="import-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourname.securewifilogin.com/…"
          autoCapitalize="none"
          autoCorrect="off"
          className={`${inputClass} flex-1`}
        />
        <button type="submit" disabled={busy || !url.trim()} className={secondaryButton}>
          {busy && !found ? <WifiLoader size={16} /> : <Download size={16} />}
          {busy && !found ? "Reading…" : "Read page"}
        </button>
      </form>

      {error && (
        <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {done && (
        <p className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CircleCheck size={16} className="mt-0.5 shrink-0" />
          Copied into this site. Check the preview, change anything you like, then press Save.
        </p>
      )}

      {found && (
        <div className="pop-in space-y-2">
          <p className="text-sm font-medium">Found on that page. Tick what to copy:</p>
          {found.logo && (
            <Pick checked={picks.logo} onChange={toggle("logo")} title="Logo">
              <img src={found.logo} alt="" className="mt-1 max-h-12 max-w-40 rounded bg-page object-contain p-1" />
            </Pick>
          )}
          {found.backgroundImage && (
            <Pick checked={picks.background} onChange={toggle("background")} title="Background picture">
              <img src={found.backgroundImage} alt="" className="mt-1 h-16 w-28 rounded object-cover" />
            </Pick>
          )}
          {(found.heading || found.message || found.button || found.footer) && (
            <Pick checked={picks.words} onChange={toggle("words")} title="Words">
              {[
                ["Heading", found.heading],
                ["Message", found.message],
                ["Button", found.button],
                ["Small print", found.footer],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k} className="block truncate">
                    {k}: “{v}”
                  </span>
                ))}
            </Pick>
          )}
          {(found.color || found.background || found.cardColor) && (
            <Pick checked={picks.color} onChange={toggle("color")} title="Colours">
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {[
                  ["Button", found.color],
                  ["Page", found.background],
                  ["Box", found.cardColor],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded border border-line" style={{ backgroundColor: v }} />
                      {k} {v}
                      {k === "Box" && found.cardOpacity < 1 ? ` (${Math.round(found.cardOpacity * 100)}%)` : ""}
                    </span>
                  ))}
              </span>
            </Pick>
          )}
          {(found.fields.length > 0 || found.terms) && (
            <Pick
              checked={picks.questions}
              onChange={toggle("questions")}
              title={`Questions (${found.fields.length}${found.terms ? " + terms tick box" : ""})`}
            >
              {found.fields.map((f) => (
                <span key={f.label} className="block truncate">
                  {f.label} · {FIELD_TYPES[f.type]}
                  {f.required ? " · required" : ""}
                </span>
              ))}
              {found.terms && <span className="block">Accept the terms of use</span>}
              <span className="mt-1 block">Replaces this site's questions.</span>
            </Pick>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={copy} disabled={busy || nothingPicked} className={primaryButton}>
              {busy ? <WifiLoader size={16} /> : <Download size={16} />}
              Copy into this site
            </button>
            <button type="button" onClick={() => setFound(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className={hintClass}>
        Works with portals whose page shows its logo and questions straight away. One
        that only draws itself with JavaScript can't be read.
      </p>
    </div>
  );
}
