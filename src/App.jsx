// The admin site's pages. Each Route links an address to a page.
import { Route, Routes } from "react-router";
import Layout from "./Components/Layout";
import ComingSoon from "./Components/Pages/ComingSoon";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ComingSoon title="Dashboard" />} />
        <Route path="/sites" element={<ComingSoon title="Sites" />} />
        <Route path="/guests" element={<ComingSoon title="Guests" />} />
        <Route path="/vouchers" element={<ComingSoon title="Vouchers" />} />
        <Route path="/reports" element={<ComingSoon title="Reports" />} />
        <Route
          path="/controllers"
          element={<ComingSoon title="Controllers" />}
        />
        <Route path="/admins" element={<ComingSoon title="Admins" />} />
        <Route path="*" element={<ComingSoon title="Page not found" />} />
      </Routes>
    </Layout>
  );
}