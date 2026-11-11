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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { BrandBadge, ConnectedMark, SignalBars, SignalChip } from "./PortalMotion";
import WifiLoader from "./WifiLoader";
import { COUNTRIES, NO_TIME_LIMIT, formatMinutes, pageParts, textOn, textStyle } from "../data";

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

// Long words in a box get smaller until they fit (from the size set in
// Site settings → Look → Text, down to 10px), so the box stays the same
// size and the guest can read it all.
const FIT_MIN = 10;
let measurer;
function fitSize(el, text, FIT_MAX) {
  if (!el || !text) return FIT_MAX;
  const css = getComputedStyle(el);
  // Room for the words: the box less its padding (and a list's arrow)
  const room =
    el.clientWidth -
    parseFloat(css.paddingLeft) -
    parseFloat(css.paddingRight) -
    (el.tagName === "SELECT" ? 24 : 2);
  if (room <= 0) return FIT_MAX;
  measurer ??= document.createElement("canvas").getContext("2d");
  measurer.font = `${css.fontStyle} ${css.fontWeight} ${FIT_MAX}px ${css.fontFamily}`;
  const width = measurer.measureText(text).width;
  if (width <= room) return FIT_MAX;
  return Math.max(Math.min(FIT_MIN, FIT_MAX), Math.floor(((FIT_MAX * room) / width) * 2) / 2);
}

function useFitText(text, max) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize(fitSize(el, text, max));
    update();
    const watch = new ResizeObserver(update);
    watch.observe(el);
    return () => watch.disconnect();
  }, [text, max]);
  return [ref, size];
}

// "#171515" + 0.92 → "rgba(23, 21, 21, 0.92)"
function withOpacity(hex, opacity) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

function Question({ field, value, onChange, color, invalid, inside, ink, dial, labelStyle, boxStyle }) {
  const placeholder = inside ? `${field.label}${field.required ? "*" : ""}` : undefined;
  const shown =
    field.type === "choice"
      ? value || (inside ? placeholder : "Choose one")
      : field.type === "phone"
        ? value?.number || placeholder
        : value || placeholder;
  const [fitRef, fit] = useFitText(field.type === "checkbox" ? "" : String(shown ?? ""), boxStyle.fontSize);
  // Typed words shrink themselves; an empty box shrinks only its hint
  const fitStyle =
    field.type !== "choice" && !(field.type === "phone" ? value?.number : value)
      ? { ...boxStyle, "--hint-size": `${fit}px` }
      : { ...boxStyle, fontSize: fit };
  const box = `portal-field h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-current ${
    invalid ? "border-red-400 ring-2 ring-red-400/40" : "border-black/10"
  }`;
  const label = !inside && (
    <span className="mb-1 block text-sm font-medium" style={{ ...labelStyle, color: ink }}>
      {field.label || "Untitled question"}
      {field.required && <span className="text-red-500"> *</span>}
    </span>
  );

  if (field.type === "checkbox")
    return (
      <label className="flex items-start gap-2 text-left text-sm" style={{ ...labelStyle, color: ink }}>
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
          ref={fitRef}
          className={box}
          style={{ ...fitStyle, color: value ? "#111827" : "#6b7280" }}
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
            className="portal-field h-11 w-24 shrink-0 rounded-xl border border-black/10 bg-white px-2 text-sm text-gray-900 outline-none"
            style={{ ...boxStyle, fontSize: Math.min(boxStyle.fontSize, 16) }}
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
            ref={fitRef}
            className={box}
            style={fitStyle}
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
        ref={fitRef}
        className={box}
        style={fitStyle}
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

// After signing in, the Wi-Fi takes a few seconds to let the phone out
// to the internet. Until the page "Continue" goes to can be reached, the
// button says "Getting you online…" instead of doing nothing when tapped.
// Gives up waiting after 45 seconds (then Continue just tries).
function useOnline(waiting, url) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const started = Date.now();
    async function tryOnce() {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 3000);
      try {
        // no-cors: only whether it answers matters, not what it says
        await fetch(url, { mode: "no-cors", cache: "no-store", signal: abort.signal });
        if (!stopped) setOnline(true);
        return;
      } catch {
        // Not out yet
      } finally {
        clearTimeout(timer);
      }
      if (stopped) return;
      if (Date.now() - started > 45_000) return setOnline(true);
      setTimeout(tryOnce, 1000);
    }
    tryOnce();
    return () => {
      stopped = true;
    };
  }, [waiting, url]);
  return !waiting || online;
}

// The guest page's loading screen, over everything: while signing in
// (until the splash ad), and while going on to the site's address
function LoadingScreen({ color, text, detail }) {
  return (
    <div
      className="fade-in fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="pop-in flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white px-6 py-8 text-center shadow-2xl">
        <span style={{ color }}>
          <WifiLoader size={64} />
        </span>
        <p className="mt-1 text-base font-semibold text-gray-900">{text}</p>
        {detail && <p className="text-sm text-gray-500">{detail}</p>}
      </div>
    </div>
  );
}

const hostOf = (address) => {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// onSignIn({ answers, code }) → { error } or { minutes }: the guest page.
// onConnect(): the editor's preview (just shows the "connected" page).
// paused: a splash ad is on screen (the guest page), so don't go on yet.
export default function PortalPreview({
  site,
  page = "signin",
  onSignIn,
  onConnect,
  fullPage = false,
  paused = false,
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
  // What the Wi-Fi signs show: waiting, connecting, connected
  const signal = success ? "on" : busy ? "connecting" : "search";
  // A real guest (not a test or the editor's preview) waits for the
  // Wi-Fi to let them out before Continue works
  const online = useOnline(
    Boolean(fullPage && result && !result.test && site.redirectUrl),
    site.redirectUrl,
  );

  // iPhones zoom in on a box with words smaller than 16px when it's
  // tapped, and stay zoomed in. On the guest page, tell them not to (a
  // guest can still pinch to zoom).
  useEffect(() => {
    if (!fullPage || !/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && !/maximum-scale/.test(meta.content)) meta.content += ", maximum-scale=1";
  }, [fullPage]);

  // Site settings → Access: no "You're connected" page. Once the guest is
  // online and any splash ad is over, they go straight to the address.
  const goStraightOn = fullPage && site.showConnected === false && Boolean(site.redirectUrl);
  useEffect(() => {
    if (goStraightOn && result && !paused && online) window.location.replace(site.redirectUrl);
  }, [goStraightOn, result, paused, online, site.redirectUrl]);

  const cardColor = look.cardColor ?? "#ffffff";
  // Text on the box: dark on a light box, white on a dark one
  const ink = textOn(cardColor) === "#ffffff" ? "#ffffff" : "#111827";
  const soft = ink === "#ffffff" ? "rgba(255,255,255,0.8)" : "#4b5563";
  const buttonStyle = { backgroundColor: look.color, color: textOn(look.color) };
  // The size, bold and italic of the words (Site settings → Look → Text)
  const words = {
    heading: textStyle(look, "heading"),
    message: textStyle(look, "message"),
    labels: textStyle(look, "labels"),
    boxes: textStyle(look, "boxes"),
    button: { ...buttonStyle, ...textStyle(look, "button") },
    footer: textStyle(look, "footer"),
  };
  const dial =
    COUNTRIES.find((c) => c.code === site.countryCode)?.dial ?? COUNTRIES[0].dial;
  const inside = look.labels === "inside";
  // What's on the page, in the admin's order (Site settings → Look)
  const parts = pageParts(look);
  const showing = (id) => parts.some((p) => p.id === id && p.show);
  const logoShown = Boolean(look.logo) && showing("logo");
  const logo = logoShown && (
    <img
      src={look.logo}
      alt={site.name}
      className="mx-auto object-contain"
      style={{ maxHeight: look.logoSize ?? 80, maxWidth: "100%" }}
    />
  );
  const bgX = look.bgX ?? 50;
  const bgY = look.bgY ?? 50;
  const align = { top: "justify-start", bottom: "justify-end" }[look.cardPosition] ?? "justify-center";

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

  // The loading screen (guest page only): signing in, then going on
  const loading = !fullPage
    ? null
    : busy
      ? { text: "Connecting you…", detail: `${site.name} Wi-Fi` }
      : goStraightOn && result && !paused
        ? { text: `Taking you to ${hostOf(site.redirectUrl) || "the website"}…`, detail: "You're connected." }
        : null;

  return (
    <div
      data-portal
      className={`relative flex flex-col items-center overflow-hidden px-4 ${align} ${fullPage ? "min-h-dvh py-10" : "min-h-full py-8"}`}
      style={{ "--portal-color": look.color, backgroundColor: look.background }}
    >
      {look.backgroundImage && (
        // The picture, zoomed in on and moved as set in Site settings → Look
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${look.backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: `${bgX}% ${bgY}%`,
            transform: `scale(${look.bgZoom ?? 1})`,
            transformOrigin: `${bgX}% ${bgY}%`,
          }}
        />
      )}
      {look.backgroundImage && look.bgDim > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${look.bgDim})` }}
        />
      )}
      <div className="portal-glow pointer-events-none absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full" />
      <div
        // key: the card comes in again when it changes to "connected"
        key={success ? "on" : "form"}
        className="portal-card relative w-full max-w-sm rounded-3xl p-6 text-center shadow-xl shadow-black/10"
        style={{
          backgroundColor: withOpacity(cardColor, look.cardOpacity ?? 1),
          backdropFilter: (look.cardOpacity ?? 1) < 1 ? "blur(6px)" : undefined,
          WebkitBackdropFilter: (look.cardOpacity ?? 1) < 1 ? "blur(6px)" : undefined,
        }}
      >
        {success ? (
          <div className="portal-stagger">
            {logoShown && (
              <div className="mb-5 flex flex-col items-center gap-3">
                {logo}
                {showing("wifi") && <SignalChip state={signal} color={look.color} ink={soft} />}
              </div>
            )}
            <ConnectedMark color={look.color} />
            <h1 className="text-xl font-semibold" style={{ ...words.heading, fontSize: Math.round(words.heading.fontSize * 0.85), color: ink }}>
              {site.name}
            </h1>
            <p className="mt-2 text-sm whitespace-pre-line" style={{ ...words.message, color: soft }}>
              {look.success}
            </p>
            {result?.minutes && (
              <p className="mt-3 text-xs" style={{ color: soft }}>
                {result.minutes >= NO_TIME_LIMIT
                  ? "You're on, with no time limit."
                  : `You're on for ${formatMinutes(result.minutes)}.`}
              </p>
            )}
            {goStraightOn && result ? (
              <div
                role="status"
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold opacity-80"
                style={words.button}
              >
                <WifiLoader size={20} />
                Taking you on…
              </div>
            ) : site.redirectUrl &&
              (online ? (
                <a
                  href={site.redirectUrl}
                  className="pop-in mt-5 flex min-h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold"
                  style={words.button}
                >
                  Continue
                </a>
              ) : (
                <div
                  role="status"
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold opacity-80"
                  style={words.button}
                >
                  <WifiLoader size={20} />
                  Getting you online…
                </div>
              ))}
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="portal-stagger flex flex-col gap-3">
            {parts.filter((p) => p.show).map((p) => {
              if (p.id === "logo") return logo ? <div key="logo">{logo}</div> : null;
              if (p.id === "wifi")
                return (
                  <div key="wifi" className="flex justify-center">
                    {logoShown ? (
                      <SignalChip state={signal} color={look.color} ink={soft} />
                    ) : (
                      <BrandBadge style={buttonStyle} state={signal} />
                    )}
                  </div>
                );
              if (p.id === "heading")
                return look.heading ? (
                  <h1 key="heading" className="text-2xl font-semibold" style={{ ...words.heading, color: ink }}>
                    {look.heading}
                  </h1>
                ) : null;
              if (p.id === "message")
                return look.message ? (
                  <p key="message" className="-mt-1 text-sm whitespace-pre-line" style={{ ...words.message, color: soft }}>
                    {look.message}
                  </p>
                ) : null;
              if (p.id === "footer")
                return look.footer ? (
                  <p key="footer" className="text-xs" style={{ ...words.footer, color: soft }}>
                    {look.footer}
                  </p>
                ) : null;
              return (
                <div key="form" className="py-2">
                  <div className="space-y-3 text-left">
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
                          labelStyle={words.labels}
                          boxStyle={words.boxes}
                        />
                      ))}

                    {site.mode === "voucher" && (
                      <label className="block">
                        {!inside && (
                          <span className="mb-1 block text-sm font-medium" style={{ ...words.labels, color: ink }}>
                            Voucher code
                          </span>
                        )}
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          className={`portal-field h-11 w-full rounded-xl border bg-white px-3 text-center font-mono text-sm tracking-widest text-gray-900 uppercase outline-none ${
                            problem?.bad.has("_code") ? "border-red-400 ring-2 ring-red-400/40" : "border-black/10"
                          }`}
                          style={words.boxes}
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
                        <label className="flex items-start gap-2 text-sm" style={{ ...words.labels, color: ink }}>
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
                    className="portal-button mt-5 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold transition hover:brightness-105 active:scale-[0.98] disabled:opacity-90"
                    style={words.button}
                  >
                    {busy && <SignalBars />}
                    {busy ? "Connecting…" : look.button || "Connect"}
                  </button>
                </div>
              );
            })}
          </form>
        )}

        {success && look.footer && showing("footer") && (
          <p className="mt-4 text-xs" style={{ ...words.footer, color: soft }}>
            {look.footer}
          </p>
        )}
      </div>
      {loading && <LoadingScreen color={look.color} text={loading.text} detail={loading.detail} />}
    </div>
  );
}