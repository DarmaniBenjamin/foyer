// The people who manage Foyer (admins), and the example ones used until
// the server exists.
//
// FOR NOW (no server yet): passwords are kept as typed, in memory only,
// so the sign-in page can be tried. The server will keep only scrambled
// copies (like Uplink) and check them itself.

export const DEMO_EMAIL = "admin@example.com";
export const DEMO_PASSWORD = "foyer-demo";

export const STARTING_ADMINS = [
  {
    id: 1,
    name: "Darmani Benjamin",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    lastActiveAt: Date.now(),
  },
  {
    id: 2,
    name: "Support Team",
    email: "support@example.com",
    password: "support-demo",
    createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    lastActiveAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

export const PASSWORD_RULE = "Use at least 10 characters for the password.";

export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// "Darmani Benjamin" → "DB"
export function adminInitials(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}