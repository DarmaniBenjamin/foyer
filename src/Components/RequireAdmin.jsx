// Wraps the admin pages: if nobody is signed in, it sends you to the
// sign-in page (and back here afterwards)
import { Navigate, useLocation } from "react-router";
import useData from "../useData";

export default function RequireAdmin({ children }) {
  const { currentAdmin } = useData();
  const location = useLocation();
  if (!currentAdmin)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}