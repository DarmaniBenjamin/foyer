// Admins: everyone who can sign in to Foyer. Every admin can do
// everything; add one with a starting password and tell them to change
// it under My account.
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import useData from "../../useData";
import { timeAgo } from "../../data";
import { PASSWORD_RULE, adminInitials, validEmail } from "../../admins";
import Modal from "../Modal";
import PasswordInput from "../PasswordInput";
import {
  dangerButton,
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "../formStyles";

function AdminModal({ onSave, onClose, emailsTaken }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function save() {
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError("Enter their name.");
    if (!validEmail(cleanEmail)) return setError("Enter a real email address.");
    if (emailsTaken.includes(cleanEmail))
      return setError("There's already an admin with that email.");
    if (password.length < 10) return setError(PASSWORD_RULE);
    document.activeElement?.blur();
    onSave({ name: name.trim(), email: cleanEmail, password });
  }

  return (
    <Modal
      title="Add admin"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            Add admin
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="a-name">
            Name
          </label>
          <input
            id="a-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="a-email">
            Email
          </label>
          <input
            id="a-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="a-pass">
            Starting password
          </label>
          <PasswordInput
            id="a-pass"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <p className={hintClass}>
            Give it to them yourself; they change it under My account.
          </p>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}

export default function Admins() {
  const { admins, currentAdmin, addAdmin, removeAdmin } = useData();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Everyone who can sign in to Foyer. Every admin can see and change
          every site.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`${primaryButton} shrink-0`}
        >
          <UserPlus size={18} />
          Add admin
        </button>
      </div>

      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        {admins.map((admin) => {
          const you = admin.id === currentAdmin?.id;
          return (
            <div key={admin.id} className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {adminInitials(admin.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{admin.name}</span>
                  {you && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      You
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted">{admin.email}</p>
              </div>
              <p className="hidden shrink-0 text-right text-xs text-muted sm:block">
                {admin.lastActiveAt ? `Active ${timeAgo(admin.lastActiveAt)}` : "Hasn't signed in yet"}
              </p>
              {!you && (
                <button
                  type="button"
                  onClick={() => setRemoving(admin)}
                  className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${admin.name}`}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <AdminModal
          emailsTaken={admins.map((a) => a.email)}
          onSave={(values) => {
            addAdmin(values);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className={secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeAdmin(removing.id);
                  setRemoving(null);
                }}
                className={dangerButton}
              >
                Remove
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">
            {removing.email} won't be able to sign in any more. Sites, guests
            and vouchers stay as they are.
          </p>
        </Modal>
      )}
    </div>
  );
}