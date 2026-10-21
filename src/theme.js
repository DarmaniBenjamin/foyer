// Light and dark mode.
//
// The choice is "system" (follow the phone or computer's own setting,
// the starting choice), "light" or "dark". Once you pick light or dark,
// it stays that way (after a reload, or closing and opening the tab)
// until you change it.
//
// For now the choice is kept in this browser (localStorage). When the
// server and sign-in are built, it's also saved on your admin account,
// so it follows you to your other devices.
//
// index.html has a copy of applyTheme's first part, so the page is
// never drawn in the wrong colours for a moment while it loads.

const KEY = "foyer-theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export function getThemeChoice() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

// What the page actually shows for a choice: "light" or "dark"
export function resolveTheme(choice) {
  if (choice === "light" || choice === "dark") return choice;
  return darkQuery.matches ? "dark" : "light";
}

export function applyTheme(choice) {
  const dark = resolveTheme(choice) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#131c2e" : "#ffffff");
}

export function saveThemeChoice(choice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Private browsing: it lasts until the tab is closed
  }
  applyTheme(choice);
}

// Calls back when the device's own light/dark setting changes
export function onSystemThemeChange(callback) {
  darkQuery.addEventListener("change", callback);
  return () => darkQuery.removeEventListener("change", callback);
}