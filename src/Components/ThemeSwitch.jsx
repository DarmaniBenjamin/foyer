// The Light / Auto / Dark switch in the sidebar. Auto follows the
// device's own setting; Light and Dark stay until you change them.
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getThemeChoice,
  onSystemThemeChange,
  saveThemeChoice,
} from "../theme";

const CHOICES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Auto", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function ThemeSwitch() {
  const [choice, setChoice] = useState(getThemeChoice);

  // On Auto, follow the device when its setting changes (e.g. at night)
  useEffect(() => {
    if (choice !== "system") return;
    return onSystemThemeChange(() => applyTheme("system"));
  }, [choice]);

  function pick(value) {
    setChoice(value);
    saveThemeChoice(value);
  }

  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      {CHOICES.map(({ value, label, icon }) => {
        const Icon = icon;
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(value)}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
              active
                ? "bg-brand/10 text-brand"
                : "text-muted hover:bg-brand/5 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}