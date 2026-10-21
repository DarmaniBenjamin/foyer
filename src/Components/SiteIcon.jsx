// A site's square icon: its initials on its portal colour
import { initials } from "../data";

export default function SiteIcon({ site, size = "md" }) {
  const sizes = {
    sm: "h-7 w-7 text-[11px] rounded-lg",
    md: "h-9 w-9 text-xs rounded-xl",
    lg: "h-12 w-12 text-sm rounded-2xl",
  };
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-semibold text-white ${sizes[size]}`}
      style={{ backgroundColor: site.look.color }}
    >
      {initials(site.name)}
    </span>
  );
}