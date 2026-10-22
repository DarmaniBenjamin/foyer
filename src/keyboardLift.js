// On phones: when you tap a box to type, the keyboard covers the bottom
// half of the screen. Pages that fit the screen exactly (the guest
// sign-in page, the admin sign-in) then have nothing to scroll, so the
// box stays hidden behind the keyboard.
//
// While the keyboard is up, this adds room under the page as tall as the
// keyboard (the --keyboard CSS value, see index.css), and scrolls the box
// you're typing in to the middle of what's still visible.
const TYPING = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select";

export function startKeyboardLift() {
  const view = window.visualViewport;
  if (!view || !window.matchMedia?.("(pointer: coarse)").matches) return;
  const root = document.documentElement;
  let timer = null;

  const typingIn = () => {
    const el = document.activeElement;
    return el?.matches?.(TYPING) ? el : null;
  };

  const showBox = () => {
    const el = typingIn();
    if (!el) return;
    // Where the box is within what can still be seen above the keyboard
    const box = el.getBoundingClientRect();
    const top = view.offsetTop;
    const bottom = view.offsetTop + view.height;
    if (box.top >= top + 12 && box.bottom <= bottom - 12) return;
    const middle = top + view.height / 2;
    window.scrollBy({ top: box.top + box.height / 2 - middle, behavior: "smooth" });
  };

  const update = () => {
    const keyboard = Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop));
    root.style.setProperty("--keyboard", `${keyboard > 80 ? keyboard : 0}px`);
    clearTimeout(timer);
    // After the keyboard has finished sliding up
    timer = setTimeout(showBox, 120);
  };

  view.addEventListener("resize", update);
  view.addEventListener("scroll", update);
  document.addEventListener("focusin", (e) => {
    if (!e.target?.matches?.(TYPING)) return;
    clearTimeout(timer);
    timer = setTimeout(showBox, 350);
  });
  document.addEventListener("focusout", () => {
    // The keyboard goes away when nothing is being typed in
    setTimeout(() => {
      if (!typingIn()) root.style.setProperty("--keyboard", "0px");
    }, 150);
  });
}
