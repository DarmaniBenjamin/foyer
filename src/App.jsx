// The admin site's pages. Each Route links an address to a page.
import { Route, Routes } from "react-router";
import Layout from "./Components/Layout";
import ComingSoon from "./Components/Pages/ComingSoon";
import Controllers from "./Components/Pages/Controllers";
import Sites from "./Components/Pages/Sites";
import SiteEditorPage from "./Components/Pages/SiteEditor";
import Vouchers from "./Components/Pages/Vouchers";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ComingSoon title="Dashboard" />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/sites/:id" element={<SiteEditorPage />} />
        <Route path="/guests" element={<ComingSoon title="Guests" />} />
        <Route path="/vouchers" element={<Vouchers />} />
        <Route path="/reports" element={<ComingSoon title="Reports" />} />
        <Route path="/controllers" element={<Controllers />} />
        <Route path="/admins" element={<ComingSoon title="Admins" />} />
        <Route path="*" element={<ComingSoon title="Page not found" />} />
      </Routes>
    </Layout>
  );
}