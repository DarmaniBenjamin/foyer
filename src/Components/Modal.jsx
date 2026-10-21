// A pop-up box in the middle of the screen, for forms like "Add
// controller". Show it only while it's open:
//   {open && <Modal title="…" onClose={…} onSubmit={…} footer={…}>…</Modal>}
// With onSubmit, the box is a form: Enter or the submit button runs it.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({ title, onClose, onSubmit, footer, children }) {
  // The page behind doesn't scroll while the box is open, and Escape
  // closes it
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const Body = onSubmit ? "form" : "div";
  const bodyProps = onSubmit
    ? {
        onSubmit: (e) => {
          e.preventDefault();
          onSubmit(e);
        },
      }
    : {};

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Body
        {...bodyProps}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-page"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </div>
        )}
      </Body>
    </div>,
    document.body,
  );
}