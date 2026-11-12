// Colours from the company's website: type the company's website, and
// Foyer shows its brand colours and its logo (server/brandLook.js), plus
// the colours in the logo itself. Nothing changes until you press
// "Use these colours" or "Use this logo"; a site that already has a logo
// keeps it unless you do.
//   look: the site's look now
//   onUse(changes): put { color, background, cardColor } or { logo } into
//     the look (saved with the site's Save, or when the site is made)
//   keep: what to do to keep them ("press Save to keep")
import { useState } from "react";
import { Check, Globe, Palette } from "lucide-react";
import { api } from "../api";
import { textOn } from "../data";
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
  return { color: button, background: dark?.hex ?? tint(button, 0.88), cardColor: "#ffffff" };
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
        on ? "border-transparent ring-2 ring-brand ring-offset-2 ring-offset-white" : "border-black/10 hover:scale-110"
      }`}
      style={{ backgroundColor: hex }}
    >
      {on && <Check size={14} className="absolute inset-0 m-auto" style={{ color: textOn(hex) }} />}
    </button>
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
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                look_up();
              }
            }}
            placeholder="Company website, e.g. mix959fm.com"
            inputMode="url"
            autoCapitalize="none"
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
                            onClick={() => setPicked((p) => ({ ...p, [role]: hex }))}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* A small look at the result */}
                <div
                  className="flex h-44 w-full shrink-0 items-center justify-center rounded-lg border border-line p-4 sm:w-40"
                  style={{ backgroundColor: picked.background }}
                  aria-hidden="true"
                >
                  <div className="w-full max-w-[9rem] space-y-1.5 rounded-lg p-3 shadow-md" style={{ backgroundColor: picked.cardColor }}>
                    {found.logo && <img src={found.logo} alt="" className="mx-auto mb-1 max-h-7 max-w-full object-contain" />}
                    <div className="h-1.5 rounded-full opacity-25" style={{ backgroundColor: textOn(picked.cardColor) }} />
                    <div className="h-5 rounded border border-black/10 bg-white" />
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
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-line bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] p-1.5">
                <img src={found.logo} alt="The logo found" className="max-h-full max-w-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Logo, from {found.logoFrom}</p>
                <p className={hintClass}>
                  {look.logo ? "This site already has a logo; it stays unless you use this one." : "This site has no logo yet."}
                </p>
              </div>
              {used.logo ? (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                  <Check size={15} /> Put in: {keep}
                </span>
              ) : (
                <button type="button" onClick={useLogo} className={secondaryButton}>
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
