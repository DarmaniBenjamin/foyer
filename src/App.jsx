// The site's pages. Each Route links an address to a page.
// - /login: the admin sign-in page
// - /p/<site>: a site's guest Wi-Fi sign-in page (what guests see)
// - everything else: the admin pages, only for signed-in admins
import { Route, Routes } from "react-router";
import Layout from "./Components/Layout";
import RequireAdmin from "./Components/RequireAdmin";
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
import Whitelist from "./Components/Pages/Whitelist";
import Ads from "./Components/Pages/Ads";

function AdminPages() {
  return (
    <RequireAdmin>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/sites/:id" element={<SiteEditorPage />} />
          <Route path="/guests" element={<Guests />} />
          <Route path="/vouchers" element={<Vouchers />} />
          <Route path="/whitelist" element={<Whitelist />} />
          <Route path="/ads" element={<Ads />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/controllers" element={<Controllers />} />
          <Route path="/admins" element={<Admins />} />
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
      <Route path="/p/:slug" element={<GuestPortal />} />
      <Route path="/*" element={<AdminPages />} />
    </Routes>
  );
}