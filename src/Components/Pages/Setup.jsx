// /setup/<SETUP_CODE>: making the first admin on a new Foyer. Only works
// while nobody has been added, and only with the SETUP_CODE from the
// environment variables (the server checks both).
import { useState } from "react";
import { Navigate, useParams } from "react-router";
import { LoaderCircle, UserPlus } from "lucide-react";
import useData from "../../useData";
import { PASSWORD_RULE, validEmail } from "../../admins";
import AuthShell from "../AuthShell";
import Loading from "../Loading";
import PasswordInput from "../PasswordInput";
import { inputClass, labelClass, primaryButton } from "../formStyles";

export default function Setup() {
  const { code } = useParams();
  const { status, needsSetup, currentAdmin, setUp } = useData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status !== "ready" && !busy) return <Loading />;
  if (currentAdmin) return <Navigate to="/" replace />;
  if (!needsSetup && !busy) return <Navigate to="/login" replace />;

  async function submit(e) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError("Enter your name.");
    if (!validEmail(cleanEmail)) return setError("Enter a real email address.");
    if (password.length < 10) return setError(PASSWORD_RULE);
    setBusy(true);
    const problem = await setUp({ code, name: name.trim(), email: cleanEmail, password });
    setBusy(false);
    setError(problem);
  }

  return (
    <AuthShell title="Set up Foyer" subtitle="Make the first admin: you.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className={labelClass} htmlFor="setup-name">
            Your name
          </label>
          <input
            id="setup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="setup-email">
            Email
          </label>
          <input
            id="setup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="setup-password">
            Password
          </label>
          <PasswordInput
            id="setup-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="10 characters or more"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <UserPlus size={18} />}
          Make my admin account
        </button>
      </form>
    </AuthShell>
  );
}
