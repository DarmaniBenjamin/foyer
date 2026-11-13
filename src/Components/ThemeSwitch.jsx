// The light / dark button at the top right. It starts out the way the
// phone or computer is set (light or dark), and each press switches to
// the other one, which then stays (after a reload, and in other tabs)
// until it's pressed again. It shows a moon in light mode (press for
// dark) and a sun in dark mode (press for light).
//
// The animations: on hover the button lifts and glows and its icon turns
// a little; on a press the sun and moon swap, one spinning out as the
// other spins in, and the new theme spreads over the page in a circle
// from the button (the browser's View Transitions; without them, or with
// "reduce motion" on, it just changes). See .theme-* in index.css.
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
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

  function toggle(e) {
    const next = dark ? "light" : "dark";
    const change = () => {
      // Straight away, so the new page picture has the new icon in it
      flushSync(() => {
        setChoice(next);
        setShown(next);
      });
      saveThemeChoice(next);
    };
    if (!document.startViewTransition || calm()) return change();

    // The circle grows from the middle of the button to the far corner
    const box = e.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add("theme-switching");
    const switching = document.startViewTransition(change);
    switching.ready
      .then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
          { duration: 650, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
    switching.finished.finally(() => document.documentElement.classList.remove("theme-switching"));
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
