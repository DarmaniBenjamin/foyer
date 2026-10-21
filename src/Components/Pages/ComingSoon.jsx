// A stand-in for pages that aren't built yet. It shows which site is
// picked, so you can see the site switcher working.
import { Construction } from "lucide-react";
import useData from "../../useData";

export default function ComingSoon({ title }) {
  const { currentSite } = useData();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Construction size={28} />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        {currentSite
          ? `Will show ${currentSite.name} only.`
          : "Will show an overview of all sites."}
      </p>
      <p className="mt-1 text-sm text-muted">This page is coming next.</p>
    </div>
  );
}