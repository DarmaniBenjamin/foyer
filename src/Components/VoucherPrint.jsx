// The voucher cards that get printed (A4, 3 across). Shown only on paper:
// on screen it's hidden, and while printing everything else is (see the
// "Printing" part of index.css).
import { createPortal } from "react-dom";
import { formatMinutes, textOn } from "../data";

const date = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Card({ voucher, site }) {
  const color = site?.look.color ?? "#1d64d8";
  return (
    <div
      style={{
        border: "1px solid #d0d5dd",
        borderRadius: 12,
        overflow: "hidden",
        breakInside: "avoid",
        fontFamily: "Geist, system-ui, sans-serif",
        color: "#101828",
        background: "#fff",
      }}
    >
      <div
        style={{
          background: color,
          color: textOn(color),
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        {site?.name ?? "Guest Wi-Fi"}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        {site?.look.logo && (
          <img
            src={site.look.logo}
            alt=""
            style={{ maxHeight: 28, maxWidth: "60%", marginBottom: 6 }}
          />
        )}
        <div style={{ fontSize: 10, color: "#667085" }}>Wi-Fi voucher code</div>
        <div
          style={{
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            margin: "2px 0 6px",
          }}
        >
          {voucher.code}
        </div>
        <div style={{ fontSize: 10, color: "#475467", lineHeight: 1.5 }}>
          Good for {formatMinutes(voucher.minutes)}
          {voucher.maxUses > 1 ? ` · ${voucher.maxUses} devices` : ""}
          {voucher.validUntil && (
            <>
              <br />
              Use by {date(voucher.validUntil)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VoucherPrint({ vouchers, sites }) {
  return createPortal(
    <div className="print-sheet">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "6mm",
        }}
      >
        {vouchers.map((v) => (
          <Card key={v.id} voucher={v} site={sites.find((s) => s.id === v.siteId)} />
        ))}
      </div>
    </div>,
    document.body,
  );
}