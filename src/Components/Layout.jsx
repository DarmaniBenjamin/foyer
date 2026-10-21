// The frame around every admin page: the sidebar on the left (a slide-in
// menu on phones) and the top bar with the page's name.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { ExternalLink, LogOut, Menu, Wifi, X } from "lucide-react";
import { navLinks, getPageTitle } from "./navLinks";
import { APP_NAME } from "../brand";
import SiteSwitcher from "./SiteSwitcher";
import ThemeSwitch from "./ThemeSwitch";
import SiteIcon from "./SiteIcon";
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
        `relative flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand/10 text-brand"
            : "text-muted hover:bg-brand/5 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-brand" />
          )}
          <Icon size={20} />
          {link.label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ open, onClose }) {
  const { currentAdmin, signOut } = useData();
  const navigate = useNavigate();
  return (
    <>
      {/* The dark cover behind the menu on phones; tapping it closes the menu */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-65 flex-col border-r border-line transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/30">
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

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {navLinks.map((link) => (
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
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-brand/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {adminInitials(currentAdmin?.name ?? "")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {currentAdmin?.name}
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
              className="shrink-0 rounded-xl p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
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

  return (
    <div className="flex min-h-dvh">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-page lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-semibold">{title}</h1>
          {/* Which site you're looking at, on the right, with a link to
              its guest sign-in page */}
          <span className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted">
            {currentSite && <SiteIcon site={currentSite} size="sm" />}
            <span className="hidden truncate sm:block">
              {currentSite ? currentSite.name : "All sites"}
            </span>
            {currentSite && (
              <Link
                to={`/p/${currentSite.slug}`}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
                title="Open this site's guest sign-in page"
              >
                <ExternalLink size={14} />
                Guest page
              </Link>
            )}
            {!currentSite && <span className="sm:hidden">All sites</span>}
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}