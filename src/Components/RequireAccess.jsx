// Wraps a page that not everyone may see. A client login without access
// to the page's area gets a "no access" note instead (e.g. if they type
// its address or follow an old link).
import { Link } from "react-router";
import { Lock } from "lucide-react";
import useData from "../useData";

export default function RequireAccess({ area, children }) {
  const { can } = useData();
  if (can(area)) return children;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Lock size={28} />
      </span>
      <h2 className="text-lg font-semibold">You don't have access to this page</h2>
      <p className="mt-1 text-sm text-muted">
        Ask Protonic Solutions if you need it.
      </p>
      <Link to="/" className="mt-4 text-sm font-semibold text-brand hover:underline">
        Go to the Dashboard
      </Link>
    </div>
  );
}
