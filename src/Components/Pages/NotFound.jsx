// For addresses that don't match any page
import { Link } from "react-router";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <SearchX size={28} />
      </span>
      <h2 className="text-lg font-semibold">There's no page here</h2>
      <p className="mt-1 text-sm text-muted">The address may be mistyped, or the page was removed.</p>
      <Link to="/" className="mt-4 text-sm font-semibold text-brand hover:underline">
        Go to the Dashboard
      </Link>
    </div>
  );
}