// The light / dark button at the top right. It starts out the way the
// phone or computer is set (light or dark), and each press switches to
// the other one, which then stays (after a reload, and in other tabs)
// until it's pressed again. It shows a moon in light mode (press for
// dark) and a sun in dark mode (press for light).
//
// The animations: on hover the button lifts and glows and its icon turns
// a little; on a press the sun and moon swap, one spinning out as the
// other spins in, and a circle of the new theme's colour grows from the
// button over the page. Under it the theme changes (the one costly
// redraw, hidden), then the circle fades away. The circle is drawn once,
// small, and only enlarged and faded (which the graphics chip does by
// itself, without redrawing the page), so it stays smooth on slow
// computers and big screens. With "reduce motion" on, it just changes.
// See .theme-* in index.css.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getThemeChoice,
  onSystemThemeChange,
  onThemeChoiceChange,
  resolveTheme,
  saveThemeChoice,
} from "../theme";

const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Each theme's page colour (--color-page in index.css)
const PAGE = { light: "#f7f8fa", dark: "#000000" };
const GROW_MS = 450;
const FADE_MS = 320;
// The circle's size when drawn (px across); it's enlarged from there
const DRAWN = 64;

export default function ThemeSwitch() {
  const [choice, setChoice] = useState(getThemeChoice);
  // What's showing now: "light" or "dark"
  const [shown, setShown] = useState(() => resolveTheme(getThemeChoice()));

  // Not pressed yet: follow the device when its setting changes (e.g. at night)
  useEffect(() => {
    setShown(resolveTheme(choice));
    if (choice !== "system") return undefined;
    return onSystemThemeChange(() => {
      applyTheme("system");
      setShown(resolveTheme("system"));
    });
  }, [choice]);

  // Pressed in another tab: this one follows
  useEffect(
    () =>
      onThemeChoiceChange((value) => {
        setChoice(value);
        applyTheme(value);
      }),
    [],
  );

  const dark = shown === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  const [busy, setBusy] = useState(false);

  function toggle(e) {
    if (busy) return;
    const next = dark ? "light" : "dark";
    const root = document.documentElement;
    const change = () => {
      // No colour fades while the whole page changes colour
      root.classList.add("theme-switching");
      setChoice(next);
      setShown(next);
      saveThemeChoice(next);
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
    };
    if (calm() || !Element.prototype.animate) return change();

    // A small circle of the new colour on the middle of the button,
    // enlarged until it reaches the far corner of the screen
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.round(box.left + box.width / 2);
    const y = Math.round(box.top + box.height / 2);
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const circle = document.createElement("div");
    circle.className = "theme-circle";
    Object.assign(circle.style, {
      left: `${x - DRAWN / 2}px`,
      top: `${y - DRAWN / 2}px`,
      width: `${DRAWN}px`,
      height: `${DRAWN}px`,
      backgroundColor: PAGE[next],
    });
    document.body.appendChild(circle);
    setBusy(true);

    const grow = circle.animate(
      { transform: ["scale(0)", `scale(${Math.ceil((reach * 2) / DRAWN) + 1})`] },
      { duration: GROW_MS, easing: "cubic-bezier(0.55, 0, 0.45, 1)", fill: "forwards" },
    );
    grow.finished
      .then(() => {
        // Covered: change the theme underneath, then let it show through
        change();
        return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      })
      .then(() => circle.animate({ opacity: [1, 0] }, { duration: FADE_MS, easing: "ease-out", fill: "forwards" }).finished)
      .catch(() => change())
      .finally(() => {
        circle.remove();
        setBusy(false);
      });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="theme-button group relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line text-muted transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/5 hover:text-ink hover:shadow-md hover:shadow-brand/20 active:translate-y-0 active:scale-90 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Both icons, one on top of the other: the one not in use is turned away and shrunk to nothing */}
      <Sun
        size={17}
        aria-hidden="true"
        className={`theme-icon absolute ${dark ? "theme-icon-on text-amber-400" : "theme-icon-off"}`}
      />
      <Moon
        size={16}
        aria-hidden="true"
        className={`theme-icon absolute ${dark ? "theme-icon-off" : "theme-icon-on text-indigo-500"}`}
      />
    </button>
  );
}
