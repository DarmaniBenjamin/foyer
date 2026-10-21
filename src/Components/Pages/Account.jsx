// My account: your name and email, and your password
import { useState } from "react";
import { Check } from "lucide-react";
import useData from "../../useData";
import { PASSWORD_RULE, adminInitials, validEmail } from "../../admins";
import PasswordInput from "../PasswordInput";
import { inputClass, labelClass, primaryButton } from "../formStyles";

function Saved({ show }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-emerald-800">
      <Check size={16} />
      Saved
    </span>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export default function Account() {
  const { currentAdmin, updateProfile, changePassword } = useData();
  const [name, setName] = useState(currentAdmin.name);
  const [email, setEmail] = useState(currentAdmin.email);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileSaved(false);
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setProfileError("Enter your name.");
    if (!validEmail(cleanEmail)) return setProfileError("Enter a real email address.");
    const problem = await updateProfile({ name: name.trim(), email: cleanEmail });
    setProfileError(problem);
    setProfileSaved(!problem);
  }

  // Your other devices are signed out when it changes
  async function savePassword(e) {
    e.preventDefault();
    setPasswordSaved(false);
    if (!current) return setPasswordError("Enter your current password.");
    if (next.length < 10) return setPasswordError(PASSWORD_RULE);
    if (next !== again) return setPasswordError("The two new passwords don't match.");
    const problem = await changePassword(current, next);
    setPasswordError(problem);
    if (problem) return;
    setCurrent("");
    setNext("");
    setAgain("");
    document.activeElement?.blur();
    setPasswordSaved(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
          {adminInitials(currentAdmin.name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{currentAdmin.name}</h2>
          <p className="truncate text-sm text-muted">{currentAdmin.email}</p>
        </div>
      </div>

      <Card title="Profile">
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="me-name">
              Name
            </label>
            <input
              id="me-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="me-email">
              Email (what you sign in with)
            </label>
            <input
              id="me-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              className={inputClass}
            />
          </div>
          {profileError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {profileError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" className={primaryButton}>
              Save
            </button>
            <Saved show={profileSaved} />
          </div>
        </form>
      </Card>

      <Card title="Password">
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="pw-current">
              Current password
            </label>
            <PasswordInput
              id="pw-current"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pw-new">
                New password
              </label>
              <PasswordInput
                id="pw-new"
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                placeholder="10 characters or more"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pw-again">
                New password again
              </label>
              <PasswordInput
                id="pw-again"
                value={again}
                onChange={setAgain}
                autoComplete="new-password"
              />
            </div>
          </div>
          {passwordError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {passwordError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" className={primaryButton}>
              Change password
            </button>
            <Saved show={passwordSaved} />
          </div>
        </form>
      </Card>
    </div>
  );
}