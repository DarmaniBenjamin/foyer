// The admin site's pages. Each Route links an address to a page.
import { Route, Routes } from "react-router";
import Layout from "./Components/Layout";
import ComingSoon from "./Components/Pages/ComingSoon";
import Controllers from "./Components/Pages/Controllers";
import Sites from "./Components/Pages/Sites";
import SiteEditorPage from "./Components/Pages/SiteEditor";
import Vouchers from "./Components/Pages/Vouchers";
import Guests from "./Components/Pages/Guests";
import Reports from "./Components/Pages/Reports";
import Dashboard from "./Components/Pages/Dashboard";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/sites/:id" element={<SiteEditorPage />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/vouchers" element={<Vouchers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/controllers" element={<Controllers />} />
        <Route path="/admins" element={<ComingSoon title="Admins" />} />
        <Route path="*" element={<ComingSoon title="Page not found" />} />
      </Routes>
    </Layout>
  );
}