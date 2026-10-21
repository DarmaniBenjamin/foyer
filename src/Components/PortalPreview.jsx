// What guests see on their phone when they join a site's Wi-Fi: the
// sign-in page, then the "connected" page.
// - In the Sites editor it's the live preview (page = "signin" or
//   "success", picked with the buttons above it).
// - On the guest page (/p/<site>) it's the real thing (fullPage).
// Both check the form the same way: required questions, a real email
// (and, if the site asks, not a misspelt domain like gmial.com), the
// terms ticked, a voucher code typed.
// It always looks like the site's own design (data-portal, see
// index.css), whatever the admin site's light or dark mode is.
import { useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Wifi } from "lucide-react";
import { COUNTRIES, formatMinutes, textOn } from "../data";

const validEmail = (text) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text);

// Misspelt email domains guests often type → what they meant
const DOMAIN_TYPOS = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "icloud.co": "icloud.com",
  "iclod.com": "icloud.com",
  "ail.com": "aol.com or gmail.com",
  "live.co": "live.com",
};

// "#171515" + 0.92 → "rgba(23, 21, 21, 0.92)"
function withOpacity(hex, opacity) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

function Question({ field, value, onChange, color, invalid, inside, ink, dial }) {
  const placeholder = inside ? `${field.label}${field.required ? "*" : ""}` : undefined;
  const box = `h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:border-current ${
    invalid ? "border-red-400 ring-2 ring-red-400/40" : "border-black/10"
  }`;
  const label = !inside && (
    <span className="mb-1 block text-sm font-medium" style={{ color: ink }}>
      {field.label || "Untitled question"}
      {field.required && <span className="text-red-500"> *</span>}
    </span>
  );

  if (field.type === "checkbox")
    return (
      <label className="flex items-start gap-2 text-left text-sm" style={{ color: ink }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor: color }}
        />
        <span className={invalid ? "underline decoration-red-400 decoration-2" : ""}>
          {field.label || "Untitled question"}
          {field.required && <span className="text-red-500"> *</span>}
        </span>
      </label>
    );

  if (field.type === "choice")
    return (
      <label className="block">
        {label}
        <select
          className={box}
          style={{ color: value ? "#111827" : "#6b7280" }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {inside ? placeholder : "Choose one"}
          </option>
          {field.options.map((option) => (
            <option key={option} style={{ color: "#111827" }}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );

  if (field.type === "phone")
    return (
      <label className="block">
        {label}
        <div className="flex gap-2">
          <select
            value={value?.dial ?? dial}
            onChange={(e) => onChange({ dial: e.target.value, number: value?.number ?? "" })}
            className="h-11 w-24 shrink-0 rounded-xl border border-black/10 bg-white px-2 text-base text-gray-900 outline-none"
            aria-label="Country code"
          >
            {[...new Set(COUNTRIES.map((c) => c.dial))].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={placeholder}
            value={value?.number ?? ""}
            onChange={(e) => onChange({ dial: value?.dial ?? dial, number: e.target.value })}
            className={box}
          />
        </div>
      </label>
    );

  return (
    <label className="block">
      {label}
      <input
        type={field.type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={
          field.type === "email"
            ? "email"
            : field.key === "first_name"
              ? "given-name"
              : field.key === "last_name"
                ? "family-name"
                : "off"
        }
        autoCapitalize={field.type === "email" ? "none" : undefined}
        className={box}
      />
    </label>
  );
}

const phoneDigits = (v) => String(v?.number ?? "").replace(/\D/g, "");

// What's missing or wrong → { message, bad: Set of field keys }.
// Missing answers are reported first, then wrongly typed ones.
function check(site, answers, code, termsOk) {
  const bad = new Set();
  const missing = [];
  const isEmpty = (f, v) =>
    f.type === "checkbox"
      ? !v
      : f.type === "phone"
        ? !phoneDigits(v)
        : !String(v ?? "").trim();

  if (site.mode === "form")
    for (const f of site.fields)
      if (f.required && isEmpty(f, answers[f.key])) {
        bad.add(f.key);
        missing.push(f.label);
      }
  if (site.mode === "voucher" && !code.trim()) {
    bad.add("_code");
    missing.push("Voucher code");
  }
  if (missing.length) return { message: `Please fill in: ${missing.join(", ")}.`, bad };

  if (site.mode === "form")
    for (const f of site.fields) {
      const v = answers[f.key];
      if (isEmpty(f, v)) continue;
      if (f.type === "email") {
        const email = String(v).trim().toLowerCase();
        if (!validEmail(email))
          return { message: "That email address doesn't look right.", bad: new Set([f.key]) };
        const domain = email.split("@")[1];
        if (site.verifyEmailDomain && DOMAIN_TYPOS[domain])
          return {
            message: `Check your email: did you mean @${DOMAIN_TYPOS[domain]}?`,
            bad: new Set([f.key]),
          };
      }
      if (f.type === "phone" && phoneDigits(v).length < 7)
        return { message: "That phone number looks too short.", bad: new Set([f.key]) };
    }

  if (site.requireTerms && !termsOk)
    return { message: "Please accept the terms of use to connect.", bad: new Set(["_terms"]) };
  return null;
}

// onSignIn({ answers, code }) → { error } or { minutes }: the guest page.
// onConnect(): the editor's preview (just shows the "connected" page).
export default function PortalPreview({
  site,
  page = "signin",
  onSignIn,
  onConnect,
  fullPage = false,
}) {
  const { look } = site;
  const [answers, setAnswers] = useState({});
  const [code, setCode] = useState("");
  const [termsOk, setTermsOk] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // after signing in
  const success = page === "success" || result;

  const cardColor = look.cardColor ?? "#ffffff";
  // Text on the box: dark on a light box, white on a dark one
  const ink = textOn(cardColor) === "#ffffff" ? "#ffffff" : "#111827";
  const soft = ink === "#ffffff" ? "rgba(255,255,255,0.8)" : "#4b5563";
  const buttonStyle = { backgroundColor: look.color, color: textOn(look.color) };
  const dial =
    COUNTRIES.find((c) => c.code === site.countryCode)?.dial ?? COUNTRIES[0].dial;
  const inside = look.labels === "inside";

  async function submit(e) {
    e.preventDefault();
    const found = check(site, answers, code, termsOk);
    setProblem(found);
    if (found) return;
    setBusy(true);
    // Only the answers to the current questions, tidied up
    const clean = {};
    if (site.mode === "form")
      for (const f of site.fields) {
        const v = answers[f.key];
        if (f.type === "checkbox") clean[f.key] = Boolean(v);
        else if (f.type === "phone")
          clean[f.key] = phoneDigits(v) ? `${v?.dial ?? dial} ${v.number.trim()}` : "";
        else if (f.type === "email") clean[f.key] = String(v ?? "").trim().toLowerCase();
        else clean[f.key] = String(v ?? "").trim();
      }
    if (!onSignIn) {
      setBusy(false);
      return onConnect?.();
    }
    const outcome = (await onSignIn({ answers: clean, code: code.trim() })) ?? {};
    setBusy(false);
    if (outcome.error) setProblem({ message: outcome.error, bad: new Set(["_code"]) });
    else setResult(outcome);
  }

  return (
    <div
      data-portal
      className={`flex flex-col items-center px-4 ${fullPage ? "min-h-dvh justify-center py-10" : "min-h-full py-8"}`}
      style={{
        backgroundColor: look.background,
        backgroundImage: look.backgroundImage ? `url(${look.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 text-center shadow-xl shadow-black/10"
        style={{
          backgroundColor: withOpacity(cardColor, look.cardOpacity ?? 1),
          backdropFilter: (look.cardOpacity ?? 1) < 1 ? "blur(6px)" : undefined,
          WebkitBackdropFilter: (look.cardOpacity ?? 1) < 1 ? "blur(6px)" : undefined,
        }}
      >
        <div className="mb-5 flex justify-center">
          {look.logo ? (
            <img
              src={look.logo}
              alt={site.name}
              className="max-h-20 max-w-[80%] object-contain"
            />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={buttonStyle}
            >
              <Wifi size={28} />
            </span>
          )}
        </div>

        {success ? (
          <div>
            <CircleCheck size={44} className="mx-auto mb-3" style={{ color: look.color }} />
            <h1 className="text-xl font-semibold" style={{ color: ink }}>
              {site.name}
            </h1>
            <p className="mt-2 text-sm whitespace-pre-line" style={{ color: soft }}>
              {look.success}
            </p>
            {result?.minutes && (
              <p className="mt-3 text-xs" style={{ color: soft }}>
                You're on for {formatMinutes(result.minutes)}.
              </p>
            )}
            {site.redirectUrl && (
              <a
                href={site.redirectUrl}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold"
                style={buttonStyle}
              >
                Continue
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="text-2xl font-semibold" style={{ color: ink }}>
              {look.heading}
            </h1>
            {look.message && (
              <p className="mt-2 text-sm whitespace-pre-line" style={{ color: soft }}>
                {look.message}
              </p>
            )}

            <div className="mt-5 space-y-3 text-left">
              {site.mode === "form" &&
                site.fields.map((field) => (
                  <Question
                    key={field.key}
                    field={field}
                    value={answers[field.key]}
                    invalid={problem?.bad.has(field.key)}
                    onChange={(v) => setAnswers((a) => ({ ...a, [field.key]: v }))}
                    color={look.color}
                    inside={inside}
                    ink={ink}
                    dial={dial}
                  />
                ))}

              {site.mode === "voucher" && (
                <label className="block">
                  {!inside && (
                    <span className="mb-1 block text-sm font-medium" style={{ color: ink }}>
                      Voucher code
                    </span>
                  )}
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`h-11 w-full rounded-xl border bg-white px-3 text-center font-mono text-base tracking-widest text-gray-900 uppercase outline-none ${
                      problem?.bad.has("_code") ? "border-red-400 ring-2 ring-red-400/40" : "border-black/10"
                    }`}
                    placeholder={inside ? "Voucher code" : "ABCD-1234"}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
              )}

              {site.requireTerms && (
                <div>
                  <label className="flex items-start gap-2 text-sm" style={{ color: ink }}>
                    <input
                      type="checkbox"
                      checked={termsOk}
                      onChange={(e) => setTermsOk(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ accentColor: look.color }}
                    />
                    <span
                      className={
                        problem?.bad.has("_terms") ? "underline decoration-red-400 decoration-2" : ""
                      }
                    >
                      I accept the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms((s) => !s)}
                        className="font-semibold underline"
                      >
                        terms of use
                      </button>
                    </span>
                  </label>
                  {showTerms && (
                    <p className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-white/90 p-3 text-xs whitespace-pre-line text-gray-700">
                      {look.terms}
                    </p>
                  )}
                </div>
              )}
            </div>

            {problem && (
              <p className="mt-4 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-left text-sm text-red-700">
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                {problem.message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition active:scale-[0.98] disabled:opacity-70"
              style={buttonStyle}
            >
              {busy && <LoaderCircle size={18} className="animate-spin" />}
              {look.button || "Connect"}
            </button>
          </form>
        )}

        {look.footer && (
          <p className="mt-4 text-xs" style={{ color: soft }}>
            {look.footer}
          </p>
        )}
      </div>
    </div>
  );
}