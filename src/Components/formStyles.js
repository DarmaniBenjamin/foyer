// The same look for every form, so they all match. Use them as
// className={inputClass} and so on.

// text-base on phones stops iPhones zooming in when you tap a box
export const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export const hintClass = "mt-1 text-xs text-muted";

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand/90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand/40 hover:bg-brand/5 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

export const dangerButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.97]";