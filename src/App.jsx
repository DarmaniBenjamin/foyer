// The site's pages. Each Route links an address to a page.
// - /login: the sign-in page
// - /setup/<code>: making the first admin on a new Foyer
// - /p/<site>: a site's guest Wi-Fi sign-in page (what guests see)
// - everything else: the admin pages, only for people signed in
//   (AdminPages.jsx).
// Only the guest page is in the first download: everything else is
// loaded when it's opened, so a guest's phone (often a crowd of them on
// one internet line) gets a small page that opens fast.
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import GuestPortal from "./Components/Pages/GuestPortal";

// A page's file can be gone after Foyer is updated (the new version's
// files have new names): the page is loaded again once to get them
function later(load) {
  return lazy(() =>
    load().catch((err) => {
      let tried = false;
      try {
        tried = sessionStorage.getItem("foyer-reloaded") === "1";
        sessionStorage.setItem("foyer-reloaded", "1");
      } catch {
        // No storage: reload anyway, once per page
      }
      if (tried) throw err;
      window.location.reload();
      return new Promise(() => {});
    }),
  );
}
try {
  // Loaded fine this time
  window.addEventListener("load", () => sessionStorage.removeItem("foyer-reloaded"));
} catch {
  // No storage
}

const AdminPages = later(() => import("./AdminPages"));
const Login = later(() => import("./Components/Pages/Login"));
const Setup = later(() => import("./Components/Pages/Setup"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup/:code" element={<Setup />} />
        <Route path="/p/:slug" element={<GuestPortal />} />
        <Route path="/*" element={<AdminPages />} />
      </Routes>
    </Suspense>
  );
}
