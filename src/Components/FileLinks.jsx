// A picture's or video's web address, with Copy, Open and Download.
// Open it in any browser to see the file, or share it.
//   url: its address on Foyer ("/media/…" or "/ad-pictures/…"), or "" if it
//     has none yet (a picture added to an ad that isn't saved yet)
//   file: the file itself (a "data:" link), so it can still be
//     downloaded before it has an address
//   name: the file name to download it as
//   waiting: what to say when there's no address yet
import { useState } from "react";
import { Check, Download, ExternalLink, Link2 } from "lucide-react";

const small =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-transparent px-2 text-xs font-medium text-ink transition hover:border-brand/40 hover:bg-brand/5 disabled:pointer-events-none disabled:opacity-40";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page not on https: the old way
    const box = document.createElement("textarea");
    box.value = text;
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const done = document.execCommand("copy");
    box.remove();
    return done;
  }
}

export default function FileLinks({ url, file, name, waiting = "Save to get its link" }) {
  const [copied, setCopied] = useState(false);
  const full = url ? new URL(url, window.location.origin).href : "";
  const downloadHref = url ? `${url}${url.includes("?") ? "&" : "?"}download=1` : file;

  async function copy() {
    if (await copyText(full)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      {full ? (
        <input
          readOnly
          value={full}
          onFocus={(e) => e.target.select()}
          aria-label="Its web address"
          className="h-8 w-full min-w-0 truncate rounded-md border border-line bg-page px-2 font-mono text-[11px] text-muted"
        />
      ) : (
        <p className="text-xs text-muted">{waiting}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={copy} disabled={!full} className={small}>
          {copied ? <Check size={13} className="text-green-600" /> : <Link2 size={13} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={full || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!full}
          className={`${small} ${full ? "" : "pointer-events-none opacity-40"}`}
        >
          <ExternalLink size={13} />
          Open
        </a>
        <a
          href={downloadHref || undefined}
          download={name || true}
          aria-disabled={!downloadHref}
          className={`${small} ${downloadHref ? "" : "pointer-events-none opacity-40"}`}
        >
          <Download size={13} />
          Download
        </a>
      </div>
    </div>
  );
}
