// The Light / Auto / Dark switch: an icon at the top right (a sun, a
// screen or a moon, for the one in use) that opens a small menu. Auto
// follows the device's own setting; Light and Dark stay until you change
// them.
import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getThemeChoice,
  onSystemThemeChange,
  onThemeChoiceChange,
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

  // Picked in another tab: this one follows
  useEffect(
    () =>
      onThemeChoiceChange((value) => {
        setChoice(value);
        applyTheme(value);
      }),
    [],
  );

  function pick(value) {
    setChoice(value);
    saveThemeChoice(value);
  }

  // The menu closes when you click anywhere else, or press Escape
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = CHOICES.find((c) => c.value === choice) ?? CHOICES[1];
  const CurrentIcon = current.icon;

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-ink ${
          open ? "border-brand/40 bg-brand/5 text-ink" : "border-line"
        }`}
      >
        <CurrentIcon size={16} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute top-full left-0 z-40 mt-1.5 w-40 space-y-0.5 rounded-xl border border-line bg-white p-1.5 shadow-lg"
        >
          {CHOICES.map(({ value, label, icon }) => {
            const Icon = icon;
            const active = choice === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  pick(value);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition ${
                  active ? "bg-brand/10 text-brand" : "text-ink hover:bg-brand/5"
                }`}
              >
                <Icon size={15} />
                <span className="flex-1 text-left">{label}</span>
                {active && <Check size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
