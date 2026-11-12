// Whether a controller works, from its last check (controller.lastTest).
// Foyer checks every controller by itself every 5 minutes
// (server/controllers/watch.js), and Test connection checks it now.
//   "Online · since Nov 10"           green
//   "Offline for 12 minutes"          red, with the reason under it
//   compact: one line, no reason or warning (for lists)
import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

// Re-draws every 30 seconds, so "for 12 minutes" keeps counting
function useClock() {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(tick);
  }, []);
}

// 12 minutes → "12 minutes", 3 hours → "3 hours", 2 days → "2 days"
function howLong(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

// A time today → "10:42 AM"; another day → "Nov 10, 10:42 AM"
function when(ms) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

// The words, for anywhere that wants just those
export function statusWords(test) {
  if (!test) return "Not checked yet";
  const since = test.since ?? test.at;
  return test.ok ? `Online · since ${when(since)}` : `Offline for ${howLong(Date.now() - since)}`;
}

export default function ControllerStatus({ test, compact = false }) {
  useClock();
  if (!test) return <p className="text-sm text-muted">Not checked yet: it's checked within 5 minutes.</p>;
  const Icon = test.ok ? CircleCheck : CircleAlert;
  const color = test.ok ? "text-emerald-800" : "text-red-700";

  if (compact)
    return (
      <span className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${test.ok ? "bg-emerald-500" : "animate-pulse bg-red-500"}`} />
        {statusWords(test)}
      </span>
    );

  return (
    <div
      className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${
        test.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">{statusWords(test)}</p>
        {(test.ok ? test.warning : test.message) && (
          <p className="opacity-90">{test.ok ? test.warning : test.message}</p>
        )}
        <p className="mt-0.5 text-xs opacity-70">Foyer checks it every 5 minutes</p>
      </div>
    </div>
  );
}
