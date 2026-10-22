// The moving parts of the guest sign-in page, in the site's own colour
// (the animations themselves are in index.css, "Guest sign-in page"):
// - WifiSignal: Wi-Fi arcs that light up one after another while it's
//   waiting ("search"), faster while connecting, solid once connected
// - BrandBadge: the Wi-Fi icon in a coloured square with soft rings
//   pulsing out behind it (for sites without their own logo)
// - SignalChip: a small "Wi-Fi ready / Connecting… / Connected" chip
//   (under a site's own logo)
// - SignalBars: bouncing signal bars for the Connect button
// - ConnectedMark: the check that pops in after signing in

// state: "search", "connecting" or "on"
export function WifiSignal({ size = 28, state = "search", color = "currentColor" }) {
  const arcs = [
    "M2 8.82a15 15 0 0 1 20 0",
    "M5 12.86a10 10 0 0 1 14 0",
    "M8.5 16.43a5 5 0 0 1 7 0",
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      className={`portal-wifi portal-wifi-${state}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="20" r="1.4" fill={color} stroke="none" />
      {/* The smallest arc first, then outwards */}
      {[...arcs].reverse().map((d, i) => (
        <path key={d} d={d} style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </svg>
  );
}

export function BrandBadge({ style, state }) {
  return (
    <span className="relative flex h-16 w-16 items-center justify-center">
      {state !== "on" && (
        <>
          <span className="portal-ripple absolute inset-0 rounded-2xl" style={{ backgroundColor: style.backgroundColor }} />
          <span
            className="portal-ripple absolute inset-0 rounded-2xl"
            style={{ backgroundColor: style.backgroundColor, animationDelay: "1.1s" }}
          />
        </>
      )}
      <span
        className="portal-badge relative flex h-16 w-16 items-center justify-center rounded-2xl"
        style={style}
      >
        <WifiSignal size={30} state={state} />
      </span>
    </span>
  );
}

export function SignalChip({ state, color, ink }) {
  const words = { search: "Wi-Fi ready", connecting: "Connecting…", on: "Connected" }[state];
  return (
    <span
      className="portal-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: ink, backgroundColor: "rgba(127,127,127,0.12)" }}
    >
      {state === "on" ? (
        <span className="portal-live h-2 w-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
      ) : (
        <WifiSignal size={14} state={state} color={color} />
      )}
      {words}
    </span>
  );
}

export function SignalBars() {
  return (
    <span className="portal-bars inline-flex h-4 items-end gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current"
          style={{ height: `${40 + i * 20}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}

export function ConnectedMark({ color }) {
  return (
    <span className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center">
      <span className="portal-burst absolute inset-0 rounded-full" style={{ backgroundColor: color }} />
      <span
        className="portal-pop relative flex h-14 w-14 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="portal-tick" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  );
}
