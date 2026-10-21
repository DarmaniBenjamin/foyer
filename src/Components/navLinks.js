// The sidebar's links. Each one has the page's address (path), its
// name (label), an icon from lucide-react, and the area someone needs
// access to for it (see canAccess in admins.js). Client logins only see
// the links they have access to.
import {
  Building2,
  ChartColumn,
  LayoutDashboard,
  Megaphone,
  MonitorSmartphone,
  Router,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

export const navLinks = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, area: "reports" },
  { path: "/sites", label: "Sites", icon: Building2, area: "sites" },
  { path: "/guests", label: "Guests", icon: Users, area: "guests" },
  { path: "/vouchers", label: "Vouchers", icon: Ticket, area: "vouchers" },
  { path: "/whitelist", label: "Device whitelist", icon: MonitorSmartphone, area: "whitelist" },
  { path: "/ads", label: "Splash ads", icon: Megaphone, area: "ads" },
  { path: "/reports", label: "Reports", icon: ChartColumn, area: "reports" },
  { path: "/controllers", label: "Controllers", icon: Router, area: "controllers" },
  { path: "/admins", label: "Users", icon: ShieldCheck, area: "admins" },
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