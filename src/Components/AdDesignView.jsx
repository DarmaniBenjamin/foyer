// Draws a page built in the splash ad builder (src/adDesign.js) as it
// looks on a device ("desktop", "tablet" or "phone").
//   onLinkClick(): a guest tapped a picture or button with a link
//   screenHeight: how tall the screen is (px), for sections that fill it
//   editing: { selected, onSelect, guides } in the builder: clicking a
//     section, column or block picks it (selected: { section, column,
//     block } ids), links don't open, and empty pictures and videos show
//     a box. guides: dashed lines around every section and column, and
//     each section's name, so you can see where things are. zoom: how
//     much the builder shrinks the page, so the names stay readable
import { Film, ImageIcon } from "lucide-react";
import { FONTS, lookOn, videoPlayer } from "../adDesign";

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" };
const ALIGN = { top: "flex-start", middle: "center", bottom: "flex-end" };

function Placeholder({ icon: Icon, text, radius }) {
  return (
    <div
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-white/30 bg-white/10 text-sm text-white/70"
      style={{ borderRadius: radius }}
    >
      <Icon size={28} />
      {text}
    </div>
  );
}

function Block({ block, device, editing, onLinkClick }) {
  const b = lookOn(block, device);
  const go = (e) => {
    if (editing) e.preventDefault();
    else onLinkClick?.();
  };
  const linked = (link, child, style) =>
    link ? (
      <a href={link} target="_blank" rel="noopener noreferrer" onClick={go} style={style}>
        {child}
      </a>
    ) : (
      child
    );

  if (b.type === "space") return <div style={{ height: b.height }} />;

  if (b.type === "text")
    return (
      <p
        style={{
          margin: 0,
          width: "100%",
          textAlign: b.align,
          fontSize: b.size,
          fontWeight: b.bold ? 700 : 400,
          fontStyle: b.italic ? "italic" : "normal",
          textTransform: b.uppercase ? "uppercase" : "none",
          letterSpacing: b.uppercase ? "0.04em" : undefined,
          color: b.color,
          fontFamily: (FONTS[b.font] ?? FONTS.sans).stack,
          lineHeight: b.lineHeight,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {b.text}
      </p>
    );

  if (b.type === "button")
    return linked(
      b.link,
      <span
        className="inline-flex items-center justify-center text-center"
        style={{
          backgroundColor: b.color,
          color: b.textColor,
          fontSize: b.size,
          fontWeight: b.bold ? 700 : 500,
          borderRadius: b.radius,
          padding: `${Math.round(b.size * 0.75)}px ${Math.round(b.size * 1.4)}px`,
          width: b.full ? "100%" : undefined,
          lineHeight: 1.2,
        }}
      >
        {b.text || "Button"}
      </span>,
      { display: b.full ? "block" : "inline-block", width: b.full ? "100%" : undefined, textDecoration: "none" },
    );

  if (b.type === "image") {
    if (!b.src) return editing ? <Placeholder icon={ImageIcon} text="Add a picture" radius={b.radius} /> : null;
    return linked(
      b.link,
      <img
        src={b.src}
        alt={b.alt}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: b.radius,
          boxShadow: b.shadow ? "0 20px 40px rgba(0,0,0,0.35)" : undefined,
        }}
      />,
      { display: "block", width: `${b.width}%` },
    );
  }

  if (b.type === "video") {
    const style = { display: "block", width: "100%", borderRadius: b.radius, overflow: "hidden" };
    if (b.source === "link") {
      const player = videoPlayer(b.url, b);
      if (!player) return editing ? <Placeholder icon={Film} text="Paste a YouTube or Vimeo link" radius={b.radius} /> : null;
      return (
        <div style={{ width: `${b.width}%` }}>
          <div style={{ ...style, aspectRatio: "16 / 9", position: "relative" }}>
            <iframe
              src={player}
              title="Video"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: editing ? "none" : undefined }}
            />
          </div>
        </div>
      );
    }
    if (!b.src) return editing ? <Placeholder icon={Film} text="Upload a video" radius={b.radius} /> : null;
    return (
      <div style={{ width: `${b.width}%` }}>
        <video
          key={`${b.src}${b.sound}${b.loop}${b.controls}`}
          src={b.src}
          autoPlay
          muted={!b.sound}
          loop={b.loop}
          controls={b.controls}
          playsInline
          preload="auto"
          style={style}
        />
      </div>
    );
  }
  return null;
}

// The guide lines in the builder: sections (orange) and columns (purple)
// dashed, blocks (blue) when the mouse is over them. What's picked gets a
// solid line instead (below).
const GUIDES = `
.ad-guides [data-part="section"] { outline: 1px dashed rgba(245, 158, 11, 0.85); outline-offset: -1px; }
.ad-guides [data-part="section"]:hover { outline: 2px dashed rgba(245, 158, 11, 1); outline-offset: -2px; }
.ad-guides [data-part="column"] { outline: 1px dashed rgba(168, 85, 247, 0.75); outline-offset: -1px; }
.ad-guides [data-part="block"]:hover { outline: 1px solid rgba(59, 130, 246, 0.9); outline-offset: -1px; }
`;

// The outline around what's picked in the builder
const outline = (on, kind) =>
  on
    ? { outline: `2px solid ${kind === "block" ? "#3b82f6" : kind === "column" ? "#a855f7" : "#f59e0b"}`, outlineOffset: -2 }
    : {};

export default function AdDesignView({ design, device = "phone", screenHeight = 844, editing, onLinkClick }) {
  const sel = editing?.selected ?? {};
  const guides = Boolean(editing?.guides);
  // The builder shrinks big screens to fit: the labels stay readable
  const label = 1 / (editing?.zoom || 1);
  const pickThis = (ids) => (e) => {
    if (!editing) return;
    e.stopPropagation();
    editing.onSelect(ids);
  };
  return (
    <div
      className={guides ? "ad-guides" : undefined}
      style={{ backgroundColor: design.background, minHeight: "100%" }}
      onClick={editing ? () => editing.onSelect({}) : undefined}
    >
      {guides && <style>{GUIDES}</style>}
      <div>
        {design.sections.map((section, index) => {
          const s = lookOn(section, device);
          if (s.hide?.includes(device) && !editing) return null;
          const hidden = s.hide?.includes(device);
          const stacked = device === "phone" && s.stack;
          const isSel = sel.section === section.id && !sel.column && !sel.block;
          // On computers and tablets the page is no wider than design.width;
          // a section that fills the screen goes edge to edge, with its
          // content still that wide
          const widest = device === "phone" ? "100%" : design.width;
          return (
            <section
              key={section.id}
              data-part="section"
              onClick={pickThis({ section: section.id })}
              style={{
                position: "relative",
                overflow: "hidden",
                backgroundColor: s.bg || undefined,
                borderRadius: s.radius,
                marginTop: s.marginTop,
                marginBottom: s.marginBottom,
                maxWidth: s.fillScreen ? "100%" : widest,
                marginLeft: "auto",
                marginRight: "auto",
                // Filling the screen: as tall as it, less the space above and below
                minHeight: s.fillScreen
                  ? Math.max(s.minHeight, screenHeight - s.marginTop - s.marginBottom)
                  : s.minHeight || undefined,
                display: "flex",
                flexDirection: "column",
                justifyContent: ALIGN[s.align],
                opacity: hidden ? 0.35 : 1,
                cursor: editing ? "pointer" : undefined,
                ...outline(isSel, "section"),
              }}
            >
              {s.image && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${s.image})`,
                    backgroundSize: s.imageFit,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: `${s.imageX}% ${s.imageY}%`,
                  }}
                />
              )}
              {s.dim > 0 && (s.image || s.bg) && (
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${s.dim})` }} />
              )}
              {guides && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 2,
                    padding: `${2 * label}px ${7 * label}px`,
                    borderBottomRightRadius: 6 * label,
                    backgroundColor: isSel ? "#f59e0b" : "rgba(245, 158, 11, 0.85)",
                    color: "#1f1300",
                    font: `600 ${11 * label}px/1.4 ui-sans-serif, system-ui, sans-serif`,
                    pointerEvents: "none",
                  }}
                >
                  Section {index + 1}
                  {s.fillScreen ? " · fills the screen" : ""}
                  {hidden ? " · hidden here" : ""}
                </span>
              )}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: stacked ? "column" : "row",
                  alignItems: stacked ? "stretch" : ALIGN[s.align],
                  gap: s.gap,
                  padding: `${s.padY}px ${s.padX}px`,
                  width: "100%",
                  maxWidth: widest,
                  margin: "0 auto",
                  boxSizing: "border-box",
                }}
              >
                {section.columns.map((column) => {
                  const c = lookOn(column, device);
                  const colSel = sel.column === column.id && !sel.block;
                  return (
                    <div
                      key={column.id}
                      data-part="column"
                      onClick={pickThis({ section: section.id, column: column.id })}
                      style={{
                        flex: stacked ? "0 0 auto" : `${c.span} 1 0`,
                        minWidth: 0,
                        backgroundColor: c.bg || undefined,
                        padding: `${c.padY}px ${c.padX}px`,
                        borderRadius: c.radius,
                        minHeight: editing && !column.blocks.length ? 60 : undefined,
                        ...outline(colSel, "column"),
                      }}
                    >
                      {column.blocks.map((block) => {
                        const b = lookOn(block, device);
                        if (b.hide?.includes(device) && !editing) return null;
                        return (
                          <div
                            key={block.id}
                            data-part="block"
                            onClick={pickThis({ section: section.id, column: column.id, block: block.id })}
                            style={{
                              display: "flex",
                              justifyContent: JUSTIFY[b.align],
                              marginTop: b.marginTop,
                              marginBottom: b.marginBottom,
                              opacity: b.hide?.includes(device) ? 0.35 : 1,
                              ...outline(sel.block === block.id, "block"),
                            }}
                          >
                            <Block block={block} device={device} editing={Boolean(editing)} onLinkClick={onLinkClick} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
