// A splash ad over the whole guest page: the picture, and a countdown.
// When it reaches 0 the ad closes by itself and the guest goes on;
// there's nothing to press. Tapping the picture opens its link.
// An ad with several pictures shows them one under the other, to scroll
// through like a web page. An ad built in the page builder shows its page
// as it looks on this screen (computer, tablet or phone).
// onView() runs once when it shows, onClick() when the picture is
// tapped, onDone() when its time is up.
// In the admin preview (preview), nothing is counted and it sits inside
// its box instead of covering the screen.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { adPictures } from "../ads";
import { deviceFor } from "../adDesign";
import AdDesignView from "./AdDesignView";

export default function SplashAd({ ad, onView, onClick, onDone, preview = false }) {
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

  // Built pages look different on a computer, tablet or phone
  const [screen, setScreen] = useState(() => (typeof window === "undefined" ? 390 : window.innerWidth));
  useEffect(() => {
    if (preview || !ad.design) return undefined;
    const onResize = () => setScreen(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [preview, ad.design]);

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
            device={preview ? "phone" : deviceFor(screen)}
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
          <div className={`mx-auto flex max-w-md flex-col gap-3 pb-6 ${preview ? "px-2 pt-12" : "px-3 pt-14"}`}>
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

  const picture = (
    <img
      src={ad.image}
      alt={ad.name}
      className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
    />
  );

  return (
    <div
      data-portal
      className={`${preview ? "absolute" : "fixed"} inset-0 z-40 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm`}
      role="dialog"
      aria-label="Advert"
    >
      {skip}

      <div className="flex min-h-0 w-full max-w-md flex-1 items-center justify-center py-10">
        {ad.link ? (
          <a
            href={ad.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => !preview && onClick?.()}
            className="flex max-h-full justify-center"
          >
            {picture}
          </a>
        ) : (
          picture
        )}
      </div>

      {ad.link && (
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
      )}
      <p className="text-[11px] text-white/50">Advert</p>
    </div>
  );
}