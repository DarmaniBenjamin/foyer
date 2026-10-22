// The "Add site" box: just the name, controller and how guests sign in.
// Everything else is set on the site's page afterwards.
import { useState } from "react";
import Modal from "./Modal";
import useData from "../useData";
import { CONTROLLER_KINDS, SIGN_IN_MODES } from "../data";
import {
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "./formStyles";

export default function NewSiteModal({ onCreate, onClose }) {
  const { controllers } = useData();
  const [name, setName] = useState("");
  const [controllerId, setControllerId] = useState(controllers[0]?.id ?? "");
  const [mode, setMode] = useState("form");
  const [error, setError] = useState("");

  function save() {
    if (!name.trim()) return setError("Enter the site's name.");
    if (!controllerId) return setError("Add a controller first (Controllers page).");
    document.activeElement?.blur();
    onCreate({ name: name.trim(), controllerId: Number(controllerId), mode });
  }

  return (
    <Modal
      title="Add site"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            Add site
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="site-name">
            Site name
          </label>
          <input
            id="site-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grand Anse Mall"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="site-controller">
            Controller
          </label>
          <select
            id="site-controller"
            value={controllerId}
            onChange={(e) => setControllerId(e.target.value)}
            className={inputClass}
          >
            {controllers.length === 0 && <option value="">No controllers yet</option>}
            {controllers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({CONTROLLER_KINDS[c.kind].label})
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>How guests sign in</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(SIGN_IN_MODES).map(([value, info]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-lg border p-3 text-left transition ${
                  mode === value
                    ? "border-brand bg-brand/10"
                    : "border-line hover:border-brand/40 hover:bg-brand/5"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${mode === value ? "text-brand" : ""}`}
                >
                  {info.label}
                </span>
                <span className="block text-xs text-muted">{info.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}