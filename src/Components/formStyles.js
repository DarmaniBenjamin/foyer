// The same look for every form, so they all match. Use them as
// className={inputClass} and so on.
//
// Compact like a web app: 36px tall on computers, 40px on phones (easier
// to tap). text-base on phones stops iPhones zooming in when you tap a box.

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-base outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/20 sm:h-9 sm:text-sm";

export const labelClass = "mb-1.5 block text-[13px] font-medium text-ink";

export const hintClass = "mt-1 text-xs text-muted";

const button =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-9";

// Blue, with a soft blue glow (index.css: .btn-primary)
export const primaryButton = `btn-primary ${button} bg-brand text-white hover:brightness-110`;

export const secondaryButton = `${button} border border-line bg-white text-ink hover:border-brand/40 hover:bg-brand/5`;

export const dangerButton = `${button} border border-red-200 bg-white text-red-600 hover:bg-red-50`;
