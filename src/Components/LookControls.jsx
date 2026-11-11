// Site settings → Look: the controls for arranging the guest page.
//   Slider:            a labelled slider (logo size, zoom, darken…)
//   BackgroundAdjuster: drag the background picture to move it, zoom in,
//                      darken it
//   PageParts:         what's on the page, top to bottom: move each part
//                      up or down, show or hide it
import { useRef } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { PAGE_PARTS, pageParts } from "../data";
import { hintClass, labelClass, secondaryButton } from "./formStyles";

export function Slider({ id, label, value, min, max, step = 1, onChange, shown }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}: <span className="font-normal text-muted tabular-nums">{shown ?? value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
      />
    </div>
  );
}

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

// look.bgZoom / bgX / bgY / bgDim, see data.js
export function BackgroundAdjuster({ look, setLook }) {
  const frameRef = useRef(null);
  const drag = useRef(null);
  const zoom = look.bgZoom ?? 1;
  const x = look.bgX ?? 50;
  const y = look.bgY ?? 50;
  const dim = look.bgDim ?? 0;

  // Dragging the picture right shows more of its left side, and so on.
  // The more it's zoomed in, the slower it moves, so it stays easy to aim.
  function down(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x, y };
  }
  function move(e) {
    if (!drag.current || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    const speed = 150 / zoom;
    setLook({
      bgX: Math.round(clamp(drag.current.x - ((e.clientX - drag.current.px) / box.width) * speed, 0, 100)),
      bgY: Math.round(clamp(drag.current.y - ((e.clientY - drag.current.py) / box.height) * speed, 0, 100)),
    });
  }
  const up = () => (drag.current = null);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="shrink-0">
        <div
          ref={frameRef}
          role="img"
          aria-label="Drag to move the picture"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="relative h-48 w-28 cursor-grab touch-none overflow-hidden rounded-xl border border-line bg-page active:cursor-grabbing"
          style={{ backgroundColor: look.background }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url(${look.backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: `${x}% ${y}%`,
              transform: `scale(${zoom})`,
              transformOrigin: `${x}% ${y}%`,
            }}
          />
          {dim > 0 && (
            <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />
          )}
        </div>
        <p className="mt-1 w-28 text-center text-xs text-muted">Drag to move</p>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <Slider
          id="look-bg-zoom"
          label="Zoom"
          value={Math.round(zoom * 100)}
          shown={`${Math.round(zoom * 100)}%`}
          min={100}
          max={300}
          step={5}
          onChange={(v) => setLook({ bgZoom: v / 100 })}
        />
        <Slider
          id="look-bg-dim"
          label="Darken"
          value={Math.round(dim * 100)}
          shown={`${Math.round(dim * 100)}%`}
          min={0}
          max={70}
          onChange={(v) => setLook({ bgDim: v / 100 })}
        />
        <p className={hintClass}>Darkening helps the box and words stand out on a busy picture.</p>
        <button
          type="button"
          onClick={() => setLook({ bgZoom: 1, bgX: 50, bgY: 50, bgDim: 0 })}
          className={secondaryButton}
        >
          <RotateCcw size={16} />
          Reset picture
        </button>
      </div>
    </div>
  );
}

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-brand/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30";

// look.parts, see data.js
export function PageParts({ look, setLook }) {
  const parts = pageParts(look);
  const save = (next) => setLook({ parts: next });
  function shift(i, by) {
    const next = [...parts];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    save(next);
  }
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {parts.map((p, i) => {
        const info = PAGE_PARTS[p.id];
        const noLogo = p.id === "logo" && !look.logo;
        return (
          <li key={p.id} className="flex items-center gap-2 px-3 py-2">
            <div className={`min-w-0 flex-1 ${p.show && !noLogo ? "" : "opacity-50"}`}>
              <p className="text-sm font-medium">{info.label}</p>
              {(noLogo || info.detail) && (
                <p className="truncate text-xs text-muted">{noLogo ? "Add a logo above to show one" : info.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => shift(i, -1)}
              disabled={i === 0}
              className={`${iconButton} text-muted`}
              aria-label={`Move ${info.label} up`}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => shift(i, 1)}
              disabled={i === parts.length - 1}
              className={`${iconButton} text-muted`}
              aria-label={`Move ${info.label} down`}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              onClick={() => save(parts.map((q) => (q.id === p.id ? { ...q, show: !q.show } : q)))}
              disabled={info.always}
              className={`${iconButton} ${p.show ? "text-brand" : "text-muted"}`}
              aria-label={`${p.show ? "Hide" : "Show"} ${info.label}`}
              aria-pressed={p.show}
              title={info.always ? "Always shown: guests need it to sign in" : p.show ? "Shown: click to hide" : "Hidden: click to show"}
            >
              {p.show ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
