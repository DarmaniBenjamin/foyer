// Talking to Foyer's server (server/), at /api on the same address.
//   const site = await api("/sites", { method: "POST", body: { name } });
// Throws an ApiError with the server's words (e.message) when it says no.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach Foyer. Check your internet connection.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(
      data?.error ??
        (res.status === 503
          ? "Foyer is starting up. Try again in a moment."
          : "Something went wrong on the server. Try again."),
      res.status,
    );
  return data;
}
