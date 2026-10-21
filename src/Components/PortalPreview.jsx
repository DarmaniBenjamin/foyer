// What guests see on their phone when they join a site's Wi-Fi: the
// sign-in page, then the "connected" page.
// - In the Sites editor it's the live preview (page = "signin" or
//   "success", picked with the buttons above it).
// - On the guest page (/p/<site>) it's the real thing (fullPage).
// Both check the form the same way: required questions, a real email,
// the terms ticked, a voucher code typed.
// It always looks light (data-portal, see index.css), like it does on
// guests' phones.
import { useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Wifi } from "lucide-react";
import { formatMinutes, textOn } from "../data";

const validEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

function Question({ field, value, onChange, color, invalid }) {
  const box = `h-11 w-full rounded-xl border bg-white px-3 text-base text-gray-900 outline-none focus:border-current ${
    invalid ? "border-red-400" : "border-black/10"
  }`;
  const label = (
    <span className="mb-1 block text-sm font-medium text-gray-800">
      {field.label || "Untitled question"}
      {field.required && <span className="text-red-500"> *</span>}
    </span>
  );

  if (field.type === "checkbox")
    return (
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4"
          style={{ accentColor: color }}
        />
        <span className={invalid ? "text-red-600" : ""}>
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
          style={{ color: "#111827" }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Choose one
          </option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );

  return (
    <label className="block">
      {label}
      <input
        type={field.type === "phone" ? "tel" : field.type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={
          field.type === "email"
            ? "email"
            : field.key === "first_name"
              ? "given-name"
              : field.key === "last_name"
                ? "family-name"
                : field.type === "phone"
                  ? "tel"
                  : "off"
        }
        className={box}
        style={{ color: "#111827" }}
      />
    </label>
  );
}

// What's missing or wrong → { message, bad: Set of field keys }
function check(site, answers, code, termsOk) {
  const bad = new Set();
  const missing = [];
  if (site.mode === "form") {
    for (const f of site.fields) {
      const v = answers[f.key];
      const empty = f.type === "checkbox" ? !v : !String(v ?? "").trim();
      if (f.required && empty) {
        bad.add(f.key);
        missing.push(f.label);
      } else if (f.type === "email" && !empty && !validEmail(String(v).trim())) {
        bad.add(f.key);
        return { message: "That email address doesn't look right.", bad };
      } else if (f.type === "phone" && !empty && String(v).replace(/\D/g, "").length < 7) {
        bad.add(f.key);
        return { message: "That phone number looks too short.", bad };
      }
    }
  }
  if (site.mode === "voucher" && !code.trim()) {
    bad.add("_code");
    missing.push("Voucher code");
  }
  if (missing.length) return { message: `Please fill in: ${missing.join(", ")}.`, bad };
  if (site.requireTerms && !termsOk) {
    bad.add("_terms");
    return { message: "Please accept the terms of use to connect.", bad };
  }
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
  const buttonStyle = { backgroundColor: look.color, color: textOn(look.color) };
  const success = page === "success" || result;

  async function submit(e) {
    e.preventDefault();
    const found = check(site, answers, code, termsOk);
    setProblem(found);
    if (found) return;
    setBusy(true);
    // Only the answers to the current questions, tidied up
    const clean = {};
    if (site.mode === "form")
      for (const f of site.fields)
        clean[f.key] =
          f.type === "checkbox" ? Boolean(answers[f.key]) : String(answers[f.key] ?? "").trim();
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
      style={{ backgroundColor: look.background }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg shadow-black/5">
        <div className="mb-5 flex justify-center">
          {look.logo ? (
            <img
              src={look.logo}
              alt={site.name}
              className="max-h-20 max-w-[70%] object-contain"
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
          <div className="text-center">
            <CircleCheck
              size={44}
              className="mx-auto mb-3"
              style={{ color: look.color }}
            />
            <h1 className="text-xl font-semibold text-gray-900">
              {site.name}
            </h1>
            <p className="mt-2 text-sm whitespace-pre-line text-gray-600">
              {look.success}
            </p>
            {result?.minutes && (
              <p className="mt-3 text-xs text-gray-500">
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
            <h1 className="text-center text-xl font-semibold text-gray-900">
              {look.heading}
            </h1>
            {look.message && (
              <p className="mt-2 text-center text-sm whitespace-pre-line text-gray-600">
                {look.message}
              </p>
            )}

            <div className="mt-5 space-y-3">
              {site.mode === "form" &&
                site.fields.map((field) => (
                  <Question
                    key={field.key}
                    field={field}
                    value={answers[field.key]}
                    invalid={problem?.bad.has(field.key)}
                    onChange={(v) => setAnswers((a) => ({ ...a, [field.key]: v }))}
                    color={look.color}
                  />
                ))}

              {site.mode === "voucher" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-800">
                    Voucher code
                  </span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`h-11 w-full rounded-xl border bg-white px-3 text-center font-mono text-base tracking-widest text-gray-900 uppercase outline-none ${
                      problem?.bad.has("_code") ? "border-red-400" : "border-black/10"
                    }`}
                    placeholder="ABCD-1234"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
              )}

              {site.requireTerms && (
                <div>
                  <label
                    className={`flex items-start gap-2 text-sm ${
                      problem?.bad.has("_terms") ? "text-red-600" : "text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={termsOk}
                      onChange={(e) => setTermsOk(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                      style={{ accentColor: look.color }}
                    />
                    <span>
                      I accept the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms((s) => !s)}
                        className="font-medium underline"
                        style={{ color: look.color }}
                      >
                        terms of use
                      </button>
                    </span>
                  </label>
                  {showTerms && (
                    <p className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-3 text-xs whitespace-pre-line text-gray-600">
                      {look.terms}
                    </p>
                  )}
                </div>
              )}
            </div>

            {problem && (
              <p className="mt-4 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
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
      </div>
      <p className="mt-6 text-xs text-gray-500">Free Wi-Fi · {site.name}</p>
    </div>
  );
}