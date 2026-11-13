// The light / dark button at the top right. It starts out the way the
// phone or computer is set (light or dark), and each press switches to
// the other one, which then stays (after a reload, and in other tabs)
// until it's pressed again. It shows a moon in light mode (press for
// dark) and a sun in dark mode (press for light).
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
  const Icon = dark ? Sun : Moon;

  function toggle() {
    const next = dark ? "light" : "dark";
    setChoice(next);
    saveThemeChoice(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-ink"
    >
      <Icon size={16} />
    </button>
  );
}
