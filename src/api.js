// Talking to Foyer's server (server/), at /api on the same address.
//   const site = await api("/sites", { method: "POST", body: { name } });
// Throws an ApiError with the server's words (e.message) when it says no.

// This tab's name, sent with every request, so the server's live updates
// (server/live.js) can tell the other tabs and skip this one
export const TAB_ID =
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export async function api(path, { method = "GET", body } = {}) {
  let res;
  // A 503 means the request wasn't dealt with (Foyer, or the host in
  // front of it, wasn't ready), so it's safe to send again: up to 3 more
  // times, 1.5 seconds apart, before saying so
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`/api${path}`, {
        method,
        credentials: "same-origin",
        headers: {
          "X-Foyer-Tab": TAB_ID,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("Couldn't reach Foyer. Check your internet connection.", 0);
    }
    if (res.status !== 503 || attempt === 3) break;
    await pause(1500);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(
      data?.error ??
        (data?.database === "not connected"
          ? "Foyer is starting up. Try again in a moment."
          : data
            ? "Something went wrong on the server. Try again."
            : // Not Foyer's own answer: the hosting in front of it said no
              `The hosting server answered with error ${res.status} instead of Foyer. Try again in a moment.`),
      res.status,
    );
  return data;
}
