// Users: everyone who can sign in to Foyer.
// - Admins (your team) see and change every site.
// - Client logins (like Spotipo's client accounts) let a customer sign
//   in and see only their own sites, with No access, Read, or Read &
//   write for each area. They always see their sites' Dashboard and
//   Reports.
// Add someone with a starting password and tell them to change it under
// My account.
import { useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import useData from "../../useData";
import { timeAgo } from "../../data";
import {
  ACCESS_AREAS,
  ACCESS_LEVELS,
  NO_ACCESS,
  PASSWORD_RULE,
  ROLES,
  adminInitials,
  validEmail,
} from "../../admins";
import Modal from "../Modal";
import PasswordInput from "../PasswordInput";
import SiteIcon from "../SiteIcon";
import {
  dangerButton,
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "../formStyles";

const choice = (on) =>
  `rounded-xl border text-sm font-semibold transition ${
    on
      ? "border-brand bg-brand/10 text-brand"
      : "border-line text-muted hover:border-brand/40 hover:bg-brand/5"
  }`;

// user: the one being changed, or null to add. isYou: you can't change
// your own role (so you can't lock yourself out).
function UserModal({ user, isYou, sites, emailsTaken, onSave, onClose }) {
  const [role, setRole] = useState(user?.role ?? "client");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [siteIds, setSiteIds] = useState(user?.siteIds ?? []);
  const [access, setAccess] = useState(
    user?.access ?? { ...NO_ACCESS, guests: "read" },
  );
  const [error, setError] = useState("");

  function toggleSite(id) {
    setSiteIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError("Enter their name.");
    if (!validEmail(cleanEmail)) return setError("Enter a real email address.");
    if (emailsTaken.includes(cleanEmail))
      return setError("Someone already signs in with that email.");
    if (!user && password.length < 10) return setError(PASSWORD_RULE);
    if (user && password && password.length < 10)
      return setError(PASSWORD_RULE);
    if (role === "client" && siteIds.length === 0)
      return setError("Pick at least one site they can see.");
    document.activeElement?.blur();
    setSaving(true);
    // "" when it worked (the box closes), or the server's reason
    const problem = await onSave({
      name: name.trim(),
      email: cleanEmail,
      ...(password ? { password } : {}),
      role,
      siteIds: role === "client" ? siteIds : [],
      access: role === "client" ? access : NO_ACCESS,
    });
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <Modal
      title={user ? `Edit ${user.name}` : "Add user"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButton}>
            {user ? "Save" : "Add user"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!isYou && (
          <div>
            <span className={labelClass}>Kind of login</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(ROLES).map(([value, info]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`${choice(role === value)} p-3 text-left`}
                >
                  <span className="block">{info.label}</span>
                  <span className="block text-xs font-normal text-muted">
                    {info.detail}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="u-name">
              Name
            </label>
            <input
              id="u-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === "client" ? "e.g. Mall Manager" : ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="u-email">
              Email
            </label>
            <input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="u-pass">
            {user ? "New password (optional)" : "Starting password"}
          </label>
          <PasswordInput
            id="u-pass"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <p className={hintClass}>
            {user
              ? "Leave empty to keep their password."
              : "Give it to them yourself; they change it under My account."}
          </p>
        </div>

        {role === "client" && (
          <>
            <div>
              <span className={labelClass}>Sites they can see</span>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {sites.map((site) => (
                  <label
                    key={site.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-brand/5"
                  >
                    <input
                      type="checkbox"
                      checked={siteIds.includes(site.id)}
                      onChange={() => toggleSite(site.id)}
                      className="h-4 w-4 accent-brand"
                    />
                    <SiteIcon site={site} size="sm" />
                    <span className="truncate text-sm">{site.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className={labelClass}>What they can do</span>
              <p className="mb-2 text-xs text-muted">
                They always see the Dashboard and Reports for their sites, and
                never Sites, Controllers or Users.
              </p>
              <div className="divide-y divide-line rounded-xl border border-line">
                {ACCESS_AREAS.map((area) => (
                  <div
                    key={area.key}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{area.label}</p>
                      <p className="text-xs text-muted">{area.detail}</p>
                    </div>
                    <div className="grid shrink-0 grid-cols-3 gap-1">
                      {Object.entries(ACCESS_LEVELS).map(([level, label]) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() =>
                            setAccess((a) => ({ ...a, [area.key]: level }))
                          }
                          className={`${choice(access[area.key] === level)} h-9 px-2 text-xs`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function UserRow({ user, you, sites, onEdit, onRemove }) {
  const theirSites = sites.filter((s) => user.siteIds?.includes(s.id));
  const allowed = ACCESS_AREAS.filter((a) => user.access?.[a.key] !== "none");
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
        {adminInitials(user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{user.name}</span>
          {you && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              You
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted">{user.email}</p>
        {user.role === "client" && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {theirSites.map((site) => (
                <span
                  key={site.id}
                  className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pr-2.5 pl-0.5 text-xs"
                >
                  <SiteIcon site={site} size="sm" />
                  {site.name}
                </span>
              ))}
              {theirSites.length === 0 && (
                <span className="text-xs text-amber-700">
                  No sites: they can't see anything
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Reports
              {allowed.map(
                (a) => ` · ${a.label}: ${ACCESS_LEVELS[user.access[a.key]]}`,
              )}
            </p>
          </>
        )}
        <p className="mt-1 text-xs text-muted sm:hidden">
          {user.lastActiveAt
            ? `Active ${timeAgo(user.lastActiveAt)}`
            : "Hasn't signed in yet"}
        </p>
      </div>
      <p className="hidden shrink-0 pt-1 text-right text-xs text-muted sm:block">
        {user.lastActiveAt
          ? `Active ${timeAgo(user.lastActiveAt)}`
          : "Hasn't signed in yet"}
      </p>
      <div className="flex shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-muted transition hover:bg-page hover:text-brand"
          aria-label={`Edit ${user.name}`}
        >
          <Pencil size={18} />
        </button>
        {!you && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
            aria-label={`Remove ${user.name}`}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Admins() {
  const { admins, sites, currentAdmin, addAdmin, updateAdmin, removeAdmin } =
    useData();
  const [editing, setEditing] = useState(null); // "new" or a user
  const [removing, setRemoving] = useState(null);

  const groups = [
    {
      title: "Admins",
      hint: "Your team. They see and change every site.",
      people: admins.filter((a) => a.role !== "client"),
    },
    {
      title: "Client logins",
      hint: "Customers who sign in to see their own sites.",
      people: admins.filter((a) => a.role === "client"),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Everyone who can sign in to Foyer: your team, and clients who see only
          their own sites.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={`${primaryButton} shrink-0`}
        >
          <UserPlus size={18} />
          Add user
        </button>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="space-y-2">
          <div>
            <h2 className="font-semibold">{group.title}</h2>
            <p className="text-sm text-muted">{group.hint}</p>
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {group.people.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                you={user.id === currentAdmin?.id}
                sites={sites}
                onEdit={() => setEditing(user)}
                onRemove={() => setRemoving(user)}
              />
            ))}
            {group.people.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nobody yet.
              </p>
            )}
          </div>
        </section>
      ))}

      {editing && (
        <UserModal
          user={editing === "new" ? null : editing}
          isYou={editing !== "new" && editing.id === currentAdmin?.id}
          sites={sites}
          emailsTaken={admins
            .filter((a) => a.id !== editing?.id)
            .map((a) => a.email)}
          onSave={async (values) => {
            const problem =
              editing === "new"
                ? await addAdmin(values)
                : await updateAdmin(editing.id, values);
            if (!problem) setEditing(null);
            return problem;
          }}
          onClose={() => setEditing(null)}
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