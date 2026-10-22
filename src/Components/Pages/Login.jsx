// The sign-in page, for admins and client logins. After signing in, you
// go back to the page you were trying to open.
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { LogIn } from "lucide-react";
import WifiLoader from "../WifiLoader";
import useData from "../../useData";
import AuthShell from "../AuthShell";
import PasswordInput from "../PasswordInput";
import Loading from "../Loading";
import { inputClass, labelClass, primaryButton } from "../formStyles";

export default function Login() {
  const { status, needsSetup, currentAdmin, signIn } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const goTo = location.state?.from ?? "/";

  if (currentAdmin && status === "ready") return <Navigate to={goTo} replace />;
  if (status === "error" || (status === "loading" && !busy)) return <Loading />;

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const problem = await signIn(email, password);
    setBusy(false);
    if (problem) return setError(problem);
    document.activeElement?.blur();
    navigate(goTo, { replace: true });
  }

  return (
    <AuthShell title="Sign in" subtitle="Manage your clients' guest Wi-Fi.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Password
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? <WifiLoader size={18} /> : <LogIn size={18} />}
          Sign in
        </button>
        <p className="text-center text-xs text-muted">
          Forgot your password? Ask Protonic Solutions to set a new one.
        </p>
      </form>

      {/* A new Foyer with nobody added yet */}
      {needsSetup && (
        <p className="mt-6 rounded-lg border border-dashed border-line p-3 text-xs text-muted">
          <b className="text-ink">Setting up Foyer?</b> Nobody has been added
          yet. Open <span className="font-mono">/setup/</span> followed by the
          SETUP_CODE from your settings to make the first admin.
        </p>
      )}
    </AuthShell>
  );
}
