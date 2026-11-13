// Colours from the company's website: type the company's website, and
// Foyer shows its brand colours and its logo (server/brandLook.js), plus
// the colours in the logo itself. Nothing changes until you press
// "Use these colours" or "Use this logo"; a site that already has a logo
// keeps it unless you do.
//   look: the site's look now
//   onUse(changes): put { color, background, cardColor, cardOpacity,
//     gradient } or { logo } into
//     the look (saved with the site's Save, or when the site is made)
//   keep: what to do to keep them ("press Save to keep")
import { useState } from "react";
import { Check, Globe, Palette } from "lucide-react";
import { api } from "../api";
import { GRADIENTS, backgroundStyle, textOn } from "../data";
import { shrinkPicture } from "./LogoPicker";
import WifiLoader from "./WifiLoader";
import { hintClass, inputClass, primaryButton, secondaryButton } from "./formStyles";

const hexOf = (r, g, b) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lightness = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const isGrey = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 30 || max < 20 || min > 240;
};
const near = (a, b) => {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 40;
};
// "#d62828" + 0.8 → "rgba(214, 40, 40, 0.8)"
const withOpacity = (hex, opacity) => `rgba(${rgbOf(hex).join(", ")}, ${opacity})`;
// A colour mixed with white (0 = the colour, 1 = white)
const tint = (hex, amount) => hexOf(...rgbOf(hex).map((c) => c + (255 - c) * amount));

// The logo's main colours, from its pixels (not see-through, not grey)
function logoColors(src) {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const px = ctx.getImageData(0, 0, size, size).data;
        const buckets = new Map(); // a rough colour → { r, g, b, n }
        let counted = 0;
        for (let i = 0; i < px.length; i += 4) {
          const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
          if (a < 160 || isGrey(r, g, b)) continue;
          counted++;
          const key = `${r >> 5}${g >> 5}${b >> 5}`;
          const k = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
          k.r += r;
          k.g += g;
          k.b += b;
          k.n++;
          buckets.set(key, k);
        }
        done(
          [...buckets.values()]
            .filter((k) => k.n / Math.max(1, counted) > 0.06)
            .sort((a, b) => b.n - a.n)
            .slice(0, 3)
            .map((k) => ({ hex: hexOf(k.r / k.n, k.g / k.n, k.b / k.n), share: k.n / counted })),
        );
      } catch {
        done([]);
      }
    };
    img.onerror = () => done([]);
    img.src = src;
  });
}

// The colours to choose from, strongest first: the logo's count most,
// then the website's
function palette(siteColors, fromLogo) {
  const top = siteColors[0]?.score || 1;
  const all = [
    ...fromLogo.map((c) => ({ hex: c.hex, score: 12 * c.share + 4, logo: true })),
    ...siteColors.map((c) => ({ hex: c.hex, score: (10 * c.score) / top })),
  ].sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of all) if (!out.some((o) => near(o.hex, c.hex))) out.push(c);
  return out.slice(0, 6);
}

// How bright a colour is (0 = grey, 1 = as bright as it gets)
const vivid = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
};

// What goes where, to start with: the brightest of the main colours on
// the button (it's what guests press), a dark one behind the page if
// there is one (or a light tint of the button's), and a white box
function suggest(colors) {
  const main = colors.slice(0, 3);
  const pick = (c) => c.score * (0.4 + vivid(c.hex)) * (lightness(c.hex) < 0.2 ? 0.5 : 1);
  const button = [...main].sort((a, b) => pick(b) - pick(a))[0]?.hex ?? "#2563eb";
  const dark = colors
    .filter((c) => c.hex !== button && lightness(c.hex) < 0.35)
    .sort((a, b) => b.score - a.score)[0];
  return { color: button, background: dark?.hex ?? tint(button, 0.88), cardColor: "#ffffff", cardOpacity: 1, gradient: null };
}

function Swatch({ hex, on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label ?? hex}
      aria-label={label ?? hex}
      aria-pressed={on}
      className={`relative h-8 w-8 shrink-0 rounded-full border transition ${
        on ? "border-transparent outline-2 outline-offset-2 outline-brand" : "border-line hover:scale-110"
      }`}
      style={{ backgroundColor: hex }}
    >
      {on && <Check size={14} className="absolute inset-0 m-auto" style={{ color: textOn(hex) }} />}
    </button>
  );
}

// The page background's gradient: on or off, the colour it blends into,
// and which way
function GradientPick({ found, picked, pick, choices }) {
  const other = found.colors.find((c) => c.hex !== picked.background && c.hex !== picked.color)?.hex ?? picked.color;
  return (
    <div className="mt-2 space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={Boolean(picked.gradient)}
          onChange={(e) => pick({ gradient: e.target.checked ? { to: other, direction: "diagonal" } : null })}
          className="h-4 w-4 accent-brand"
        />
        Gradient: blend into a second colour
      </label>
      {picked.gradient && (
        <>
          <div className="flex flex-wrap gap-2">
            {choices("background").map((hex) => (
              <Swatch
                key={hex}
                hex={hex}
                on={picked.gradient.to === hex}
                onClick={() => pick({ gradient: { ...picked.gradient, to: hex } })}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(GRADIENTS).map(([value, { label }]) => (
              <button
                key={value}
                type="button"
                onClick={() => pick({ gradient: { ...picked.gradient, direction: value } })}
                className={`h-8 rounded-md border px-2.5 text-xs font-semibold transition ${
                  picked.gradient.direction === value
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-muted hover:border-brand/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const ROLES = [
  ["color", "Button"],
  ["background", "Page background"],
  ["cardColor", "Sign-in box"],
];

export default function BrandFromWebsite({ look, onUse, keep = "press Save to keep" }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(null); // what the website has
  const [picked, setPicked] = useState(null); // { color, background, cardColor }
  const [used, setUsed] = useState({}); // { colors, logo }: pressed
  const pick = (changes) => setPicked((p) => ({ ...p, ...changes }));

  async function look_up() {
    if (!url.trim()) return setError("Enter the company's website, e.g. mix959fm.com");
    setBusy(true);
    setError("");
    setFound(null);
    setUsed({});
    try {
      const site = await api("/sites/brand-look", { method: "POST", body: { url } });
      const fromLogo = site.logo ? await logoColors(site.logo) : [];
      const colors = palette(site.colors, fromLogo);
      setFound({ ...site, colors });
      setPicked(suggest(colors));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function useLogo() {
    const logo = await shrinkPicture(found.logo, "logo");
    if (!logo) return setError("That logo couldn't be used. Download it from the website and upload it under Logo.");
    onUse({ logo });
    setUsed((u) => ({ ...u, logo: true }));
  }

  // The swatches for one part: the website's colours, plus white, a
  // light tint of the button's and dark grey, to go with them
  const choices = (role) => {
    const base = found.colors.map((c) => c.hex);
    const extra = ["#ffffff", tint(picked.color, 0.88), "#111827"];
    const all = role === "color" ? base : [...base, ...extra];
    return [...new Set(all)];
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Globe size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            value={url}
            // No spaces in a web address (autocorrect adds them)
            onChange={(e) => {
              setUrl(e.target.value.replace(/\s+/g, ""));
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                look_up();
              }
            }}
            placeholder="Company website, e.g. mix959fm.com"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="url"
            spellCheck={false}
            aria-label="Company website"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button type="button" onClick={look_up} disabled={busy} className={`${secondaryButton} shrink-0`}>
          {busy ? <WifiLoader size={16} /> : <Palette size={16} />}
          {busy ? "Looking…" : "Get colours"}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {found && picked && (
        <div className="space-y-4 rounded-xl border border-line p-3 sm:p-4">
          <p className="text-sm">
            Found on <b>{found.name}</b>
            {found.colors.length === 0 && ": no brand colours, only greys."}
          </p>

          {found.colors.length > 0 && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="min-w-0 flex-1 space-y-3">
                  {ROLES.map(([role, label]) => (
                    <div key={role}>
                      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
                      <div className="flex flex-wrap gap-2">
                        {choices(role).map((hex) => (
                          <Swatch
                            key={hex}
                            hex={hex}
                            on={picked[role] === hex}
                            onClick={() => pick({ [role]: hex })}
                          />
                        ))}
                      </div>
                      {role === "background" && <GradientPick found={found} picked={picked} pick={pick} choices={choices} />}
                      {role === "cardColor" && (
                        <div className="mt-2">
                          <label htmlFor="brand-opacity" className="flex items-center justify-between text-sm font-medium">
                            See-through box
                            <span className="tabular-nums text-muted">{Math.round((1 - picked.cardOpacity) * 100)}%</span>
                          </label>
                          <input
                            id="brand-opacity"
                            type="range"
                            min="30"
                            max="100"
                            value={Math.round(picked.cardOpacity * 100)}
                            onChange={(e) => pick({ cardOpacity: Number(e.target.value) / 100 })}
                            className="w-full accent-brand"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* A small look at the result */}
                <div
                  className="flex h-48 w-full shrink-0 items-center justify-center self-start rounded-lg border border-line p-4 sm:sticky sm:top-4 sm:w-44"
                  style={backgroundStyle({ background: picked.background, gradient: picked.gradient })}
                  aria-hidden="true"
                >
                  <div
                    className="w-full max-w-[9rem] space-y-1.5 rounded-lg p-3 shadow-md"
                    style={{
                      backgroundColor: withOpacity(picked.cardColor, picked.cardOpacity),
                      backdropFilter: picked.cardOpacity < 1 ? "blur(6px)" : undefined,
                    }}
                  >
                    {found.logo && <img src={found.logo} alt="" className="mx-auto mb-1 max-h-7 max-w-full object-contain" />}
                    <div
                      className="h-1.5 rounded-full opacity-25"
                      style={{ backgroundColor: textOn(picked.cardOpacity < 0.6 ? picked.background : picked.cardColor) }}
                    />
                    {/* Inline colours: the app's dark theme mustn't change them */}
                    <div className="h-5 rounded border border-black/10" style={{ backgroundColor: "#ffffff" }} />
                    <div
                      className="flex h-6 items-center justify-center rounded text-[10px] font-semibold"
                      style={{ backgroundColor: picked.color, color: textOn(picked.color) }}
                    >
                      Connect
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUse({ ...picked });
                    setUsed((u) => ({ ...u, colors: true }));
                  }}
                  className={primaryButton}
                >
                  <Palette size={16} />
                  Use these colours
                </button>
                {used.colors && (
                  <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                    <Check size={15} /> Put in: {keep}
                  </span>
                )}
              </div>
            </>
          )}

          {found.logo && (
            // On a phone the button goes under the logo and its words
            <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-line bg-[length:12px_12px] p-1.5"
                  style={{ backgroundImage: "repeating-conic-gradient(#f3f4f6 0% 25%, #ffffff 0% 50%)" }}
                >
                  <img src={found.logo} alt="The logo found" className="max-h-full max-w-full object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Logo, from {found.logoFrom}</p>
                  <p className={hintClass}>
                    {look.logo ? "This site already has a logo; it stays unless you use this one." : "This site has no logo yet."}
                  </p>
                </div>
              </div>
              {used.logo ? (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                  <Check size={15} /> Put in: {keep}
                </span>
              ) : (
                <button type="button" onClick={useLogo} className={`${secondaryButton} w-full sm:w-auto`}>
                  {look.logo ? "Use this logo instead" : "Use this logo"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
