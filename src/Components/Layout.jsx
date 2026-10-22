// The frame around every admin page: the sidebar on the left (a slide-in
// menu on phones) and the top bar with the page's name and the site
// switcher.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { ExternalLink, LogOut, Menu, Settings2, Wifi, X } from "lucide-react";
import { navLinks, getPageTitle } from "./navLinks";
import { APP_NAME } from "../brand";
import SiteSwitcher from "./SiteSwitcher";
import ThemeSwitch from "./ThemeSwitch";
import useData from "../useData";
import { adminInitials } from "../admins";

function SidebarLink({ link, onClick }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.path}
      end={link.path === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        `relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition ${
          isActive
            ? "nav-active bg-brand/10 text-brand"
            : "text-muted hover:bg-brand/5 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
          {link.label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ open, onClose }) {
  const { currentAdmin, isClient, can, signOut, currentSite } = useData();
  const navigate = useNavigate();
  return (
    <>
      {/* The dark cover behind the menu on phones; tapping it closes the menu */}
      {open && (
        <div
          className="fixed inset-0 z-30 touch-none bg-ink/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-40 flex h-dvh w-65 max-w-[85vw] flex-col border-r border-line transition-transform duration-200 lg:sticky lg:top-0 lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-md shadow-brand/30">
              <Wifi size={20} />
            </span>
            <span className="text-lg font-semibold">{APP_NAME}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-page lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-2">
          {/* "Sites" (the list) and "Controllers" only on All sites; with
              one site picked, "Site settings" opens that site instead
              (its controller is set up there) */}
          {navLinks
            .filter((link) => can(link.area))
            .filter((link) => !(currentSite && link.path === "/controllers"))
            .map((link) =>
              link.path === "/sites" && currentSite
                ? { ...link, path: `/sites/${currentSite.id}`, label: "Site settings", icon: Settings2 }
                : link,
            )
            .map((link) => (
              <SidebarLink key={link.path} link={link} onClick={onClose} />
            ))}
        </nav>

        <div className="space-y-2 border-t border-line p-3">
          <ThemeSwitch />
          <SiteSwitcher onPicked={onClose} />
          {/* You: opens My account; the door signs you out */}
          <div className="flex items-center gap-1">
            <Link
              to="/account"
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-brand/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {adminInitials(currentAdmin?.name ?? "")}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{currentAdmin?.name}</span>
                  {isClient && (
                    <span className="shrink-0 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                      Client
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted">
                  {currentAdmin?.email}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="shrink-0 rounded-lg p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const { currentSite } = useData();

  // The browser tab shows the page's name
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  // Each page starts at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // While the menu is open on a phone, the page behind it stays still,
  // Escape closes it, and it closes by itself if the screen gets wide
  // enough for the sidebar
  useEffect(() => {
    if (!menuOpen) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      html.style.overflow = before;
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-15 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="-ml-1 shrink-0 rounded-lg p-2 text-muted hover:bg-page lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">{title}</h1>
          {/* Which site you're looking at, on the right: click it to switch
              site. Next to it, a link to the site's guest sign-in page */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SiteSwitcher variant="header" />
            {currentSite && (
              <Link
                to={`/p/${currentSite.slug}`}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
                title="Open this site's guest sign-in page"
                aria-label="Guest page"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">Guest page</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}