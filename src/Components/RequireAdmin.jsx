// Wraps the admin pages: waits while Foyer finds out who is signed in,
// and if nobody is, sends you to the sign-in page (and back here
// afterwards)
import { Navigate, useLocation } from "react-router";
import useData from "../useData";
import Loading from "./Loading";

export default function RequireAdmin({ children }) {
  const { status, currentAdmin } = useData();
  const location = useLocation();
  if (status !== "ready") return <Loading />;
  if (!currentAdmin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
