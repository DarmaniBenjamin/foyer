// The sidebar's links. Each one has the page's address (path), its
// name (label) and an icon from lucide-react.
import {
  Building2,
  ChartColumn,
  LayoutDashboard,
  Router,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

export const navLinks = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/sites", label: "Sites", icon: Building2 },
  { path: "/guests", label: "Guests", icon: Users },
  { path: "/vouchers", label: "Vouchers", icon: Ticket },
  { path: "/reports", label: "Reports", icon: ChartColumn },
  { path: "/controllers", label: "Controllers", icon: Router },
  { path: "/admins", label: "Admins", icon: ShieldCheck },
];

// The page name for an address, for the top bar and the browser tab
export function getPageTitle(pathname) {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/account")) return "My account";
  const link = navLinks.find(
    (l) => l.path !== "/" && pathname.startsWith(l.path),
  );
  return link ? link.label : "Page not found";
}