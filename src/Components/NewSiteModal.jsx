// The "Add site" box: the name, controller and how guests sign in, and
// (if you like) the company's colours and logo from its website.
// Everything else is set on the site's page afterwards.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Modal from "./Modal";
import BrandFromWebsite from "./BrandFromWebsite";
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
  // Colours and logo picked from the company's website, if any
  const [brand, setBrand] = useState(null);
  const [branding, setBranding] = useState(false);

  function save() {
    if (!name.trim()) return setError("Enter the site's name.");
    if (!controllerId) return setError("Add a controller first (Controllers page).");
    document.activeElement?.blur();
    onCreate({ name: name.trim(), controllerId: Number(controllerId), mode, look: brand ?? undefined });
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

        <div className="rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setBranding((b) => !b)}
            aria-expanded={branding}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold"
          >
            <span>
              Colours from the company's website
              <span className="block text-xs font-normal text-muted">
                {brand ? "Picked: they're added when you make the site" : "Optional"}
              </span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-muted transition ${branding ? "rotate-180" : ""}`} />
          </button>
          {branding && (
            <div className="border-t border-line p-3">
              <BrandFromWebsite
                look={brand ?? {}}
                keep="added when you make the site"
                onUse={(changes) => setBrand((b) => ({ ...b, ...changes }))}
              />
            </div>
          )}
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