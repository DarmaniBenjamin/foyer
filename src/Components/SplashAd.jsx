// A splash ad over the whole guest page: the picture, and a countdown.
// When it reaches 0 the ad closes by itself and the guest goes on;
// there's nothing to press. Tapping the picture opens its link.
// An ad with several pictures shows them one under the other, to scroll
// through like a web page. An ad built in the page builder shows its page
// as it looks on this screen (computer, tablet or phone). Pictures are as
// big as the ad says for this kind of screen (see AD_LOOK in ads.js).
// onView() runs once when it shows, onClick() when the picture is
// tapped, onDone() when its time is up.
// In the admin preview (preview), nothing is counted and it sits inside
// its box instead of covering the screen; device says which screen it's
// showing (computer, tablet or phone), previewHeight how tall that is.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { adPictures, pictureLook } from "../ads";
import { deviceFor } from "../adDesign";
import AdDesignView from "./AdDesignView";

// One picture, as big as size (% of the box's width) allows while
// staying inside the box's height, without stretching it
function FitPicture({ src, alt, size, wrap = (img) => img }) {
  const box = useRef(null);
  const [room, setRoom] = useState(null); // { w, h } of the box
  const [shape, setShape] = useState(null); // width ÷ height of the picture
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  let width = null;
  if (room && shape) width = Math.min((room.w * size) / 100, room.h * shape);
  return (
    <div ref={box} className="flex h-full w-full items-center justify-center">
      {wrap(
        <img
          src={src}
          alt={alt}
          onLoad={(e) => setShape(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 1)}
          style={width ? { width, height: width / shape } : { maxWidth: `${size}%`, maxHeight: "100%" }}
          className="rounded-2xl object-contain shadow-2xl"
        />,
      )}
    </div>
  );
}

export default function SplashAd({
  ad,
  onView,
  onClick,
  onDone,
  preview = false,
  device: shown = "phone",
  previewHeight = 722,
}) {
  const [left, setLeft] = useState(ad.seconds);
  const counted = useRef(false);

  // Count the view once (React's checks in development run effects twice)
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    onView?.();
  }, [onView]);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  // Time's up: the ad closes and the guest goes on, once
  const finished = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    doneRef.current?.();
  }, [left]);

  const pictures = adPictures(ad);
  const [scrolled, setScrolled] = useState(false);

  const skip = (
    <div className="absolute top-3 right-3 z-10">
      <span className="flex h-9 items-center gap-2 rounded-full bg-black/60 px-3 text-xs font-semibold text-white tabular-nums backdrop-blur">
        <span
          className="h-4 w-4 rounded-full"
          style={{
            background: `conic-gradient(white ${(1 - Math.max(left, 0) / Math.max(ad.seconds, 1)) * 360}deg, rgba(255,255,255,0.25) 0)`,
            transition: "background 1s linear",
          }}
        />
        {left > 0 ? `${left}` : "…"}
      </span>
    </div>
  );

  // Ads look different on a computer, tablet or phone
  const [screen, setScreen] = useState(() => (typeof window === "undefined" ? 390 : window.innerWidth));
  const [tall, setTall] = useState(() => (typeof window === "undefined" ? 844 : window.innerHeight));
  useEffect(() => {
    if (preview) return undefined;
    const onResize = () => (setScreen(window.innerWidth), setTall(window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [preview]);
  const device = preview ? shown : deviceFor(screen);
  const look = pictureLook(ad, device);

  if (ad.design)
    return (
      <div
        data-portal
        className={`${preview ? "absolute" : "fixed"} inset-0 z-40 flex flex-col`}
        style={{ backgroundColor: ad.design.background }}
        role="dialog"
        aria-label="Advert"
      >
        {skip}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={(e) => e.currentTarget.scrollTop > 20 && setScrolled(true)}
        >
          <AdDesignView
            design={ad.design}
            device={device}
            screenHeight={preview ? previewHeight : tall}
            onLinkClick={() => !preview && onClick?.()}
          />
        </div>
      </div>
    );

  if (pictures.length > 1)
    return (
      <div
        data-portal
        className={`${preview ? "absolute" : "fixed"} inset-0 z-40 flex flex-col bg-black/95 backdrop-blur-sm`}
        role="dialog"
        aria-label="Advert"
      >
        {skip}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={(e) => e.currentTarget.scrollTop > 20 && setScrolled(true)}
        >
          <div
            className="mx-auto flex flex-col gap-3 px-3 pt-14 pb-6"
            style={{ width: `${look.size}%` }}
          >
            {pictures.map((p, i) => {
              const img = <img src={p.image} alt={`${ad.name} ${i + 1}`} className="w-full rounded-2xl shadow-2xl" />;
              return p.link ? (
                <a
                  key={i}
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => !preview && onClick?.()}
                  className="block"
                >
                  {img}
                </a>
              ) : (
                <div key={i}>{img}</div>
              );
            })}
            <p className="text-center text-[11px] text-white/50">Advert</p>
          </div>
        </div>
        {!scrolled && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="flex animate-bounce items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow">
              <ChevronDown size={14} />
              Scroll for more
            </span>
          </div>
        )}
      </div>
    );

  const open = (children, className) =>
    ad.link ? (
      <a
        href={ad.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => !preview && onClick?.()}
        className={className}
      >
        {children}
      </a>
    ) : (
      <div className={className}>{children}</div>
    );

  const findOutMore = ad.link && (
    <a
      href={ad.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => !preview && onClick?.()}
      className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/80 underline"
    >
      Find out more
      <ExternalLink size={12} />
    </a>
  );

  // Covering the whole screen, edge to edge
  if (look.fill)
    return (
      <div
        data-portal
        className={`${preview ? "absolute" : "fixed"} inset-0 z-40 bg-black`}
        role="dialog"
        aria-label="Advert"
      >
        {open(<img src={ad.image} alt={ad.name} className="h-full w-full object-cover" />, "absolute inset-0")}
        {skip}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-black/60 to-transparent pt-10 pb-2">
          <span className="pointer-events-auto">{findOutMore}</span>
          <p className="text-[11px] text-white/70">Advert</p>
        </div>
      </div>
    );

  return (
    <div
      data-portal
      className={`${preview ? "absolute" : "fixed"} inset-0 z-40 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm`}
      role="dialog"
      aria-label="Advert"
    >
      {skip}

      <div className="flex min-h-0 w-full flex-1 items-center justify-center py-10">
        <FitPicture src={ad.image} alt={ad.name} size={look.size} wrap={(img) => open(img, "flex")} />
      </div>

      {findOutMore}
      <p className="text-[11px] text-white/50">Advert</p>
    </div>
  );
}
