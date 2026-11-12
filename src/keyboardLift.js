// On phones: when you tap a box to type, the keyboard covers the bottom
// half of the screen. Pages that fit the screen exactly (the guest
// sign-in page, the admin sign-in) then have nothing to scroll, so the
// box stays hidden behind the keyboard.
//
// While the keyboard is up, this adds room under the page as tall as the
// keyboard (the --keyboard CSS value, see index.css), and scrolls the box
// you're typing in to the middle of what's still visible.
//
// Only while a box is being typed in: iPhones (iOS 26, and the Wi-Fi
// sign-in window) report the screen's height a little differently as the
// page moves, even with no keyboard. Adding and taking away room for those
// made the sign-in page jump up and down over and over.

// Smaller than any phone keyboard: a gap this small isn't one
const KEYBOARD_MIN = 150;

const TYPING = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select";

export function startKeyboardLift() {
  const view = window.visualViewport;
  if (!view || !window.matchMedia?.("(pointer: coarse)").matches) return;
  const root = document.documentElement;
  let timer = null;
  let room = 0; // the room added now
  const setRoom = (px) => {
    if (px === room) return;
    room = px;
    root.style.setProperty("--keyboard", `${px}px`);
  };

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
    // Nothing being typed in: no keyboard, whatever the sizes say
    if (!typingIn()) return setRoom(0);
    const keyboard = Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop));
    setRoom(keyboard >= KEYBOARD_MIN ? keyboard : 0);
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
      if (!typingIn()) setRoom(0);
    }, 150);
  });
}
