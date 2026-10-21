// Controllers: the UniFi and Omada controllers on the Linode. Each site
// signs its guests in through one of them.
//
// Test connection signs in to the controller from the server (UniFi: a
// local admin; Omada: a Hotspot Operator) and shows what it found.
import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Pencil,
  PlugZap,
  Plus,
  Router,
  Trash2,
} from "lucide-react";
import useData from "../../useData";
import { CONTROLLER_KINDS, timeAgo } from "../../data";
import ControllerModal from "../ControllerModal";
import Modal from "../Modal";
import SiteIcon from "../SiteIcon";
import { dangerButton, primaryButton, secondaryButton } from "../formStyles";

function TestResult({ test }) {
  if (!test)
    return <p className="text-sm text-muted">Not tested yet</p>;
  const Icon = test.ok ? CircleCheck : CircleAlert;
  return (
    <div
      className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${
        test.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">
          {test.ok ? "Connected" : "Couldn't connect"} · {timeAgo(test.at)}
        </p>
        <p className="opacity-90">{test.message}</p>
      </div>
    </div>
  );
}

function ControllerCard({ controller, usedBy, isCurrent, onEdit, onDelete }) {
  const { testController } = useData();
  const [testing, setTesting] = useState(false);
  const kind = CONTROLLER_KINDS[controller.kind];

  async function test() {
    setTesting(true);
    await testController(controller.id);
    setTesting(false);
  }

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 transition hover:shadow-md ${
        isCurrent ? "border-brand/50 ring-4 ring-brand/10" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Router size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{controller.name}</h3>
            <span className="rounded-full bg-page px-2 py-0.5 text-xs font-medium text-muted">
              {kind.label}
            </span>
            {isCurrent && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                This site's controller
              </span>
            )}
          </div>
          <p className="truncate text-sm text-muted">{controller.url}</p>
          <p className="text-sm text-muted">
            {controller.kind === "omada" ? "Operator" : "Admin"}:{" "}
            {controller.username}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
          Sites ({usedBy.length})
        </p>
        {usedBy.length ? (
          <div className="flex flex-wrap gap-2">
            {usedBy.map((site) => (
              <span
                key={site.id}
                className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-sm"
              >
                <SiteIcon site={site} size="sm" />
                {site.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No sites use it yet.</p>
        )}
      </div>

      <TestResult test={controller.lastTest} />

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={test}
          disabled={testing}
          className={`${primaryButton} flex-1 sm:flex-none`}
        >
          {testing ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <PlugZap size={18} />
          )}
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={secondaryButton}
          aria-label="Edit"
        >
          <Pencil size={16} />
          <span className="hidden sm:inline">Edit</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={`${secondaryButton} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Controllers() {
  const {
    controllers,
    sites,
    currentSite,
    addController,
    updateController,
    deleteController,
  } = useData();
  // null = closed, "new" = adding, or the controller being edited
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  function save(values) {
    if (editing === "new") addController(values);
    else updateController(editing.id, values);
    setEditing(null);
  }

  const usedBy = (c) => sites.filter((s) => s.controllerId === c.id);
  const deletingSites = deleting ? usedBy(deleting) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          The UniFi and Omada controllers on your Linode. Each site signs its
          guests in through one of them.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={`${primaryButton} shrink-0`}
        >
          <Plus size={18} />
          Add controller
        </button>
      </div>

      {controllers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="font-medium">No controllers yet</p>
          <p className="mt-1 text-sm text-muted">
            Add your UniFi or Omada controller to start.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {controllers.map((c) => (
            <ControllerCard
              key={c.id}
              controller={c}
              usedBy={usedBy(c)}
              isCurrent={currentSite?.controllerId === c.id}
              onEdit={() => setEditing(c)}
              onDelete={() => setDeleting(c)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ControllerModal
          controller={editing === "new" ? null : editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal
          title="Delete controller?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className={secondaryButton}
              >
                {deletingSites.length ? "OK" : "Cancel"}
              </button>
              {deletingSites.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    deleteController(deleting.id);
                    setDeleting(null);
                  }}
                  className={dangerButton}
                >
                  Delete
                </button>
              )}
            </>
          }
        >
          {deletingSites.length ? (
            <p className="text-sm text-muted">
              {deleting.name} is used by{" "}
              {deletingSites.map((s) => s.name).join(", ")}. Move{" "}
              {deletingSites.length === 1 ? "that site" : "those sites"} to
              another controller first, so guests can still sign in.
            </p>
          ) : (
            <p className="text-sm text-muted">
              {deleting.name} will be removed from the portal. Nothing changes
              on the controller itself.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
