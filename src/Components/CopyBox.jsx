// An address to copy, with a Copy button
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyBox({ text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Copying isn't allowed here (e.g. a phone on plain http): the
      // address can still be selected and copied by hand
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-page p-1 pl-3">
      <code className="min-w-0 flex-1 truncate text-sm select-all">{text}</code>
      <button
        type="button"
        onClick={copy}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium shadow-sm hover:text-brand"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
