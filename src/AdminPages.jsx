// The admin pages (everything but the guest sign-in page). Loaded only
// when needed (App.jsx), so a guest's phone doesn't download them.
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
import Whitelist from "./Components/Pages/Whitelist";
import Ads from "./Components/Pages/Ads";
import Maintenance from "./Components/Pages/Maintenance";

// The page, if the signed-in person has access to its area
const only = (area, page) => <RequireAccess area={area}>{page}</RequireAccess>;

export default function AdminPages() {
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
          <Route path="/maintenance" element={only("maintenance", <Maintenance />)} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </RequireAdmin>
  );
}
