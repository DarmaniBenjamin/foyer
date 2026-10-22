// A number with a label, for the top of the Dashboard and Reports.
// Numbers count up from 0 when the page opens or the site changes.
import { useEffect, useState } from "react";

const calm = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// "1,234" → counts 0 … 1,234 over ~0.7s; anything else is shown as it is
function useCountUp(value) {
  const text = String(value ?? "");
  const target = /^[\d,]+(\.\d+)?$/.test(text) ? Number(text.replace(/,/g, "")) : null;
  const still = target === null || calm();
  const [shown, setShown] = useState("0");
  useEffect(() => {
    if (still) return;
    const decimals = (text.split(".")[1] ?? "").length;
    const start = performance.now();
    let frame;
    const step = (now) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      setShown(
        (target * eased).toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
      );
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, target, still]);
  return still ? text : shown;
}

export default function StatTile({ label, value, detail }) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{shown}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>}
    </div>
  );
}