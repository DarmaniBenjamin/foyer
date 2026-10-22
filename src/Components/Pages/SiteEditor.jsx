// One site's settings, with a live preview of its sign-in page.
//   Details: name, controller (and setting it up), portal on/off, the
//            portal address, country, time zone and the email check
//   Sign-in: form questions, terms or voucher
//   Look:    logo, background picture, colours, the box and words
//   Access:  how long guests stay on, speed and data limits
// Changes only count once you press Save.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Clock,
  ListChecks,
  Palette,
  Settings2,
  Trash2,
} from "lucide-react";
import useData from "../../useData";
import {
  COUNTRIES,
  SIGN_IN_MODES,
  TIMEZONES,
  formatMinutes,
  makeSlug,
} from "../../data";
import SiteIcon from "../SiteIcon";
import CopyBox from "../CopyBox";
import ControllerSetup from "../ControllerSetup";
import PortalPreview from "../PortalPreview";
import FieldEditor from "../FieldEditor";
import LogoPicker from "../LogoPicker";
import Modal from "../Modal";
import {
  dangerButton,
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "../formStyles";

const TABS = [
  { id: "details", label: "Details", icon: Settings2 },
  { id: "signin", label: "Sign-in", icon: ListChecks },
  { id: "look", label: "Look", icon: Palette },
  { id: "access", label: "Access", icon: Clock },
];

const TIME_CHOICES = [30, 60, 120, 240, 480, 720, 1440];

const textareaClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-base outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15 sm:text-sm";

// ---------- Small pieces ----------

function Section({ title, hint, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, detail }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function ColorField({ id, label, value, onChange }) {
  const [text, setText] = useState(value);
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          className="h-9 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1"
          aria-label={`${label} picker`}
        />
        <input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
          maxLength={7}
          className={`${inputClass} font-mono uppercase`}
        />
      </div>
    </div>
  );
}

// "2.5" ↔ 2500 kbps; empty = no limit
const toMbps = (kbps) => (kbps ? String(kbps / 1000) : "");
const toKbps = (text) => {
  const n = parseFloat(text);
  return n > 0 ? Math.round(n * 1000) : null;
};

// ---------- The tabs ----------

function DetailsTab({ site, draft, set, slugsTaken, onDelete }) {
  return (
    <>
      <Section title="Site">
        <div>
          <label className={labelClass} htmlFor="site-name">
            Name
          </label>
          <input
            id="site-name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputClass}
          />
        </div>
        <Toggle
          checked={draft.active}
          onChange={(active) => set({ active })}
          label="Portal on"
          detail="When it's off, guests see that Wi-Fi sign-in isn't available."
        />
      </Section>

      <Section
        title="Controller"
        hint="Where this site's access points are managed. Guests are let on through it."
      >
        <ControllerSetup site={site} draft={draft} set={set} />
      </Section>

      <Section
        title="Portal address"
        hint="This site's sign-in page is at /p/ and this name."
      >
        <div>
          <label className={labelClass} htmlFor="site-slug">
            Address name
          </label>
          <input
            id="site-slug"
            value={draft.slug}
            onChange={(e) =>
              set({
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .slice(0, 40),
              })
            }
            onBlur={() => set({ slug: makeSlug(draft.slug, slugsTaken) })}
            autoCapitalize="none"
            autoCorrect="off"
            className={`${inputClass} font-mono`}
          />
          <p className={hintClass}>
            For Omada it's part of the portal address, so changing it means
            changing it in Omada too.
          </p>
        </div>
        <CopyBox text={`${window.location.origin}/p/${draft.slug}`} />
      </Section>

      <Section title="Guests and time">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="site-country">
              Country
            </label>
            <select
              id="site-country"
              value={draft.countryCode}
              onChange={(e) => set({ countryCode: e.target.value })}
              className={inputClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.dial})
                </option>
              ))}
            </select>
            <p className={hintClass}>Picked first for phone numbers.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="site-tz">
              Time zone
            </label>
            <select
              id="site-tz"
              value={draft.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
              className={inputClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <p className={hintClass}>For the times in this site's reports.</p>
          </div>
        </div>
        <Toggle
          checked={draft.verifyEmailDomain}
          onChange={(verifyEmailDomain) => set({ verifyEmailDomain })}
          label="Check email addresses"
          detail="Refuse misspelt or fake domains like gmial.com or yaho.com, and ask the guest to fix them."
        />
      </Section>

      <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-red-700">Delete site</h3>
          <p className="text-sm text-muted">
            Removes the site's sign-in page. Guests can't sign in there after.
          </p>
        </div>
        <button type="button" onClick={onDelete} className={`${dangerButton} shrink-0`}>
          <Trash2 size={16} />
          Delete site
        </button>
      </section>
    </>
  );
}

function SignInTab({ draft, set, setLook }) {
  return (
    <>
      <Section title="How guests sign in">
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(SIGN_IN_MODES).map(([value, info]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                set({
                  mode: value,
                  ...(value === "terms" ? { requireTerms: true } : {}),
                })
              }
              className={`rounded-lg border p-3 text-left transition ${
                draft.mode === value
                  ? "border-brand bg-brand/10"
                  : "border-line hover:border-brand/40 hover:bg-brand/5"
              }`}
            >
              <span
                className={`block text-sm font-semibold ${draft.mode === value ? "text-brand" : ""}`}
              >
                {info.label}
              </span>
              <span className="block text-xs text-muted">{info.detail}</span>
            </button>
          ))}
        </div>
      </Section>

      {draft.mode === "form" && (
        <Section
          title="Questions"
          hint="Each question becomes its own column in the guest Excel export."
        >
          <FieldEditor
            fields={draft.fields}
            onChange={(fields) => set({ fields })}
          />
        </Section>
      )}

      {draft.mode === "voucher" && (
        <Section title="Vouchers">
          <p className="text-sm text-muted">
            Guests type a code you give them. Make the codes on the Vouchers
            page; each code can set its own time and limits.
          </p>
        </Section>
      )}

      <Section title="Terms of use">
        {draft.mode === "terms" ? (
          <p className="text-sm text-muted">
            Guests tick that they accept these terms, then connect.
          </p>
        ) : (
          <Toggle
            checked={draft.requireTerms}
            onChange={(requireTerms) => set({ requireTerms })}
            label="Guests must also accept the terms"
          />
        )}
        {draft.requireTerms && (
          <textarea
            value={draft.look.terms}
            onChange={(e) => setLook({ terms: e.target.value })}
            rows={6}
            className={textareaClass}
            aria-label="Terms of use"
          />
        )}
      </Section>
    </>
  );
}

function LookTab({ draft, setLook, onPreviewPage }) {
  const { look } = draft;
  const text = (key, label, rows) => (
    <div>
      <label className={labelClass} htmlFor={`look-${key}`}>
        {label}
      </label>
      {rows ? (
        <textarea
          id={`look-${key}`}
          value={look[key]}
          rows={rows}
          onFocus={() => onPreviewPage(key === "success" ? "success" : "signin")}
          onChange={(e) => setLook({ [key]: e.target.value })}
          className={textareaClass}
        />
      ) : (
        <input
          id={`look-${key}`}
          value={look[key]}
          onFocus={() => onPreviewPage("signin")}
          onChange={(e) => setLook({ [key]: e.target.value })}
          className={inputClass}
        />
      )}
    </div>
  );

  const opacity = Math.round((look.cardOpacity ?? 1) * 100);
  return (
    <>
      <Section title="Logo">
        <LogoPicker value={look.logo} onChange={(logo) => setLook({ logo })} />
      </Section>

      <Section title="Page background" hint="Behind the sign-in box. The picture covers the whole screen.">
        <LogoPicker
          kind="background"
          value={look.backgroundImage}
          onChange={(backgroundImage) => setLook({ backgroundImage })}
        />
        <ColorField
          id="look-background"
          label={look.backgroundImage ? "Colour while the picture loads" : "Background colour"}
          value={look.background}
          onChange={(background) => setLook({ background })}
        />
      </Section>

      <Section title="Sign-in box">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            id="look-card"
            label="Box colour"
            value={look.cardColor ?? "#ffffff"}
            onChange={(cardColor) => setLook({ cardColor })}
          />
          <ColorField
            id="look-color"
            label="Button colour"
            value={look.color}
            onChange={(color) => setLook({ color })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="look-opacity">
            See-through: {100 - opacity}%
          </label>
          <input
            id="look-opacity"
            type="range"
            min="30"
            max="100"
            value={opacity}
            onChange={(e) => setLook({ cardOpacity: Number(e.target.value) / 100 })}
            className="w-full accent-brand"
          />
          <p className={hintClass}>
            Lets the background picture show through the box. The words
            turn white on a dark box by themselves.
          </p>
        </div>
        <div>
          <span className={labelClass}>Question names</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["above", "Above the boxes"],
              ["inside", "Inside the boxes"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLook({ labels: value })}
                className={`h-9 rounded-lg border text-sm font-semibold transition ${
                  (look.labels ?? "above") === value
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-muted hover:border-brand/40 hover:bg-brand/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Words">
        {text("heading", "Heading")}
        {text("message", "Message under the heading", 2)}
        {text("button", "Button")}
        {text("success", "After signing in", 3)}
        {text("footer", "Small print at the bottom")}
      </Section>
    </>
  );
}

function AccessTab({ draft, set }) {
  const custom = !TIME_CHOICES.includes(draft.minutes);
  const [otherTime, setOtherTime] = useState(custom);
  const limitInput = (key, label, unit, toValue, fromValue) => (
    <div>
      <label className={labelClass} htmlFor={`limit-${key}`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={`limit-${key}`}
          inputMode="decimal"
          value={fromValue(draft[key])}
          onChange={(e) => set({ [key]: toValue(e.target.value) })}
          placeholder="No limit"
          className={`${inputClass} pr-14`}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <Section title="Time" hint="How long guests stay on before signing in again.">
        <div className="flex flex-wrap gap-2">
          {TIME_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setOtherTime(false);
                set({ minutes: m });
              }}
              className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
                !otherTime && draft.minutes === m
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line hover:border-brand/40 hover:bg-brand/5"
              }`}
            >
              {formatMinutes(m)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOtherTime(true)}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
              otherTime
                ? "border-brand bg-brand/10 text-brand"
                : "border-line hover:border-brand/40 hover:bg-brand/5"
            }`}
          >
            Other
          </button>
        </div>
        {otherTime && (
          <div className="max-w-xs">
            <label className={labelClass} htmlFor="minutes">
              Minutes
            </label>
            <input
              id="minutes"
              inputMode="numeric"
              value={draft.minutes || ""}
              onChange={(e) =>
                set({ minutes: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0 })
              }
              className={inputClass}
            />
            <p className={hintClass}>{formatMinutes(draft.minutes || 0)}</p>
          </div>
        )}
      </Section>

      <Section
        title="Limits"
        hint="Leave empty for no limit. On Omada older than 6.2.10, speed and data limits come from Omada's own portal settings instead."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {limitInput("downKbps", "Download speed", "Mbps", toKbps, toMbps)}
          {limitInput("upKbps", "Upload speed", "Mbps", toKbps, toMbps)}
          {limitInput(
            "dataMb",
            "Data per sign-in",
            "MB",
            (t) => parseInt(t, 10) || null,
            (v) => (v ? String(v) : ""),
          )}
        </div>
      </Section>

      <Section title="After signing in">
        <div>
          <label className={labelClass} htmlFor="redirect">
            Send guests to (optional)
          </label>
          <input
            id="redirect"
            value={draft.redirectUrl}
            onChange={(e) => set({ redirectUrl: e.target.value.trim() })}
            placeholder="https://www.example.com"
            inputMode="url"
            autoCapitalize="none"
            className={inputClass}
          />
          <p className={hintClass}>
            E.g. the client's website or Instagram. Empty: they stay on the
            "connected" page.
          </p>
        </div>
      </Section>
    </>
  );
}

// ---------- The preview ----------

function PhonePreview({ draft, page, onPage }) {
  const pages = [
    ["signin", "Sign-in page"],
    ["success", "After signing in"],
  ];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex rounded-lg border border-line bg-white p-1">
        {pages.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onPage(value)}
            className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
              page === value ? "bg-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-[640px] w-full max-w-[340px] overflow-hidden rounded-[2.5rem] border-[10px] border-ink bg-white shadow-xl">
        <div className="h-full overflow-y-auto">
          <PortalPreview
            key={`${draft.mode}-${page}`}
            site={draft}
            page={page}
            onConnect={() => onPage("success")}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Checking before saving ----------

function problemWith(draft, slugsTaken) {
  if (!draft.name.trim()) return "Give the site a name (Details).";
  if (!draft.controllerId) return "Pick a controller (Details).";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug))
    return "The address name can only have small letters, numbers and dashes (Details).";
  if (slugsTaken.includes(draft.slug))
    return "Another site already uses that address name (Details).";
  if (draft.mode === "form") {
    if (draft.fields.some((f) => !f.label.trim()))
      return "Every question needs words (Sign-in).";
    const list = draft.fields.find(
      (f) => f.type === "choice" && f.options.length === 0,
    );
    if (list) return `"${list.label}" needs at least one choice (Sign-in).`;
  }
  if (!draft.minutes || draft.minutes < 1)
    return "Set how long guests stay on (Access).";
  if (draft.redirectUrl && !/^https?:\/\/\S+\.\S+/.test(draft.redirectUrl))
    return "The address to send guests to should start with https:// (Access).";
  return "";
}

// ---------- The page ----------

// The same settings, whatever order their keys are in
const sorted = (v) =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]))
      : v;
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function SiteEditor({ siteId }) {
  const { sites, currentSite, pickSite, updateSite, deleteSite } = useData();
  const navigate = useNavigate();
  const site = sites.find((s) => s.id === siteId);

  const [draft, setDraft] = useState(() => (site ? structuredClone(site) : null));
  const [tab, setTab] = useState("details");
  const [mobileView, setMobileView] = useState("settings");
  const [previewPage, setPreviewPage] = useState("signin");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const dirty = site && !same(draft, site);
  const slugsTaken = sites.filter((s) => s.id !== siteId).map((s) => s.slug);

  // Opening a site picks it in the site switcher too
  useEffect(() => {
    if (site && currentSite?.id !== site.id) pickSite(site.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!site)
    return (
      <div className="rounded-xl border border-line bg-white px-6 py-14 text-center">
        <p className="font-medium">That site doesn't exist</p>
        <Link to="/sites" className="mt-2 inline-block text-sm font-medium text-brand">
          Back to sites
        </Link>
      </div>
    );

  const set = (changes) => {
    setError("");
    setDraft((d) => ({ ...d, ...changes }));
  };
  const setLook = (changes) => {
    setError("");
    setDraft((d) => ({ ...d, look: { ...d.look, ...changes } }));
  };

  function save() {
    const problem = problemWith(draft, slugsTaken);
    if (problem) return setError(problem);
    document.activeElement?.blur();
    updateSite(site.id, { ...draft, name: draft.name.trim() });
  }

  function remove() {
    deleteSite(site.id);
    navigate("/sites");
  }

  const preview = (
    <PhonePreview draft={draft} page={previewPage} onPage={setPreviewPage} />
  );

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <Link
          to="/sites"
          className="rounded-lg border border-line bg-white p-2.5 text-muted transition hover:border-brand/40 hover:text-brand"
          aria-label="All sites"
        >
          <ArrowLeft size={18} />
        </Link>
        <SiteIcon site={draft} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">
            {draft.name || "Untitled site"}
          </h2>
          <p className="text-sm text-muted">
            {SIGN_IN_MODES[draft.mode].label} · {formatMinutes(draft.minutes || 0)}
            {!draft.active && " · Portal off"}
          </p>
        </div>
      </div>

      {/* Phones and tablets: settings or preview, one at a time */}
      <div className="flex rounded-lg border border-line bg-white p-1 lg:hidden">
        {[
          ["settings", "Settings"],
          ["preview", "Preview"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMobileView(value)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold transition ${
              mobileView === value ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`min-w-0 space-y-4 ${mobileView === "preview" ? "hidden lg:block" : ""}`}>
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-white p-1">
            {TABS.map(({ id, label, icon }) => {
              const Icon = icon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition sm:px-3 ${
                    tab === id
                      ? "bg-brand/10 text-brand"
                      : "text-muted hover:bg-brand/5 hover:text-ink"
                  }`}
                >
                  <Icon size={16} className="hidden sm:block" />
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "details" && (
            <DetailsTab
              site={site}
              draft={draft}
              set={set}
              slugsTaken={slugsTaken}
              onDelete={() => setDeleting(true)}
            />
          )}
          {tab === "signin" && (
            <SignInTab draft={draft} set={set} setLook={setLook} />
          )}
          {tab === "look" && (
            <LookTab draft={draft} setLook={setLook} onPreviewPage={setPreviewPage} />
          )}
          {tab === "access" && <AccessTab draft={draft} set={set} />}
        </div>

        <div className={mobileView === "settings" ? "hidden lg:block" : ""}>
          <div className="lg:sticky lg:top-22">{preview}</div>
        </div>
      </div>

      {/* Save bar: shows while there are unsaved changes */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,27,45,0.08)] backdrop-blur lg:left-65">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center">
            <p className={`flex-1 text-sm ${error ? "text-red-600" : "text-muted"}`}>
              {error || "You have unsaved changes."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setDraft(structuredClone(site));
                }}
                className={`${secondaryButton} flex-1 sm:flex-none`}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                className={`${primaryButton} flex-1 sm:flex-none`}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <Modal
          title={`Delete ${site.name}?`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleting(false)}
                className={secondaryButton}
              >
                Cancel
              </button>
              <button type="button" onClick={remove} className={dangerButton}>
                Delete site
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">
            Its sign-in page stops working, so turn off the external portal in
            the controller too. Nothing else changes on the controller.
          </p>
        </Modal>
      )}
    </div>
  );
}

// The page for /sites/:id. Switching to another site starts fresh
// (key), so one site's unsaved changes never mix into another's.
export default function SiteEditorPage() {
  const { id } = useParams();
  return <SiteEditor key={id} siteId={Number(id)} />;
}