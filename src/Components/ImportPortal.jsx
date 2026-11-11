// Site settings → Look → Copy an existing portal: paste another sign-in
// page's address (e.g. a Spotipo portal), see what Foyer found on it,
// tick what to copy (logo, background, words, colours, questions), and it goes into this site's settings. Nothing is
// saved until Save, so it's easy to look at the preview first.
// "Try signing in" fills in that portal's form with test details and
// signs in once, to see what comes after: its splash picture (added to
// Splash ads straight away), its words and where it sends guests.
import { useState } from "react";
import { CircleAlert, CircleCheck, Download, LogIn, TriangleAlert } from "lucide-react";
import { api } from "../api";
import useData from "../useData";
import { FIELD_TYPES, makeField } from "../data";
import { AD_PICTURES } from "../ads";
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

// What to type in the test sign-in, to start with. The email is the
// admin's own: portals like Spotipo refuse made-up ones (test@example.com)
function testAnswer(field, email) {
  if (field.type === "email") return email ?? "";
  if (field.type === "phone") return "4730000000";
  if (field.type === "choice") return field.options[0] ?? "";
  return "Foyer Test";
}

// Where the portal sends guests at the end, unless it looks like the
// Wi-Fi controller itself (an IP address, a port, /guest/s/…)
const looksLikeWebsite = (address) =>
  /^https:\/\/[^/:]+\.[a-z]{2,}(\/|$)/i.test(address) && !/\/guest\/s\/|\/portal\//i.test(address);

export default function ImportPortal({ draft, set, setLook, onPreviewPage }) {
  const { addAd, can, currentAdmin } = useData();
  const canAddAds = can("ads", "write");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(null);
  const [picks, setPicks] = useState({});
  const [done, setDone] = useState(false);
  const [test, setTest] = useState({}); // test answers, by the box's name
  const [trying, setTrying] = useState(false);
  const [tryError, setTryError] = useState("");
  const [after, setAfter] = useState(null); // what came after signing in
  const [addedAds, setAddedAds] = useState(0);

  async function read(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setDone(false);
    setFound(null);
    setAfter(null);
    setTryError("");
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
      setTest(
        Object.fromEntries(
          result.fields.filter((f) => f.name && f.type !== "checkbox").map((f) => [f.name, testAnswer(f, currentAdmin?.email)]),
        ),
      );
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function trySignIn() {
    setTrying(true);
    setTryError("");
    setAfter(null);
    try {
      const result = await api("/sites/import-try", { method: "POST", body: { url: url.trim(), answers: test } });
      setAfter(result);
      setPicks((p) => ({
        ...p,
        ...Object.fromEntries(result.pictures.map((_, i) => [`ad${i}`, canAddAds])),
        success: Boolean(result.message || result.heading),
        redirect: Boolean(result.leftTo && looksLikeWebsite(result.leftTo)),
      }));
    } catch (err) {
      setTryError(err.message);
    }
    setTrying(false);
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
    if (after && picks.success) look.success = after.message || after.heading;
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
    if (after && picks.redirect) set({ redirectUrl: after.leftTo });
    // The splash pictures: one splash ad, in the same order (guests scroll
    // through them like on that portal), added to Splash ads now (it's
    // saved there, not with the site), shown after the guest connects
    let added = 0;
    if (after && canAddAds) {
      const host = new URL(url.trim()).hostname;
      const pictures = [];
      for (const [i, pic] of after.pictures.entries()) {
        if (!picks[`ad${i}`]) continue;
        const image = await shrinkPicture(pic.image, "ad");
        if (image) pictures.push({ image, link: pic.link });
      }
      if (pictures.length) {
        await addAd({
          siteId: draft.id,
          name: `Copied from ${host}`,
          image: pictures[0].image,
          link: pictures[0].link,
          more: pictures.slice(1, AD_PICTURES),
          seconds: 5,
          when: "after",
          active: true,
          startsAt: null,
          endsAt: null,
        });
        added = Math.min(pictures.length, AD_PICTURES);
      }
    }
    setAddedAds(added);
    onPreviewPage(after && picks.success && !Object.keys(look).some((k) => k !== "success") ? "success" : "signin");
    setBusy(false);
    setFound(null);
    setAfter(null);
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
          <span>
            Copied into this site. Check the preview, change anything you like, then press Save.
            {addedAds > 0 &&
              ` The splash ad${addedAds > 1 ? ` (${addedAds} pictures to scroll through)` : ""} is already in Splash ads, shown after guests connect.`}
          </span>
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
          {found.canTry && (
            <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
              <div>
                <p className="text-sm font-medium">See what comes after signing in</p>
                <p className="mt-1 text-xs text-muted">
                  Foyer fills in that portal's form with these details and signs in once, like a guest,
                  to find the pages that come next and their splash pictures. That portal will count it
                  as one guest. Use an email address that works: portals like Spotipo refuse made-up ones.
                </p>
              </div>
              {found.fields.some((f) => f.name && f.type !== "checkbox") && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {found.fields
                    .filter((f) => f.name && f.type !== "checkbox")
                    .map((f) => (
                      <label key={f.name} className="block min-w-0">
                        <span className="mb-1 block truncate text-xs font-medium text-muted">{f.label}</span>
                        {f.type === "choice" ? (
                          <select
                            value={test[f.name] ?? ""}
                            onChange={(e) => setTest((t) => ({ ...t, [f.name]: e.target.value }))}
                            className={inputClass}
                          >
                            {f.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                            value={test[f.name] ?? ""}
                            onChange={(e) => setTest((t) => ({ ...t, [f.name]: e.target.value }))}
                            className={inputClass}
                          />
                        )}
                      </label>
                    ))}
                </div>
              )}
              <button type="button" onClick={trySignIn} disabled={trying || busy} className={secondaryButton}>
                {trying ? <WifiLoader size={16} /> : <LogIn size={16} />}
                {trying ? "Signing in…" : after ? "Try again" : "Sign in and look"}
              </button>
              {tryError && (
                <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <CircleAlert size={16} className="mt-0.5 shrink-0" />
                  {tryError}
                </p>
              )}
              {after?.blocked && (
                <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  <span>
                    The portal didn't let the test sign-in through: “{after.blocked}” Many portals only let in
                    phones that are on their Wi-Fi, so this part may only work from there.
                  </span>
                </p>
              )}
              {after && !after.blocked && (
                <div className="pop-in space-y-2">
                  <div className="text-xs text-muted">
                    <p>
                      Signed in. It went through {after.steps.length} page{after.steps.length === 1 ? "" : "s"}
                      {after.leftTo ? " and then on to another website" : ""}:
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                      {[...after.steps, ...(after.leftTo ? [after.leftTo] : [])].map((step, i) => (
                        <li key={i} className="truncate">
                          {step.replace(/^https?:\/\//, "")}
                        </li>
                      ))}
                    </ol>
                    {after.pictures.length === 0 && (
                      <p className="mt-2 text-amber-700">
                        No splash pictures were found on those pages. If that portal shows some after signing in,
                        they may be loaded in a way Foyer can't read yet.
                      </p>
                    )}
                  </div>
                  {after.pictures.map((pic, i) => (
                    <Pick
                      key={i}
                      checked={Boolean(picks[`ad${i}`])}
                      onChange={toggle(`ad${i}`)}
                      title={after.pictures.length > 1 ? `Splash picture ${i + 1}` : "Splash picture"}
                    >
                      <img src={pic.image} alt="" className="mt-1 max-h-32 max-w-40 rounded object-contain" />
                      <span className="mt-1 block">
                        {canAddAds
                          ? after.pictures.length > 1
                            ? "The ticked pictures become one splash ad, in this order, that guests scroll through after they connect."
                            : "Becomes a splash ad, shown after guests connect."
                          : "Your login can't add splash ads."}
                        {pic.link && ` Tapping it opens ${pic.link}`}
                      </span>
                    </Pick>
                  ))}
                  {(after.message || after.heading) && (
                    <Pick checked={Boolean(picks.success)} onChange={toggle("success")} title="Words after signing in">
                      “{after.message || after.heading}”
                    </Pick>
                  )}
                  {after.leftTo && (
                    <Pick checked={Boolean(picks.redirect)} onChange={toggle("redirect")} title="Where guests go next">
                      <span className="block truncate">{after.leftTo}</span>
                      <span className="mt-1 block">Becomes this site's “Send guests to” address (Access tab, After signing in).</span>
                    </Pick>
                  )}
                  {!after.pictures.length && !after.message && !after.heading && !after.leftTo && (
                    <p className="text-xs text-muted">Nothing to copy came after signing in.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={copy} disabled={busy || nothingPicked} className={primaryButton}>
              {busy ? <WifiLoader size={16} /> : <Download size={16} />}
              Copy into this site
            </button>
            <button
              type="button"
              onClick={() => {
                setFound(null);
                setAfter(null);
              }}
              className={secondaryButton}
            >
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
