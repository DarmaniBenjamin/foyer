// A splash ad over the whole guest page: the picture, and a countdown
// until the guest can skip it. Tapping the picture opens its link.
// onView() runs once when it shows, onClick() when the picture is
// tapped, onDone() when the guest skips it.
// In the admin preview (preview), nothing is counted and it sits inside
// its box instead of covering the screen.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";

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
      <div className="absolute top-3 right-3">
        {left > 0 ? (
          <span className="flex h-9 items-center rounded-full bg-white/15 px-3 text-xs font-semibold text-white">
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