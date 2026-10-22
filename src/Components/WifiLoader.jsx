// Foyer's loading animation, used wherever something is loading or
// saving: a ring turning around a Wi-Fi icon whose waves travel out from
// the dot (index.css, wifi-loader). Takes the text colour (currentColor),
// like the icons it replaced.
export default function WifiLoader({ size = 24, className = "", label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={`wifi-loader shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      <circle className="wifi-loader-track" cx="14" cy="14" r="12.5" strokeWidth="1.6" />
      <circle className="wifi-loader-ring" cx="14" cy="14" r="12.5" strokeWidth="2" />
      <svg x="6.5" y="4.9" width="15" height="15" viewBox="0 0 24 24" overflow="visible">
        <path d="M8.5 16.43a5 5 0 0 1 7 0" strokeWidth="2.6" />
        <path d="M5 12.86a10 10 0 0 1 14 0" strokeWidth="2.6" />
        <path d="M2 8.82a15 15 0 0 1 20 0" strokeWidth="2.6" />
        <circle className="wifi-loader-dot" cx="12" cy="20" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    </svg>
  );
}
