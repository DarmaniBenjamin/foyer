// Device whitelist: devices that skip the sign-in page (smart TVs,
// FireSticks, staff tablets). Follows the site switcher: one site's
// devices, or every site's on "All sites".
import { useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import useData from "../../useData";
import { whitelistStatus } from "../../whitelist";
import SiteIcon from "../SiteIcon";
import Modal from "../Modal";
import WhitelistModal from "../WhitelistModal";
import { dangerButton, primaryButton, secondaryButton } from "../formStyles";

const day = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function limits(w) {
  const speed =
    w.downKbps || w.upKbps
      ? `${w.downKbps ? `${w.downKbps / 1000}` : "Unlimited"}/${w.upKbps ? `${w.upKbps / 1000}` : "Unlimited"} Mbps`
      : "Unlimited";
  return `Data: ${w.dataMb ? `${w.dataMb} MB` : "Unlimited"} · Speed D/U: ${speed}`;
}

function Status({ status }) {
  return status === "active" ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      Ended
    </span>
  );
}

export default function Whitelist() {
  const { sites, whitelist, currentSite, addWhitelist, updateWhitelist, deleteWhitelist } =
    useData();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // "new" or an entry
  const [deleting, setDeleting] = useState(null);
  const [now] = useState(() => Date.now());

  const words = search.trim().toLowerCase();
  const list = whitelist
    .filter((w) => !currentSite || w.siteId === currentSite.id)
    .filter(
      (w) =>
        !words ||
        w.mac.toLowerCase().includes(words.replace(/-/g, ":")) ||
        w.note.toLowerCase().includes(words),
    );
  const siteOf = (w) => sites.find((s) => s.id === w.siteId);

  const actions = (w) => (
    <div className="flex shrink-0 justify-end">
      <button
        type="button"
        onClick={() => setEditing(w)}
        className="rounded-lg p-2 text-muted transition hover:bg-page hover:text-brand"
        aria-label="Edit"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        onClick={() => setDeleting(w)}
        className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
        aria-label="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Devices that go straight on to the Wi-Fi without the sign-in page,
          like a smart TV or a FireStick.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={`${primaryButton} shrink-0`}
        >
          <Plus size={18} />
          Add device
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a MAC address or note"
              className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-base outline-none focus:border-brand sm:text-sm"
            />
          </div>
        </div>

        {list.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">No devices here</p>
            <p className="mt-1 text-sm text-muted">
              {search ? "Nothing matches that search." : "Press Add device to add one."}
            </p>
          </div>
        ) : (
          <>
            {/* Computers: a table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide whitespace-nowrap text-muted uppercase">
                    <th className="px-4 py-3 font-medium">MAC address</th>
                    {!currentSite && <th className="px-4 py-3 font-medium">Site</th>}
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Ends</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((w) => {
                    const site = siteOf(w);
                    return (
                      <tr key={w.id} className="border-t border-line transition-colors hover:bg-brand/5">
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold">{w.mac}</p>
                          <p className="text-xs text-muted">{limits(w)}</p>
                        </td>
                        {!currentSite && (
                          <td className="px-4 py-3">
                            {site && (
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                <SiteIcon site={site} size="sm" />
                                {site.name}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Status status={whitelistStatus(w, now)} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {w.expiresAt ? day(w.expiresAt) : "Never"}
                        </td>
                        <td className="px-4 py-3">{w.note}</td>
                        <td className="px-2 py-3">{actions(w)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phones: cards */}
            <div className="divide-y divide-line md:hidden">
              {list.map((w) => {
                const site = siteOf(w);
                return (
                  <div key={w.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono font-semibold">{w.mac}</p>
                        <Status status={whitelistStatus(w, now)} />
                      </div>
                      <p className="mt-0.5 text-sm">{w.note}</p>
                      <p className="text-xs text-muted">
                        {!currentSite && site ? `${site.name} · ` : ""}
                        Ends {w.expiresAt ? day(w.expiresAt) : "never"}
                      </p>
                    </div>
                    {actions(w)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {editing && (
        <WhitelistModal
          entry={editing === "new" ? null : editing}
          siteId={currentSite?.id}
          onSave={(values) => {
            if (editing === "new") addWhitelist(values);
            else updateWhitelist(editing.id, values);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal
          title="Remove device?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={secondaryButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteWhitelist(deleting.id);
                  setDeleting(null);
                }}
                className={dangerButton}
              >
                Remove
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">
            {deleting.note} ({deleting.mac}) will see the sign-in page next
            time it connects.
          </p>
        </Modal>
      )}
    </div>
  );
}