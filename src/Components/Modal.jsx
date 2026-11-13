// A pop-up box in the middle of the screen, for forms like "Add
// controller". Show it only while it's open:
//   {open && <Modal title="…" onClose={…} onSubmit={…} footer={…}>…</Modal>}
// With onSubmit, the box is a form: Enter or the submit button runs it.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// The box sits in the part of the screen the phone's keyboard leaves
// visible. iPhones slide the whole page up under a fixed box when the
// keyboard opens, and moving the page back made the box jump up and down
// over and over; following the visible area instead keeps it still, and
// the box being typed in is scrolled into view inside the box.
function useVisibleArea(ref) {
  useEffect(() => {
    const view = window.visualViewport;
    const el = ref.current;
    if (!view || !el) return undefined;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = window.innerHeight - view.height > 1 || view.offsetTop > 1;
        el.style.top = covered ? `${view.offsetTop}px` : "";
        el.style.height = covered ? `${view.height}px` : "";
        el.style.bottom = covered ? "auto" : "";
      });
    };
    const showTyping = () => {
      const box = document.activeElement;
      if (!box || !el.contains(box) || !box.matches?.("input, textarea, select")) return;
      setTimeout(() => box.scrollIntoView({ block: "nearest", behavior: "smooth" }), 300);
    };
    fit();
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    el.addEventListener("focusin", showTyping);
    return () => {
      cancelAnimationFrame(frame);
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
      el.removeEventListener("focusin", showTyping);
    };
  }, [ref]);
}

export default function Modal({ title, onClose, onSubmit, footer, children }) {
  const overlay = useRef(null);
  useVisibleArea(overlay);
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
      ref={overlay}
      data-modal=""
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Body
        {...bodyProps}
        className="pop-in flex max-h-full w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
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
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
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