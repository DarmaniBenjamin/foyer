// The splash ad page builder: build an ad like a small web page, the way
// you would in Wix. Splash ads → an ad → "Build a page" → Open the builder.
//
//   Top:    Computer / Tablet / Phone (how the page looks on each), undo,
//           redo, Done
//   Left:   the page's parts: sections, their columns and blocks. "Add
//           section" starts one from a ready-made layout; "Add" in a
//           column adds words, a picture, a button, a video or space.
//   Middle: the page itself. Click anything on it to change it. Guide
//           lines (on/off at the top) show each section and column, and a
//           red line where the screen ends: below it guests scroll.
//   Right:  the settings of what's picked: words, colours, sizes,
//           spacing (padding inside, margin outside), pictures, links…
//
// Sizes and spacing changed while looking at Tablet or Phone only change
// that device (see lookOn in src/adDesign.js); words, pictures and links
// are the same everywhere.
//
// Pictures and videos are uploaded straight away (/api/media), and each
// gets its own web address to open, share or download (FileLinks); the
// page itself is saved with the ad.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Grid2x2,
  Film,
  ImageIcon,
  LayoutTemplate,
  Monitor,
  MousePointerClick,
  MoveVertical,
  Plus,
  Redo2,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import AdDesignView from "./AdDesignView";
import FileLinks from "./FileLinks";
import { shrinkFile } from "./LogoPicker";
import WifiLoader from "./WifiLoader";
import {
  BLOCKS,
  DEVICES,
  DEVICE_KEYS,
  FONTS,
  SECTION_TEMPLATES,
  lookOn,
  makeBlock,
  makeColumn,
  newId,
} from "../adDesign";
import { hintClass, inputClass, labelClass, primaryButton, secondaryButton } from "./formStyles";

const DEVICE_ICONS = { desktop: Monitor, tablet: Tablet, phone: Smartphone };
const BLOCK_ICONS = { text: Type, image: ImageIcon, button: MousePointerClick, video: Film, space: MoveVertical };
const DEVICE_WORD = { tablet: "tablets", phone: "phones" };

// ---------- Small controls ----------

function Row({ label, children, hint }) {
  return (
    <div>
      {label && <span className={labelClass}>{label}</span>}
      {children}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

// A slider with the number next to it (and a box to type it)
function Num({ label, value, min, max, step = 1, unit = "px", onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => e.target.value !== "" && onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
            className="h-7 w-16 rounded-md border border-line bg-white px-1.5 text-right text-xs tabular-nums outline-none focus:border-brand"
            aria-label={label}
          />
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
        aria-label={`${label} slider`}
      />
    </div>
  );
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label={label}>
      {options.map(([v, text, Icon]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          title={typeof text === "string" ? text : undefined}
          className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition ${
            value === v ? "bg-brand text-white" : "text-muted hover:text-ink"
          }`}
        >
          {Icon ? <Icon size={15} /> : text}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange, detail }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
      />
    </label>
  );
}

function ColorPick({ label, value, onChange, allowNone = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={`h-7 rounded-md border px-2 text-xs ${value ? "border-line text-muted" : "border-brand text-brand"}`}
          >
            None
          </button>
        )}
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded-md border border-line bg-white p-0.5"
          aria-label={label}
        />
      </span>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="space-y-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
      {title && <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>}
      {children}
    </div>
  );
}

const iconButton =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-brand/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30";

// ---------- Uploading ----------

async function upload(file, siteId) {
  let body = file;
  let type = file.type;
  if (type.startsWith("image/") && type !== "image/gif") {
    // Made smaller first, so it loads fast on phones
    const dataUrl = await shrinkFile(file, "page");
    body = await (await fetch(dataUrl)).blob();
    type = body.type || "image/jpeg";
  }
  const res = await fetch(`/api/media?siteId=${siteId}&name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      answer.error ?? (res.status === 413 ? "That file is too big to upload." : "Couldn't upload that. Try again."),
    );
  return answer.url;
}

function UploadButton({ accept, siteId, onDone, label, small }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onDone(await upload(file, siteId));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={`${secondaryButton} ${small ? "" : "w-full"}`}
      >
        {busy ? <WifiLoader size={16} /> : <Upload size={16} />}
        {busy ? "Uploading…" : label}
      </button>
      <input ref={ref} type="file" accept={accept} onChange={pick} className="hidden" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------- Changing the design ----------

const findSection = (d, sid) => d.sections.find((s) => s.id === sid);
const findColumn = (d, sid, cid) => findSection(d, sid)?.columns.find((c) => c.id === cid);
const findBlock = (d, sid, cid, bid) => findColumn(d, sid, cid)?.blocks.find((b) => b.id === bid);

// A copy with new ids all the way down
function cloneWithIds(item) {
  const copy = structuredClone(item);
  const renew = (x) => {
    x.id = newId();
    x.columns?.forEach(renew);
    x.blocks?.forEach(renew);
  };
  renew(copy);
  return copy;
}

function move(list, index, by) {
  const next = [...list];
  const to = index + by;
  if (to < 0 || to >= next.length) return next;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export default function AdBuilder({ initial, siteId, name, onDone, onClose }) {
  const [design, setDesign] = useState(initial);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  // Start with the computer look, or the phone look when building on a phone
  const [device, setDevice] = useState(() => (window.innerWidth < 768 ? "phone" : "desktop"));
  const [sel, setSel] = useState({});
  const [panel, setPanel] = useState("edit"); // small screens: "layers" or "edit"
  const [adding, setAdding] = useState(null); // "section" or a column id

  // Every change can be undone
  function commit(next) {
    setPast((p) => [...p.slice(-80), design]);
    setFuture([]);
    setDesign(next);
  }
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [design, ...f]);
    setDesign(past.at(-1));
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, design]);
    setDesign(future[0]);
    setFuture((f) => f.slice(1));
  };

  // The page behind doesn't scroll; Ctrl+Z / Ctrl+Y undo and redo
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "z" && !e.shiftKey) (e.preventDefault(), undo());
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) (e.preventDefault(), redo());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Change part of the design: fn gets a copy of the design to change
  const change = (fn) => {
    const next = structuredClone(design);
    fn(next);
    commit(next);
  };
  // Set a setting on a section, column or block. Sizes and spacing go
  // into tablet / phone while looking at those.
  function setOn(kind, item, key, value) {
    if (device !== "desktop" && DEVICE_KEYS[kind].includes(key)) {
      item[device] = { ...(item[device] ?? {}), [key]: value };
    } else item[key] = value;
  }

  const section = sel.section ? findSection(design, sel.section) : null;
  const column = sel.column ? findColumn(design, sel.section, sel.column) : null;
  const block = sel.block ? findBlock(design, sel.section, sel.column, sel.block) : null;

  // Guide lines on the page (remembered on this computer)
  const [guides, setGuides] = useState(() => {
    try {
      return localStorage.getItem("foyer-builder-guides") !== "off";
    } catch {
      return true;
    }
  });
  function toggleGuides() {
    setGuides((on) => {
      try {
        localStorage.setItem("foyer-builder-guides", on ? "off" : "on");
      } catch {
        // not kept, that's fine
      }
      return !on;
    });
  }

  // ---------- The canvas: the page at the device's width, made to fit ----------
  const canvasRef = useRef(null);
  const [room, setRoom] = useState(800);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const watch = new ResizeObserver(() => setRoom(el.clientWidth));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const width = DEVICES[device].width;
  const screenHeight = DEVICES[device].height;
  const zoom = Math.min(1, (room - 32) / width);

  // ---------- Adding ----------
  function addSection(template) {
    const made = SECTION_TEMPLATES[template].make();
    change((d) => {
      const at = sel.section ? d.sections.findIndex((s) => s.id === sel.section) + 1 : d.sections.length;
      d.sections.splice(at, 0, made);
    });
    setSel({ section: made.id });
    setAdding(null);
    setPanel("edit");
  }
  function addBlock(sid, cid, type) {
    const made = makeBlock(type);
    change((d) => {
      const col = findColumn(d, sid, cid);
      const at = sel.block && sel.column === cid ? col.blocks.findIndex((b) => b.id === sel.block) + 1 : col.blocks.length;
      col.blocks.splice(at, 0, made);
    });
    setSel({ section: sid, column: cid, block: made.id });
    setAdding(null);
    setPanel("edit");
  }

  // ---------- The left panel: the page's parts ----------
  const layers = (
    <div className="space-y-2 p-3">
      <button
        type="button"
        onClick={() => setSel({})}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium ${
          !sel.section ? "bg-brand/10 text-brand" : "hover:bg-brand/5"
        }`}
      >
        <LayoutTemplate size={16} />
        Page
      </button>
      {design.sections.map((s, si) => (
        <div key={s.id} className="rounded-lg border border-line">
          <div
            className={`flex items-center gap-1 rounded-t-lg px-2 py-1.5 ${
              sel.section === s.id && !sel.column ? "bg-amber-50 dark:bg-amber-500/10" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setSel({ section: s.id })}
              className="min-w-0 flex-1 truncate text-left text-sm font-medium"
            >
              Section {si + 1}
              <span className="ml-1 text-xs font-normal text-muted">
                {s.columns.length > 1 ? `· ${s.columns.length} columns` : ""}
                {s.hide.length ? " · hidden on some" : ""}
              </span>
            </button>
            <button type="button" className={iconButton} disabled={si === 0} onClick={() => change((d) => (d.sections = move(d.sections, si, -1)))} aria-label={`Move section ${si + 1} up`}>
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={si === design.sections.length - 1}
              onClick={() => change((d) => (d.sections = move(d.sections, si, 1)))}
              aria-label={`Move section ${si + 1} down`}
            >
              <ArrowDown size={14} />
            </button>
          </div>
          <div className="space-y-1 border-t border-line p-1.5">
            {s.columns.map((c, ci) => (
              <div key={c.id}>
                {s.columns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSel({ section: s.id, column: c.id })}
                    className={`w-full rounded-md px-2 py-1 text-left text-xs font-semibold text-muted ${
                      sel.column === c.id && !sel.block ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10" : "hover:bg-brand/5"
                    }`}
                  >
                    Column {ci + 1}
                  </button>
                )}
                {c.blocks.map((b) => {
                  const Icon = BLOCK_ICONS[b.type];
                  const words = b.type === "text" || b.type === "button" ? b.text : BLOCKS[b.type].label;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSel({ section: s.id, column: c.id, block: b.id })}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${
                        s.columns.length > 1 ? "pl-4" : ""
                      } ${sel.block === b.id ? "bg-brand/10 text-brand" : "hover:bg-brand/5"}`}
                    >
                      <Icon size={13} className="shrink-0" />
                      <span className="truncate">{words || BLOCKS[b.type].label}</span>
                    </button>
                  );
                })}
                {adding === c.id ? (
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {Object.entries(BLOCKS).map(([type, info]) => {
                      const Icon = BLOCK_ICONS[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addBlock(s.id, c.id, type)}
                          className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-xs hover:border-brand/40 hover:bg-brand/5"
                        >
                          <Icon size={13} />
                          {info.label}
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => setAdding(null)} className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-ink">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(c.id)}
                    className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5 ${
                      s.columns.length > 1 ? "pl-4" : ""
                    }`}
                  >
                    <Plus size={13} />
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {adding === "section" ? (
        <div className="space-y-1 rounded-lg border border-brand/40 p-2">
          <p className="px-1 text-xs font-semibold text-muted">Start the section from…</p>
          {Object.entries(SECTION_TEMPLATES).map(([key, t]) => (
            <button
              key={key}
              type="button"
              onClick={() => addSection(key)}
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-brand/5"
            >
              {t.label}
            </button>
          ))}
          <button type="button" onClick={() => setAdding(null)} className="px-2 py-1 text-xs text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding("section")} className={`${secondaryButton} w-full`}>
          <Plus size={16} />
          Add section
        </button>
      )}
    </div>
  );

  // ---------- The right panel: settings of what's picked ----------
  const kind = block ? "block" : column ? "column" : section ? "section" : "page";
  const item = block ?? column ?? section;
  const v = item ? lookOn(item, device) : null;
  // Change the picked item
  const set = (key, value) =>
    change((d) => {
      const target = block
        ? findBlock(d, sel.section, sel.column, sel.block)
        : column
          ? findColumn(d, sel.section, sel.column)
          : findSection(d, sel.section);
      setOn(kind, target, key, value);
    });
  const own = item && device !== "desktop" && Object.keys(item[device] ?? {}).length > 0;

  function remove() {
    change((d) => {
      if (block) {
        const col = findColumn(d, sel.section, sel.column);
        col.blocks = col.blocks.filter((b) => b.id !== sel.block);
      } else if (column) {
        const s = findSection(d, sel.section);
        if (s.columns.length === 1) s.columns[0].blocks = [];
        else s.columns = s.columns.filter((c) => c.id !== sel.column);
      } else d.sections = d.sections.filter((s) => s.id !== sel.section);
    });
    setSel(block || column ? { section: sel.section } : {});
  }
  function duplicate() {
    change((d) => {
      if (block) {
        const col = findColumn(d, sel.section, sel.column);
        const at = col.blocks.findIndex((b) => b.id === sel.block);
        col.blocks.splice(at + 1, 0, cloneWithIds(col.blocks[at]));
      } else if (section && !column) {
        const at = d.sections.findIndex((s) => s.id === sel.section);
        d.sections.splice(at + 1, 0, cloneWithIds(d.sections[at]));
      }
    });
  }
  function shift(by) {
    change((d) => {
      if (block) {
        const col = findColumn(d, sel.section, sel.column);
        col.blocks = move(col.blocks, col.blocks.findIndex((b) => b.id === sel.block), by);
      } else if (column) {
        const s = findSection(d, sel.section);
        s.columns = move(s.columns, s.columns.findIndex((c) => c.id === sel.column), by);
      } else {
        d.sections = move(d.sections, d.sections.findIndex((s) => s.id === sel.section), by);
      }
    });
  }
  function setColumns(count) {
    change((d) => {
      const s = findSection(d, sel.section);
      while (s.columns.length < count) s.columns.push(makeColumn([]));
      while (s.columns.length > count) {
        const gone = s.columns.pop();
        s.columns.at(-1).blocks.push(...gone.blocks); // keep what was in it
      }
    });
  }
  const showOn = item && (
    <Row label="Show on">
      <div className="flex gap-1.5">
        {Object.entries(DEVICES).map(([d, info]) => {
          const Icon = DEVICE_ICONS[d];
          const shown = !item.hide?.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={shown}
              onClick={() =>
                change((x) => {
                  const t = block
                    ? findBlock(x, sel.section, sel.column, sel.block)
                    : findSection(x, sel.section);
                  t.hide = shown ? [...(t.hide ?? []), d] : t.hide.filter((h) => h !== d);
                })
              }
              className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border text-xs ${
                shown ? "border-brand bg-brand/10 text-brand" : "border-line text-muted line-through"
              }`}
            >
              <Icon size={14} />
              {info.label}
            </button>
          );
        })}
      </div>
    </Row>
  );

  const actions = (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => shift(-1)} className={secondaryButton} title="Move up">
        <ArrowUp size={15} />
      </button>
      <button type="button" onClick={() => shift(1)} className={secondaryButton} title="Move down">
        <ArrowDown size={15} />
      </button>
      {kind !== "column" && (
        <button type="button" onClick={duplicate} className={secondaryButton} title="Duplicate">
          <Copy size={15} />
          Duplicate
        </button>
      )}
      <button type="button" onClick={remove} className={`${secondaryButton} text-red-600 hover:bg-red-50`} title="Delete">
        <Trash2 size={15} />
        {kind === "column" && section?.columns.length === 1 ? "Empty it" : "Delete"}
      </button>
    </div>
  );

  const spacing = (keys) => (
    <Group title="Spacing">
      {keys.includes("padY") && <Num label="Padding top and bottom" value={v.padY} min={0} max={240} onChange={(x) => set("padY", x)} />}
      {keys.includes("padX") && <Num label="Padding at the sides" value={v.padX} min={0} max={240} onChange={(x) => set("padX", x)} />}
      {keys.includes("marginTop") && <Num label="Space above (margin)" value={v.marginTop} min={0} max={240} onChange={(x) => set("marginTop", x)} />}
      {keys.includes("marginBottom") && (
        <Num label="Space below (margin)" value={v.marginBottom} min={0} max={240} onChange={(x) => set("marginBottom", x)} />
      )}
      {keys.includes("radius") && <Num label="Rounded corners" value={v.radius} min={0} max={kind === "block" ? 999 : 60} onChange={(x) => set("radius", x)} />}
    </Group>
  );

  const alignRow = v && (
    <Row label="Line up">
      <Segmented
        label="Line up"
        value={v?.align}
        onChange={(x) => set("align", x)}
        options={[
          ["left", "Left", AlignLeft],
          ["center", "Centre", AlignCenter],
          ["right", "Right", AlignRight],
        ]}
      />
    </Row>
  );

  let settings;
  if (kind === "page")
    settings = (
      <div className="space-y-4">
        <p className="text-sm font-semibold">Page</p>
        <ColorPick label="Colour behind everything" value={design.background} onChange={(x) => change((d) => (d.background = x))} />
        <Num
          label="Widest on a computer"
          value={design.width}
          min={360}
          max={1600}
          step={10}
          onChange={(x) => change((d) => (d.width = x))}
        />
        <p className={hintClass}>
          Click a section, column or block on the page to change it. Sizes and spacing you change while looking at
          Tablet or Phone only change that device.
        </p>
      </div>
    );
  else if (kind === "section")
    settings = (
      <div className="space-y-4">
        <p className="text-sm font-semibold">Section {design.sections.findIndex((s) => s.id === section.id) + 1}</p>
        {actions}
        <Group title="Layout">
          <Row label="Columns side by side">
            <Segmented label="Columns" value={section.columns.length} onChange={setColumns} options={[[1, "1"], [2, "2"], [3, "3"]]} />
          </Row>
          {section.columns.length > 1 && (
            <>
              <Num label="Gap between columns" value={v.gap} min={0} max={80} onChange={(x) => set("gap", x)} />
              <Switch
                label="One under the other on phones"
                checked={section.stack !== false}
                onChange={(x) => change((d) => (findSection(d, sel.section).stack = x))}
              />
            </>
          )}
          <Row label="Content sits at the">
            <Segmented
              label="Content position"
              value={v.align}
              onChange={(x) => set("align", x)}
              options={[
                ["top", "Top"],
                ["middle", "Middle"],
                ["bottom", "Bottom"],
              ]}
            />
          </Row>
          <Switch
            label="Fill the whole screen"
            detail="At least as tall as the guest's screen, whatever its size"
            checked={Boolean(v.fillScreen)}
            onChange={(x) => set("fillScreen", x)}
          />
          {!v.fillScreen && (
            <Num label="Height at least" value={v.minHeight} min={0} max={1600} step={10} onChange={(x) => set("minHeight", x)} />
          )}
        </Group>
        <Group title="Background">
          <ColorPick label="Colour" value={section.bg} allowNone onChange={(x) => change((d) => (findSection(d, sel.section).bg = x))} />
          {section.image ? (
            <div className="flex items-center gap-2">
              <img src={section.image} alt="" className="h-12 w-20 rounded-md object-cover" />
              <UploadButton accept="image/*" siteId={siteId} label="Replace" small onDone={(url) => change((d) => (findSection(d, sel.section).image = url))} />
              <button type="button" className={iconButton} onClick={() => change((d) => (findSection(d, sel.section).image = ""))} aria-label="Remove the picture">
                <Trash2 size={15} />
              </button>
            </div>
          ) : null}
          {section.image && <FileLinks url={section.image} />}
          {section.image ? null : (
            <UploadButton
              accept="image/*"
              siteId={siteId}
              label="Picture behind (blocks go on top)"
              onDone={(url) => change((d) => (findSection(d, sel.section).image = url))}
            />
          )}
          {section.image && (
            <>
              <Row label="Picture fills">
                <Segmented
                  label="Picture fit"
                  value={v.imageFit}
                  onChange={(x) => set("imageFit", x)}
                  options={[
                    ["cover", "The whole section"],
                    ["contain", "Show all of it"],
                  ]}
                />
              </Row>
              <Num label="Picture across" value={v.imageX} min={0} max={100} unit="%" onChange={(x) => set("imageX", x)} />
              <Num label="Picture up and down" value={v.imageY} min={0} max={100} unit="%" onChange={(x) => set("imageY", x)} />
            </>
          )}
          {(section.image || section.bg) && (
            <Num label="Darken" value={Math.round(v.dim * 100)} min={0} max={90} unit="%" onChange={(x) => set("dim", x / 100)} />
          )}
        </Group>
        {spacing(["padY", "padX", "marginTop", "marginBottom", "radius"])}
        <Group>{showOn}</Group>
      </div>
    );
  else if (kind === "column")
    settings = (
      <div className="space-y-4">
        <p className="text-sm font-semibold">Column {section.columns.findIndex((c) => c.id === column.id) + 1}</p>
        {actions}
        <Group title="Size">
          {section.columns.length > 1 && (
            <Row label="Width" hint="Compared to the other columns: 2 is twice as wide as 1.">
              <Segmented label="Width" value={v.span} onChange={(x) => set("span", x)} options={[[1, "1"], [2, "2"], [3, "3"]]} />
            </Row>
          )}
          <ColorPick label="Background" value={column.bg} allowNone onChange={(x) => change((d) => (findColumn(d, sel.section, sel.column).bg = x))} />
        </Group>
        {spacing(["padY", "padX", "radius"])}
        <button type="button" onClick={() => setAdding(column.id) || setPanel("layers")} className={`${secondaryButton} w-full lg:hidden`}>
          <Plus size={16} />
          Add a block
        </button>
      </div>
    );
  else {
    const b = v;
    const content = (key, value) => change((d) => (findBlock(d, sel.section, sel.column, sel.block)[key] = value));
    settings = (
      <div className="space-y-4">
        <p className="text-sm font-semibold">{BLOCKS[block.type].label}</p>
        {actions}
        {block.type === "text" && (
          <Group title="Words">
            <textarea
              value={block.text}
              onChange={(e) => content("text", e.target.value)}
              rows={4}
              className={`${inputClass} h-auto py-2`}
              aria-label="Words"
            />
            <Num label="Size" value={b.size} min={8} max={120} onChange={(x) => set("size", x)} />
            <div className="flex gap-1.5">
              {[
                ["bold", "Bold", "font-bold"],
                ["italic", "Italic", "italic"],
                ["uppercase", "CAPITALS", "tracking-wide"],
              ].map(([key, text, style]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={b[key]}
                  onClick={() => set(key, !b[key])}
                  className={`h-8 flex-1 rounded-lg border text-xs ${style} ${b[key] ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <Row label="Font">
              <select value={block.font} onChange={(e) => content("font", e.target.value)} className={inputClass}>
                {Object.entries(FONTS).map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>
            <ColorPick label="Colour" value={block.color} onChange={(x) => content("color", x)} />
            <Num label="Line spacing" value={b.lineHeight} min={0.8} max={3} step={0.05} unit="×" onChange={(x) => set("lineHeight", x)} />
            {alignRow}
          </Group>
        )}
        {block.type === "image" && (
          <Group title="Picture">
            {block.src && <img src={block.src} alt="" className="max-h-40 w-full rounded-md bg-black object-contain" />}
            {block.src && <FileLinks url={block.src} />}
            <UploadButton accept="image/*" siteId={siteId} label={block.src ? "Replace the picture" : "Upload a picture"} onDone={(url) => content("src", url)} />
            <Row label="Link when tapped (optional)">
              <input value={block.link} onChange={(e) => content("link", e.target.value)} placeholder="https://" className={inputClass} inputMode="url" autoCapitalize="none" />
            </Row>
            <Num label="Width" value={b.width} min={5} max={100} unit="%" onChange={(x) => set("width", x)} />
            <Num label="Rounded corners" value={b.radius} min={0} max={200} onChange={(x) => set("radius", x)} />
            <Switch label="Shadow" checked={block.shadow} onChange={(x) => content("shadow", x)} />
            {alignRow}
          </Group>
        )}
        {block.type === "button" && (
          <Group title="Button">
            <Row label="Words on it">
              <input value={block.text} onChange={(e) => content("text", e.target.value)} className={inputClass} />
            </Row>
            <Row label="Link">
              <input value={block.link} onChange={(e) => content("link", e.target.value)} placeholder="https://" className={inputClass} inputMode="url" autoCapitalize="none" />
            </Row>
            <ColorPick label="Colour" value={block.color} onChange={(x) => content("color", x)} />
            <ColorPick label="Words colour" value={block.textColor} onChange={(x) => content("textColor", x)} />
            <Num label="Size" value={b.size} min={10} max={40} onChange={(x) => set("size", x)} />
            <Num label="Rounded corners" value={b.radius} min={0} max={999} onChange={(x) => set("radius", x)} />
            <Switch label="As wide as the column" checked={b.full} onChange={(x) => set("full", x)} />
            {!b.full && alignRow}
          </Group>
        )}
        {block.type === "video" && (
          <Group title="Video">
            <Segmented
              label="Video from"
              value={block.source}
              onChange={(x) => content("source", x)}
              options={[
                ["upload", "Upload a file"],
                ["link", "YouTube or Vimeo"],
              ]}
            />
            {block.source === "upload" ? (
              <>
                <UploadButton
                  accept="video/mp4,video/webm,video/quicktime"
                  siteId={siteId}
                  label={block.src ? "Replace the video" : "Upload a video (up to 40 MB)"}
                  onDone={(url) => content("src", url)}
                />
                {block.src && <FileLinks url={block.src} />}
                <p className={hintClass}>Plays even before guests are online. MP4 works on every phone.</p>
              </>
            ) : (
              <>
                <input
                  value={block.url}
                  onChange={(e) => content("url", e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className={inputClass}
                  inputMode="url"
                  autoCapitalize="none"
                  aria-label="Video link"
                />
                <p className={hintClass}>
                  YouTube and Vimeo only play once guests are online, so use them in ads shown after connecting.
                </p>
              </>
            )}
            <Num label="Width" value={b.width} min={5} max={100} unit="%" onChange={(x) => set("width", x)} />
            <Num label="Rounded corners" value={b.radius} min={0} max={60} onChange={(x) => set("radius", x)} />
            <Switch
              label="Sound on"
              detail="Phones only start videos by themselves when the sound is off."
              checked={block.sound}
              onChange={(x) => content("sound", x)}
            />
            <Switch label="Play again and again" checked={block.loop} onChange={(x) => content("loop", x)} />
            <Switch label="Show play / pause" checked={block.controls} onChange={(x) => content("controls", x)} />
            {alignRow}
          </Group>
        )}
        {block.type === "space" && (
          <Group title="Space">
            <Num label="Height" value={b.height} min={0} max={600} onChange={(x) => set("height", x)} />
          </Group>
        )}
        {block.type !== "space" && spacing(["marginTop", "marginBottom"])}
        <Group>{showOn}</Group>
      </div>
    );
  }

  const deviceNote =
    device !== "desktop" && item ? (
      <div className="mb-4 rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand">
        <p>
          You're changing the <b>{DEVICES[device].label.toLowerCase()}</b> look: sizes and spacing changed here only
          apply to {DEVICE_WORD[device]}.
        </p>
        {own && (
          <button
            type="button"
            onClick={() =>
              change((d) => {
                const t = block
                  ? findBlock(d, sel.section, sel.column, sel.block)
                  : column
                    ? findColumn(d, sel.section, sel.column)
                    : findSection(d, sel.section);
                t[device] = {};
              })
            }
            className="mt-1 font-semibold underline"
          >
            Undo the {DEVICES[device].label.toLowerCase()} changes for this
          </button>
        )}
      </div>
    ) : null;

  const view = useMemo(
    () => (
      <AdDesignView
        design={design}
        device={device}
        screenHeight={screenHeight}
        editing={{ selected: sel, guides, zoom, onSelect: (ids) => (setSel(ids), setPanel("edit")) }}
      />
    ),
    [design, device, sel, guides, screenHeight, zoom],
  );

  return createPortal(
    <div className="fade-in fixed inset-0 z-[60] flex flex-col bg-page text-ink">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2">
        <button type="button" onClick={onClose} className={iconButton} aria-label="Close without keeping changes" title="Close without keeping changes">
          <X size={18} />
        </button>
        <p className="mr-auto min-w-0 truncate text-sm font-semibold">
          Page builder <span className="font-normal text-muted">· {name || "Splash ad"}</span>
        </p>
        <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Look at it on">
          {Object.entries(DEVICES).map(([d, info]) => {
            const Icon = DEVICE_ICONS[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  device === d ? "bg-brand text-white" : "text-muted hover:text-ink"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{info.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={toggleGuides}
          aria-pressed={guides}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
            guides ? "border-brand/40 bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"
          }`}
          title="Show lines around each section and column, and where the screen ends"
        >
          <Grid2x2 size={15} />
          <span className="hidden sm:inline">Guides</span>
        </button>
        <button type="button" onClick={undo} disabled={!past.length} className={iconButton} aria-label="Undo" title="Undo (Ctrl+Z)">
          <Undo2 size={16} />
        </button>
        <button type="button" onClick={redo} disabled={!future.length} className={iconButton} aria-label="Redo" title="Redo (Ctrl+Y)">
          <Redo2 size={16} />
        </button>
        <button type="button" onClick={() => onDone(design)} className={primaryButton}>
          <Check size={16} />
          Done
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-line bg-white lg:block">{layers}</aside>

        <main ref={canvasRef} className="min-h-0 flex-1 overflow-auto bg-[#e9ebf0] p-4 dark:bg-[#0f1115] max-lg:h-[52vh] max-lg:flex-none">
          <div
            className="relative mx-auto overflow-hidden rounded-xl bg-black shadow-xl ring-1 ring-black/10"
            style={{ width, zoom, minHeight: screenHeight }}
          >
            {view}
            {guides && (
              // Where the guest's screen ends: below this they scroll
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-red-500"
                style={{ top: screenHeight - 2 }}
              >
                <span
                  className="absolute right-2 rounded bg-red-500 px-1.5 py-0.5 font-semibold text-white"
                  style={{ fontSize: 11 / zoom, bottom: 2 }}
                >
                  Bottom of a {DEVICES[device].label.toLowerCase()} screen · guests scroll to see below
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            {DEVICES[device].label} · {width} × {screenHeight}
            {zoom < 1 ? ` · shown at ${Math.round(zoom * 100)}%` : ""}
          </p>
        </main>

        <aside className="flex min-h-0 flex-1 flex-col border-l border-line bg-white lg:w-80 lg:flex-none">
          <div className="flex border-b border-line lg:hidden">
            {[
              ["layers", "Parts"],
              ["edit", "Settings"],
            ].map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                className={`flex-1 py-2 text-sm font-medium ${panel === key ? "border-b-2 border-brand text-brand" : "text-muted"}`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={panel === "layers" ? "lg:hidden" : "hidden"}>{layers}</div>
            <div className={`p-4 ${panel === "edit" ? "" : "max-lg:hidden"}`}>
              {deviceNote}
              {settings}
            </div>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
