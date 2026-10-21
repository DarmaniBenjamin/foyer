// The sign-in page for admins. After signing in, you go back to the page
// you were trying to open.
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { LoaderCircle, LogIn } from "lucide-react";
import useData from "../../useData";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../admins";
import AuthShell from "../AuthShell";
import PasswordInput from "../PasswordInput";
import { inputClass, labelClass, primaryButton } from "../formStyles";

export default function Login() {
  const { currentAdmin, signIn } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const goTo = location.state?.from ?? "/";

  if (currentAdmin) return <Navigate to={goTo} replace />;

  function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const problem = signIn(email, password);
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
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <LogIn size={18} />}
          Sign in
        </button>
        <p className="text-center text-xs text-muted">
          Forgot your password? Ask another admin to set a new one.
        </p>
      </form>

      {/* FOR NOW (no server yet): the example admin's sign-in */}
      <div className="mt-6 rounded-xl border border-dashed border-line p-3 text-xs text-muted">
        <p className="font-semibold text-ink">Demo sign-in</p>
        <p className="mt-1">
          {DEMO_EMAIL} · {DEMO_PASSWORD}
        </p>
        <button
          type="button"
          onClick={() => {
            setEmail(DEMO_EMAIL);
            setPassword(DEMO_PASSWORD);
            setError("");
          }}
          className="mt-2 font-semibold text-brand hover:underline"
        >
          Fill it in
        </button>
      </div>
    </AuthShell>
  );
}