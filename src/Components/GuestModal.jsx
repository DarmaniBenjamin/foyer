// One guest's details: what they typed, their device, and their recent
// sign-ins. Also where a guest is removed when they ask to be forgotten.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "./Modal";
import SiteIcon from "./SiteIcon";
import useData from "../useData";
import { answerText, dateTime, guestName } from "../guests";
import { dangerButton, secondaryButton } from "./formStyles";

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm text-muted sm:w-44">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function GuestModal({ guest, onClose }) {
  const { sites, connections, deleteGuest } = useData();
  const [confirming, setConfirming] = useState(false);
  const site = sites.find((s) => s.id === guest.siteId);
  const fields = site?.fields ?? [];

  // Answers to questions that were later removed from the form
  const current = new Set(fields.map((f) => f.key));
  const older = Object.entries(guest.answers ?? {}).filter(
    ([key, value]) => !current.has(key) && value !== "" && value !== null,
  );

  const recent = connections
    .filter((c) => c.guestId === guest.id)
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  return (
    <Modal
      title={guestName(guest, site)}
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <p className="mr-auto self-center text-sm text-muted">
              Remove this guest and their answers?
            </p>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={secondaryButton}
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                deleteGuest(guest.id);
                onClose();
              }}
              className={dangerButton}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${secondaryButton} mr-auto hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
            >
              <Trash2 size={16} />
              Forget guest
            </button>
            <button type="button" onClick={onClose} className={secondaryButton}>
              Close
            </button>
          </>
        )
      }
    >
      {site && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <SiteIcon site={site} size="sm" />
          {site.name}
        </div>
      )}

      <dl className="divide-y divide-line">
        {site?.mode === "form" &&
          fields.map((field) => (
            <Row key={field.key} label={field.label}>
              {answerText(field, guest.answers?.[field.key])}
            </Row>
          ))}
        {older.map(([key, value]) => (
          <Row key={key} label={`${key.replaceAll("_", " ")} (old question)`}>
            {String(value)}
          </Row>
        ))}
        <Row label="Device (MAC)">
          <span className="font-mono">{guest.mac}</span>
        </Row>
        <Row label="Visits">{guest.visits}</Row>
        <Row label="First seen">{dateTime(guest.firstSeenAt)}</Row>
        <Row label="Last seen">{dateTime(guest.lastSeenAt)}</Row>
      </dl>

      {recent.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Recent sign-ins
          </p>
          <ul className="space-y-1 text-sm">
            {recent.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>{dateTime(c.at)}</span>
                <span className="text-muted capitalize">{c.method}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}