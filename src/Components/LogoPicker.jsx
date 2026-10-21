// Picks a site's logo from the computer or phone. The picture is made
// smaller (at most 480 × 240) and kept as a "data:" link, so it's saved
// with the site and loads fast on guests' phones.
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { secondaryButton } from "./formStyles";

const MAX_W = 480;
const MAX_H = 240;

function shrink(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a picture."));
      img.onload = () => {
        const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG keeps a see-through background see-through
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoPicker({ value, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still works
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      return setError("That picture is over 10 MB. Pick a smaller one.");
    try {
      setError("");
      onChange(await shrink(file));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-page p-2">
          {value ? (
            <img src={value} alt="Logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-muted">No logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={secondaryButton}
          >
            <ImagePlus size={16} />
            {value ? "Change" : "Upload logo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className={`${secondaryButton} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
              aria-label="Remove logo"
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
      <p className="mt-2 text-xs text-muted">
        PNG with a see-through background looks best.
      </p>
    </div>
  );
}