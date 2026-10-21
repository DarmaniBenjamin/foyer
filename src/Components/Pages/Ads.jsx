// Splash ads: pictures shown on a site's guest page for a few seconds,
// before signing in or after connecting. Follows the site switcher: one
// site's ads, or every site's on "All sites". Each ad shows its views,
// taps and click rate.
import { useState } from "react";
import { Eye, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import useData from "../../useData";
import { AD_WHEN, adStatus, clickRate } from "../../ads";
import SiteIcon from "../SiteIcon";
import Modal from "../Modal";
import AdModal from "../AdModal";
import { dangerButton, primaryButton, secondaryButton } from "../formStyles";

const STATUS = {
  running: ["Running", "bg-emerald-50 text-emerald-800"],
  scheduled: ["Starts later", "bg-brand-soft text-brand"],
  ended: ["Ended", "bg-amber-50 text-amber-700"],
  off: ["Off", "bg-page text-muted"],
};

const day = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function dates(ad) {
  if (!ad.startsAt && !ad.endsAt) return "No end date";
  if (ad.startsAt && ad.endsAt) return `${day(ad.startsAt)} – ${day(ad.endsAt)}`;
  return ad.startsAt ? `From ${day(ad.startsAt)}` : `Until ${day(ad.endsAt)}`;
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer" title={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20" />
      <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

export default function Ads() {
  const { sites, ads, currentSite, addAd, updateAd, deleteAd } = useData();
  const [editing, setEditing] = useState(null); // "new" or an ad
  const [deleting, setDeleting] = useState(null);
  const [now] = useState(() => Date.now());

  const list = ads.filter((a) => !currentSite || a.siteId === currentSite.id);
  const siteOf = (a) => sites.find((s) => s.id === a.siteId);
  const totalViews = list.reduce((n, a) => n + a.views, 0);
  const totalClicks = list.reduce((n, a) => n + a.clicks, 0);
  const running = list.filter((a) => adStatus(a, now) === "running").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Pictures guests see full screen for a few seconds on the Wi-Fi
          page. If a site has more than one running, they take turns.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={`${primaryButton} shrink-0`}
        >
          <Plus size={18} />
          New ad
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Running", running],
          ["Views", totalViews],
          ["Taps", totalClicks],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-3 sm:p-4">
            <p className="text-xs text-muted sm:text-sm">{label}</p>
            <p className="text-xl font-semibold">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-14 text-center">
          <p className="font-medium">No splash ads yet</p>
          <p className="mt-1 text-sm text-muted">Press New ad to add one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((ad) => {
            const site = siteOf(ad);
            const [statusLabel, statusClass] = STATUS[adStatus(ad, now)];
            return (
              <div
                key={ad.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white"
              >
                <button
                  type="button"
                  onClick={() => setEditing(ad)}
                  className="flex h-48 items-center justify-center bg-black/90 p-3"
                  aria-label={`Edit ${ad.name}`}
                >
                  <img
                    src={ad.image}
                    alt=""
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                </button>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{ad.name}</p>
                      <p className="text-xs text-muted">
                        {AD_WHEN[ad.when].label} · {ad.seconds} s
                      </p>
                    </div>
                    <Toggle
                      checked={ad.active}
                      onChange={(active) => updateAd(ad.id, { active })}
                      label={ad.active ? "Turn off" : "Turn on"}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <span className="text-muted">{dates(ad)}</span>
                  </div>

                  {!currentSite && site && (
                    <p className="flex items-center gap-2 text-sm">
                      <SiteIcon site={site} size="sm" />
                      <span className="truncate">{site.name}</span>
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-4 border-t border-line pt-3 text-sm">
                    <span className="flex items-center gap-1.5" title="Views">
                      <Eye size={16} className="text-muted" />
                      {ad.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5" title="Taps">
                      <MousePointerClick size={16} className="text-muted" />
                      {ad.clicks.toLocaleString()}
                      <span className="text-xs text-muted">({clickRate(ad)})</span>
                    </span>
                    <div className="ml-auto flex">
                      <button
                        type="button"
                        onClick={() => setEditing(ad)}
                        className="rounded-lg p-2 text-muted transition hover:bg-page hover:text-brand"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(ad)}
                        className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AdModal
          ad={editing === "new" ? null : editing}
          siteId={currentSite?.id}
          onSave={(values) => {
            if (editing === "new") addAd(values);
            else updateAd(editing.id, values);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={secondaryButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAd(deleting.id);
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
            Guests stop seeing it, and its view and tap counts are removed.
            To pause it instead, turn it off.
          </p>
        </Modal>
      )}
    </div>
  );
}