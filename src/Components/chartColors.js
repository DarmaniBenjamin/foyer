// The charts' colours: the app's own (they follow light and dark mode),
// and fixed light ones for the pictures in the Word report.
//
// The sign-ins graph splits each day into New guests (green) and
// Returning guests (blue), like Spotipo's. Both pairs were checked to
// stay easy to tell apart, also for colour-blind readers.

export const APP_COLORS = {
  bar: "var(--color-brand)",
  hover: "color-mix(in oklab, var(--color-brand) 75%, white)",
  grid: "var(--color-line)",
  text: "var(--color-muted)",
  gap: "var(--color-card)",
  series: {
    new: "light-dark(#1baf7a, #199e70)",
    returning: "var(--color-brand)",
  },
};

export const PRINT_COLORS = {
  bar: "#1d64d8",
  hover: "#1d64d8",
  grid: "#e3e8f0",
  text: "#5f6b7d",
  gap: "#ffffff",
  series: {
    new: "#1baf7a",
    returning: "#1d64d8",
  },
};

// New on top of Returning, in this order in the legend
export const GUEST_SERIES = [
  { key: "new", name: "New guests" },
  { key: "returning", name: "Returning guests" },
];