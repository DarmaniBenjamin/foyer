// A pop-up box in the middle of the screen, for forms like "Add
// controller". Show it only while it's open:
//   {open && <Modal title="…" onClose={…} onSubmit={…} footer={…}>…</Modal>}
// With onSubmit, the box is a form: Enter or the submit button runs it.
//
// On phones and tablets it's shown as a page of its own instead (the page
// behind is hidden until it closes). A box fixed on top of the page, with
// its own scrolling, fights the iPhone's keyboard: the iPhone slides the
// screen to show what you're typing in, the box moves with it, and the
// two kept undoing each other, so it jumped up and down. As an ordinary
// page, the iPhone scrolls it like any other.
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const asPage = () => Boolean(window.matchMedia?.("(pointer: coarse)").matches);

// How many pop-ups are open as pages, and where the page was scrolled to
let pagesOpen = 0;
let scrolledTo = 0;

export default function Modal({ title, onClose, onSubmit, footer, children }) {
  const page = useRef(asPage()).current;

  // The page behind doesn't scroll while the box is open (phones: it's
  // hidden), and Escape closes it
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (page) {
      if (pagesOpen++ === 0) {
        scrolledTo = window.scrollY;
        html.classList.add("modal-page");
        window.scrollTo(0, 0);
      }
      return () => {
        if (--pagesOpen === 0) {
          html.classList.remove("modal-page");
          window.scrollTo(0, scrolledTo);
        }
      };
    }
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [page]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const header = (
    <div className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-page" aria-label="Close">
        <X size={20} />
      </button>
    </div>
  );
  const foot = footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>;

  if (page)
    return createPortal(
      <div className="fade-in min-h-[100dvh] bg-page px-3 py-3 sm:px-6 sm:py-6">
        <Body {...bodyProps} className="pop-in mx-auto w-full max-w-lg rounded-xl border border-line bg-white shadow-sm">
          {header}
          <div className="px-5 py-4">{children}</div>
          {foot}
        </Body>
      </div>,
      document.body,
    );

  return createPortal(
    <div
      data-modal=""
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Body
        {...bodyProps}
        className="pop-in flex max-h-full w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        {header}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {foot}
      </Body>
    </div>,
    document.body,
  );
}
