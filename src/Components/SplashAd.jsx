// A splash ad over the whole guest page: the picture, and a countdown
// until the guest can skip it. Tapping the picture opens its link.
// An ad with several pictures shows them one under the other, to scroll
// through like a web page, with "Continue" at the bottom.
// onView() runs once when it shows, onClick() when the picture is
// tapped, onDone() when the guest skips it.
// In the admin preview (preview), nothing is counted and it sits inside
// its box instead of covering the screen.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import { adPictures } from "../ads";

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

  const pictures = adPictures(ad);
  const [scrolled, setScrolled] = useState(false);

  const skip = (
    <div className="absolute top-3 right-3 z-10">
      {left > 0 ? (
        <span className="flex h-9 items-center rounded-full bg-black/60 px-3 text-xs font-semibold text-white backdrop-blur">
          Skip in {left}
        </span>
      ) : (
        <button
          type="button"
          onClick={onDone}
          className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-gray-900 shadow"
        >
          <X size={14} />
          Skip
        </button>
      )}
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
            <button
              type="button"
              onClick={onDone}
              disabled={left > 0}
              className="mt-2 flex h-12 items-center justify-center rounded-xl bg-white text-[15px] font-semibold text-gray-900 shadow disabled:opacity-60"
            >
              {left > 0 ? `Continue in ${left}` : "Continue"}
            </button>
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