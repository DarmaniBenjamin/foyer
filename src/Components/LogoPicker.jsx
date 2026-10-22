// Picks a picture from the computer or phone: a site's logo, or the
// page's background picture. The picture is made smaller and kept as a
// "data:" link, so it's saved with the site and loads fast on guests'
// phones.
// - Logos: at most 480 × 240, PNG (keeps a see-through background)
// - Backgrounds (kind="background"): at most 1600 × 1600, JPEG
// - Splash ads (kind="ad"): at most 1080 × 1350 (a phone-shaped poster), JPEG
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { secondaryButton } from "./formStyles";

const KINDS = {
  logo: { maxW: 480, maxH: 240, type: "image/png", empty: "No logo", button: "Upload logo", hint: "PNG with a see-through background looks best." },
  background: { maxW: 1600, maxH: 1600, type: "image/jpeg", empty: "No picture", button: "Upload picture", hint: "A wide photo. It's made smaller so it loads fast." },
  ad: { maxW: 1080, maxH: 1350, type: "image/jpeg", empty: "No picture", button: "Upload picture", hint: "A tall picture fits phones best, e.g. 1080 × 1350 (an Instagram post)." },
};

function shrink(file, { maxW, maxH, type }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a picture."));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(type, 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoPicker({ value, onChange, kind = "logo" }) {
  const settings = KINDS[kind];
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still works
    if (!file) return;
    if (file.size > 15 * 1024 * 1024)
      return setError("That picture is over 15 MB. Pick a smaller one.");
    try {
      setError("");
      onChange(await shrink(file, settings));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-page p-1">
          {value ? (
            <img
              src={value}
              alt=""
              className={kind === "background" ? "h-full w-full rounded-lg object-cover" : "max-h-full max-w-full object-contain"}
            />
          ) : (
            <span className="text-xs text-muted">{settings.empty}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={secondaryButton}
          >
            <ImagePlus size={16} />
            {value ? "Change" : settings.button}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className={`${secondaryButton} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
              aria-label="Remove picture"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={pick}
        className="hidden"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-muted">{settings.hint}</p>
    </div>
  );
}