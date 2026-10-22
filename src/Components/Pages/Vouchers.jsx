// Vouchers: the codes guests type on Voucher sites. Shows the site
// picked in the site switcher, or every site's vouchers on "All sites".
// Make them in batches, find them by batch, print them as cards.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Check,
  Copy,
  Printer,
  Search,
  TicketPlus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import useData from "../../useData";
import { SIGN_IN_MODES, formatMinutes } from "../../data";
import { VOUCHER_STATUSES, voucherStatus } from "../../vouchers";
import SiteIcon from "../SiteIcon";
import Modal from "../Modal";
import VoucherModal from "../VoucherModal";
import VoucherPrint from "../VoucherPrint";
import { dangerButton, primaryButton, secondaryButton } from "../formStyles";

const PAGE = 50;

const shortDate = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function StatusBadge({ status }) {
  const info = VOUCHER_STATUSES[status];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${info.badge}`}
    >
      {info.label}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // Copying isn't allowed here (e.g. plain http on a phone)
        }
      }}
      className="rounded-lg p-2 text-muted transition hover:bg-page hover:text-brand"
      aria-label={`Copy ${text}`}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

function DeleteButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
      aria-label="Delete voucher"
    >
      <Trash2 size={16} />
    </button>
  );
}

function limitsText(v) {
  const parts = [];
  if (v.downKbps) parts.push(`↓${v.downKbps / 1000} Mbps`);
  if (v.upKbps) parts.push(`↑${v.upKbps / 1000} Mbps`);
  if (v.dataMb) parts.push(`${v.dataMb} MB`);
  return parts.join(" · ");
}

export default function Vouchers() {
  const { sites, vouchers, currentSite, can, deleteVouchers } = useData();
  // Client logins with Read access can see and print, not make or delete
  const canEdit = can("vouchers", "write");
  const [status, setStatus] = useState("all");
  const [batch, setBatch] = useState("");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [making, setMaking] = useState(false);
  const [deleting, setDeleting] = useState(null); // { ids, text }
  const [printing, setPrinting] = useState(null);
  const [now] = useState(() => Date.now());

  const siteOf = (v) => sites.find((s) => s.id === v.siteId);

  // This site's vouchers (or every site's), with their status
  const forSite = useMemo(
    () =>
      vouchers
        .filter((v) => !currentSite || v.siteId === currentSite.id)
        .map((v) => ({ ...v, status: voucherStatus(v, now) })),
    [vouchers, currentSite, now],
  );

  const counts = useMemo(() => {
    const c = { all: forSite.length, ready: 0, "in-use": 0, used: 0, expired: 0 };
    for (const v of forSite) c[v.status] += 1;
    return c;
  }, [forSite]);

  const batches = [...new Set(forSite.map((v) => v.batch))];
  // A batch from another site doesn't apply after switching sites
  const activeBatch = batches.includes(batch) ? batch : "";

  const list = forSite.filter(
    (v) =>
      (status === "all" || v.status === status) &&
      (!activeBatch || v.batch === activeBatch) &&
      v.code.includes(search.trim().toUpperCase()),
  );

  // Printing: draw the cards, then open the print window
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const timer = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const printable = list.filter((v) => v.status === "ready" || v.status === "in-use");

  const tabs = [
    ["all", "All"],
    ["ready", "Ready"],
    ["in-use", "In use"],
    ["used", "Used up"],
    ["expired", "Expired"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          {currentSite
            ? `Codes guests type to get on ${currentSite.name}'s Wi-Fi.`
            : "Codes guests type to get on the Wi-Fi, for every site."}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setMaking(true)}
            className={`${primaryButton} shrink-0`}
          >
            <TicketPlus size={18} />
            Make vouchers
          </button>
        )}
      </div>

      {currentSite && currentSite.mode !== "voucher" && (
        <div className="flex gap-3 rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-sm text-amber-700">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>
            {currentSite.name} signs guests in with{" "}
            {SIGN_IN_MODES[currentSite.mode].label}, so its guests aren't asked
            for a code.
            {can("sites") && (
              <>
                {" "}
                <Link to={`/sites/${currentSite.id}`} className="font-semibold underline">
                  Change it on the site's page
                </Link>{" "}
                (Sign-in tab) to use vouchers.
              </>
            )}
          </p>
        </div>
      )}

      {/* Counts, which also filter the list */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.slice(1).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(status === value ? "all" : value);
              setShown(PAGE);
            }}
            className={`rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              status === value ? "border-brand/50 ring-[3px] ring-brand/10" : "border-line"
            }`}
          >
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{counts[value]}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatus(value);
                  setShown(PAGE);
                }}
                className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition ${
                  status === value
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:bg-brand/5 hover:text-ink"
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs opacity-70">{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
            <select
              value={activeBatch}
              onChange={(e) => {
                setBatch(e.target.value);
                setShown(PAGE);
              }}
              className="h-9 min-w-0 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-brand sm:text-sm"
              aria-label="Batch"
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a code"
                autoCapitalize="characters"
                className="h-9 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-base outline-none focus:border-brand sm:w-44 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* What can be done with what's listed */}
        {list.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <p className="mr-auto text-sm text-muted">
              {list.length} voucher{list.length === 1 ? "" : "s"}
              {activeBatch && ` in “${activeBatch}”`}
            </p>
            <button
              type="button"
              disabled={printable.length === 0}
              onClick={() => setPrinting(printable)}
              className={`${secondaryButton} h-9`}
            >
              <Printer size={16} />
              Print {printable.length}
            </button>
            {canEdit && activeBatch && (
              <button
                type="button"
                onClick={() =>
                  setDeleting({
                    ids: forSite.filter((v) => v.batch === activeBatch).map((v) => v.id),
                    text: `all ${forSite.filter((v) => v.batch === activeBatch).length} vouchers in “${activeBatch}”`,
                  })
                }
                className={`${secondaryButton} h-9 hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
              >
                <Trash2 size={16} />
                Delete batch
              </button>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">No vouchers here</p>
            <p className="mt-1 text-sm text-muted">
              {forSite.length
                ? "Nothing matches these filters."
                : canEdit
                  ? "Press Make vouchers to create some."
                  : "There are no vouchers yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Computers: a table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 font-medium">Code</th>
                    {!currentSite && <th className="px-4 py-3 font-medium">Site</th>}
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Devices</th>
                    <th className="px-4 py-3 font-medium">Use by</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, shown).map((v) => {
                    const site = siteOf(v);
                    return (
                      <tr
                        key={v.id}
                        className="border-t border-line transition-colors hover:bg-brand/5"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold tracking-wider">{v.code}</p>
                          <p className="text-xs text-muted">
                            {v.batch}
                            {limitsText(v) && ` · ${limitsText(v)}`}
                          </p>
                        </td>
                        {!currentSite && (
                          <td className="px-4 py-3">
                            {site && (
                              <span className="flex items-center gap-2">
                                <SiteIcon site={site} size="sm" />
                                <span className="truncate">{site.name}</span>
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatMinutes(v.minutes)}
                        </td>
                        <td className="px-4 py-3">
                          {v.uses}/{v.maxUses}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {v.validUntil ? shortDate(v.validUntil) : "No end"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end">
                            <CopyButton text={v.code} />
                            {canEdit && (
                              <DeleteButton
                                onClick={() =>
                                  setDeleting({ ids: [v.id], text: `voucher ${v.code}` })
                                }
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phones: cards */}
            <div className="divide-y divide-line md:hidden">
              {list.slice(0, shown).map((v) => {
                const site = siteOf(v);
                return (
                  <div key={v.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-semibold tracking-wider">{v.code}</p>
                        <StatusBadge status={v.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {formatMinutes(v.minutes)} · {v.uses}/{v.maxUses} devices
                        {v.validUntil && ` · use by ${shortDate(v.validUntil)}`}
                      </p>
                      <p className="text-xs text-muted">
                        {!currentSite && site ? `${site.name} · ` : ""}
                        {v.batch}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <CopyButton text={v.code} />
                      {canEdit && (
                        <DeleteButton
                          onClick={() =>
                            setDeleting({ ids: [v.id], text: `voucher ${v.code}` })
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {list.length > shown && (
              <div className="border-t border-line p-3 text-center">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className={secondaryButton}
                >
                  Show more ({list.length - shown} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {making && (
        <VoucherModal
          siteId={currentSite?.id}
          onMade={(made) => {
            setStatus("all");
            setBatch(made[0].batch);
            setShown(PAGE);
          }}
          onPrint={(made) => {
            setMaking(false);
            setPrinting(made);
          }}
          onClose={() => setMaking(false)}
        />
      )}

      {deleting && (
        <Modal
          title="Delete vouchers?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className={secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteVouchers(deleting.ids);
                  setDeleting(null);
                }}
                className={dangerButton}
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">
            This deletes {deleting.text}. Guests can't use{" "}
            {deleting.ids.length === 1 ? "it" : "them"} after, even if printed.
            Guests already on keep their time.
          </p>
        </Modal>
      )}

      {printing && <VoucherPrint vouchers={printing} sites={sites} />}
    </div>
  );
}