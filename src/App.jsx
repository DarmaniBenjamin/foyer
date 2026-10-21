// The site's pages. Each Route links an address to a page.
// - /login: the sign-in page
// - /setup/<code>: making the first admin on a new Foyer
// - /p/<site>: a site's guest Wi-Fi sign-in page (what guests see)
// - everything else: the admin pages, only for people signed in. Pages
//   in "only" need access to that area (client logins may not have it).
import { Route, Routes } from "react-router";
import Layout from "./Components/Layout";
import RequireAdmin from "./Components/RequireAdmin";
import RequireAccess from "./Components/RequireAccess";
import NotFound from "./Components/Pages/NotFound";
import Controllers from "./Components/Pages/Controllers";
import Sites from "./Components/Pages/Sites";
import SiteEditorPage from "./Components/Pages/SiteEditor";
import Vouchers from "./Components/Pages/Vouchers";
import Guests from "./Components/Pages/Guests";
import Reports from "./Components/Pages/Reports";
import Dashboard from "./Components/Pages/Dashboard";
import Admins from "./Components/Pages/Admins";
import Account from "./Components/Pages/Account";
import Login from "./Components/Pages/Login";
import GuestPortal from "./Components/Pages/GuestPortal";
import Setup from "./Components/Pages/Setup";
import Whitelist from "./Components/Pages/Whitelist";
import Ads from "./Components/Pages/Ads";

// The page, if the signed-in person has access to its area
const only = (area, page) => <RequireAccess area={area}>{page}</RequireAccess>;

function AdminPages() {
  return (
    <RequireAdmin>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sites" element={only("sites", <Sites />)} />
          <Route path="/sites/:id" element={only("sites", <SiteEditorPage />)} />
          <Route path="/guests" element={only("guests", <Guests />)} />
          <Route path="/vouchers" element={only("vouchers", <Vouchers />)} />
          <Route path="/whitelist" element={only("whitelist", <Whitelist />)} />
          <Route path="/ads" element={only("ads", <Ads />)} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/controllers" element={only("controllers", <Controllers />)} />
          <Route path="/admins" element={only("admins", <Admins />)} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup/:code" element={<Setup />} />
      <Route path="/p/:slug" element={<GuestPortal />} />
      <Route path="/*" element={<AdminPages />} />
    </Routes>
  );
}