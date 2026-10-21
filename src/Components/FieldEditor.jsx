// The questions on a site's sign-in form: rename them, pick their kind,
// make them required, put them in order, add and remove them. Each
// question becomes a column in the guest Excel export.
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FIELD_PRESETS, FIELD_TYPES, makeField } from "../data";
import { inputClass, secondaryButton } from "./formStyles";

function OptionsInput({ options, onChange }) {
  // Kept as typed (one per line) while editing, so empty lines can be
  // typed; empty ones are dropped when saved
  const [text, setText] = useState(options.join("\n"));
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        Choices, one per line
      </span>
      <textarea
        value={text}
        rows={Math.min(8, Math.max(3, options.length + 1))}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean),
          );
        }}
        className="w-full rounded-xl border border-line px-3 py-2 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm"
      />
    </label>
  );
}

function FieldRow({ field, index, count, onChange, onMove, onRemove }) {
  const iconButton =
    "rounded-lg p-2 text-muted transition hover:bg-page hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
          {index + 1}
        </span>
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Question"
          className={`${inputClass} font-medium`}
          aria-label="Question"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className={`${inputClass} sm:w-auto`}
          aria-label="Kind of question"
        >
          {Object.entries(FIELD_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm hover:bg-brand/5">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="h-4 w-4 accent-brand"
          />
          Required
        </label>
        <div className="ml-auto flex">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className={iconButton}
            aria-label="Move up"
          >
            <ArrowUp size={18} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className={iconButton}
            aria-label="Move down"
          >
            <ArrowDown size={18} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
            aria-label="Remove question"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {field.type === "checkbox" && (
        <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-page px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(field.consent)}
            onChange={(e) => onChange({ consent: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block font-medium">This is marketing consent</span>
            <span className="block text-xs text-muted">
              Ticking it means the guest agrees to marketing; shown as
              “Consented” on the Guests page.
            </span>
          </span>
        </label>
      )}
      {field.type === "choice" && (
        <OptionsInput
          options={field.options}
          onChange={(options) => onChange({ options })}
        />
      )}
    </div>
  );
}

export default function FieldEditor({ fields, onChange }) {
  const [adding, setAdding] = useState(false);
  const usedLabels = fields.map((f) => f.label.toLowerCase());
  const presets = FIELD_PRESETS.filter(
    (p) => !usedLabels.includes(p.label.toLowerCase()),
  );

  function update(index, changes) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...changes } : f)));
  }

  function move(index, by) {
    const next = [...fields];
    const [field] = next.splice(index, 1);
    next.splice(index + by, 0, field);
    onChange(next);
  }

  function add(preset) {
    const field = makeField(
      preset,
      fields.map((f) => f.key),
    );
    onChange([...fields, field]);
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">
          No questions yet. Guests would only press Connect.
        </p>
      )}
      {fields.map((field, index) => (
        <FieldRow
          key={field.key}
          field={field}
          index={index}
          count={fields.length}
          onChange={(changes) => update(index, changes)}
          onMove={(by) => move(index, by)}
          onRemove={() => onChange(fields.filter((_, i) => i !== index))}
        />
      ))}

      {adding ? (
        <div className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-3">
          <p className="mb-2 text-sm font-medium">Add a question</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => add(preset)}
                className={secondaryButton}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                add({ label: "New question", type: "text", required: false })
              }
              className={secondaryButton}
            >
              Your own question
            </button>
            <button
              type="button"
              onClick={() =>
                add({
                  label: "New question",
                  type: "choice",
                  required: false,
                  options: ["Option 1", "Option 2"],
                })
              }
              className={secondaryButton}
            >
              Pick from a list
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="h-11 px-3 text-sm font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`${secondaryButton} w-full border-dashed`}
        >
          <Plus size={18} />
          Add question
        </button>
      )}
    </div>
  );
}