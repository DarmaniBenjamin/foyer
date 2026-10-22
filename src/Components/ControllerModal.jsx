// The "Add controller" / "Edit controller" box
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Modal from "./Modal";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "./formStyles";
import { CONTROLLER_KINDS } from "../data";

const HELP = {
  unifi: {
    url: "https://unifi.yourdomain.com:8443",
    user: "Local admin username",
    userHint:
      "A local admin made for the portal on the controller (not a ui.com account, and without two-step sign-in).",
  },
  omada: {
    url: "https://omada.yourdomain.com:8043",
    user: "Hotspot Operator username (optional with the Open API)",
    userHint:
      "An operator from Hotspot Manager → Operators, with the portal's sites ticked. Not needed when the Open API is filled in: Foyer then makes an operator for each site it sets up.",
  },
};

// controller: the one being edited, or null to add a new one
export default function ControllerModal({ controller, onSave, onClose }) {
  const editing = Boolean(controller);
  const [kind, setKind] = useState(controller?.kind ?? "unifi");
  const [name, setName] = useState(controller?.name ?? "");
  const [url, setUrl] = useState(controller?.url ?? "");
  const [username, setUsername] = useState(controller?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [allowSelfSigned, setAllowSelfSigned] = useState(
    controller?.allowSelfSigned ?? false,
  );
  const [timeUnit, setTimeUnit] = useState(controller?.timeUnit ?? "auto");
  const [clientId, setClientId] = useState(controller?.openApi?.clientId ?? "");
  const [secret, setSecret] = useState("");
  const hadSecret = Boolean(controller?.openApi?.clientId);
  const [error, setError] = useState("");

  const help = HELP[kind];

  function save() {
    const address = url.trim().replace(/\/+$/, "");
    if (!name.trim()) return setError("Give the controller a name.");
    try {
      const parsed = new URL(address);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return setError(`Enter the full address, like ${help.url}`);
    }
    const withApi = kind === "omada" && clientId.trim();
    if (!username.trim() && !withApi) return setError("Enter the username.");
    if (!editing && !password && !withApi) return setError("Enter the password.");
    if (withApi && !secret && !(hadSecret && clientId.trim() === controller.openApi.clientId))
      return setError("Enter the Open API Client Secret.");

    // Blur first, so an iPhone's keyboard doesn't stay up after closing
    document.activeElement?.blur();
    onSave({
      kind,
      name: name.trim(),
      url: address,
      username: username.trim(),
      allowSelfSigned,
      timeUnit,
      // Empty when editing = keep the saved password
      ...(password ? { password } : {}),
      ...(kind === "omada"
        ? { openApiClientId: clientId.trim(), ...(secret ? { openApiSecret: secret } : {}) }
        : {}),
    });
  }

  return (
    <Modal
      title={editing ? "Edit controller" : "Add controller"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            {editing ? "Save changes" : "Add controller"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className={labelClass}>Type</span>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CONTROLLER_KINDS).map(([value, info]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`h-9 rounded-lg border text-sm font-semibold transition ${
                  kind === value
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-muted hover:border-brand/40 hover:bg-brand/5"
                }`}
              >
                {info.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="ctl-name">
            Name
          </label>
          <input
            id="ctl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${CONTROLLER_KINDS[kind].label} controller`}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="ctl-url">
            Address
          </label>
          <input
            id="ctl-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={help.url}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            className={inputClass}
          />
          <p className={hintClass}>
            The controller's domain with its port (UniFi is usually{" "}
            {CONTROLLER_KINDS.unifi.defaultPort}, Omada{" "}
            {CONTROLLER_KINDS.omada.defaultPort}).
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="ctl-user">
            {help.user}
          </label>
          <input
            id="ctl-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            className={inputClass}
          />
          <p className={hintClass}>{help.userHint}</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="ctl-pass">
            Password
          </label>
          <div className="relative">
            <input
              id="ctl-pass"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={editing ? "Leave empty to keep the current one" : ""}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-page"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {kind === "omada" && (
          <div className="space-y-3 rounded-lg border border-line p-3">
            <div>
              <p className="text-sm font-medium">Open API (to set sites up from Foyer)</p>
              <p className={hintClass}>
                In Omada: <b>Global view → Settings → Platform Integration → Open API → Add New
                App</b>, mode <b>Client Credentials</b>, an admin role with the sites ticked.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="ctl-client">
                Client ID
              </label>
              <input
                id="ctl-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ctl-secret">
                Client Secret
              </label>
              <input
                id="ctl-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={hadSecret ? "Leave empty to keep the current one" : ""}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>
        )}

        {kind === "omada" && (
          <div>
            <label className={labelClass} htmlFor="ctl-unit">
              Guest time unit
            </label>
            <select
              id="ctl-unit"
              value={timeUnit}
              onChange={(e) => setTimeUnit(e.target.value)}
              className={inputClass}
            >
              <option value="auto">Automatic (from the controller's version)</option>
              <option value="us">Microseconds (Omada 5.x to 6.2.0)</option>
              <option value="ms">Milliseconds (Omada 6.2.10 and newer)</option>
            </select>
            <p className={hintClass}>
              Leave it on Automatic unless guests get the wrong amount of time.
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-brand/5">
          <input
            type="checkbox"
            checked={allowSelfSigned}
            onChange={(e) => setAllowSelfSigned(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block text-sm font-medium">
              Allow a self-signed certificate
            </span>
            <span className="block text-xs text-muted">
              Leave it off: your controllers have real SSL certificates.
            </span>
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}