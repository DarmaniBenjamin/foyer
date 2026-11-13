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
//
// The page is only ever moved once per box or keyboard (never in answer
// to the screen moving), so it can't end up in a loop with the iPhone's
// own scrolling.

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

  // A box inside a pop-up (Modal.jsx) is looked after by the pop-up
  // itself: moving the page under it is what made it jump
  const typingIn = () => {
    const el = document.activeElement;
    return el?.matches?.(TYPING) && !el.closest("[data-modal]") ? el : null;
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
    window.scrollBy(0, Math.round(box.top + box.height / 2 - middle));
  };

  // The keyboard's height (from the screen's visible height, which
  // doesn't change when the iPhone slides the page)
  let keyboardWas = 0;
  const update = () => {
    // Nothing being typed in: no keyboard, whatever the sizes say
    if (!typingIn()) {
      keyboardWas = 0;
      return setRoom(0);
    }
    const gap = Math.max(0, Math.round(window.innerHeight - view.height));
    const keyboard = gap >= KEYBOARD_MIN ? gap : 0;
    setRoom(keyboard);
    // Only when the keyboard opens or changes size, after it's finished
    // sliding up
    if (Math.abs(keyboard - keyboardWas) < 40) return;
    keyboardWas = keyboard;
    clearTimeout(timer);
    timer = setTimeout(showBox, 150);
  };

  view.addEventListener("resize", update);
  document.addEventListener("focusin", (e) => {
    if (!e.target?.matches?.(TYPING) || e.target.closest("[data-modal]")) return;
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
