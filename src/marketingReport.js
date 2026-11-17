// The monthly Wi-Fi Marketing Report sent to each client: the same
// Word file, PDF and Excel file Protonic made by hand, with this site's
// month in them. The Word file and PDF are Protonic's own (in
// server/report-template), with only these swapped in:
//   - the month ("Wi-Fi Marketing Report October 2026")
//   - the company ("To: …") and who it's for ("Dear …")
//   - the submission date (the day it's downloaded)
//   - the two graphs: popular sign-in times, and new vs returning guests
//     each day
// The Excel file is Protonic's too (same look), with a column for each
// of the site's own questions, then Firstseen On, Lastseen On and Visits.
//
// Everything is made here in the browser from the data already loaded,
// and the tools (zip, PDF) are only loaded when a button is pressed.
import { MONTHS, monthRange } from "./dates";
import { answerText } from "./guests";

// ---------- The month's numbers ----------

// The site's sign-ins that worked in the month
function signInsIn(connections, site, range) {
  return connections.filter((c) => c.ok && c.siteId === site.id && c.at >= range.from && c.at <= range.to);
}

// Popular sign-in times: 12 two-hour blocks, named by the hour they end
// at ("02:00" is midnight to 2 AM ... "24:00" is 10 PM to midnight)
function byTwoHours(list) {
  const blocks = Array.from({ length: 12 }, (_, i) => ({
    label: `${String((i + 1) * 2).padStart(2, "0")}:00`,
    values: [0],
  }));
  for (const c of list) blocks[Math.floor(new Date(c.at).getHours() / 2)].values[0] += 1;
  return blocks;
}

// Each day of the month: [new guests, returning guests]. New: that
// guest's first sign-in ever; returning: every sign-in after that.
function newAndReturning(connections, list, year, month) {
  const first = new Map();
  for (const c of connections) {
    if (!c.ok || !c.guestId) continue;
    const seen = first.get(c.guestId);
    if (seen === undefined || c.at < seen) first.set(c.guestId, c.at);
  }
  const days = new Date(year, month + 1, 0).getDate();
  const out = Array.from({ length: days }, (_, i) => ({
    label: `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    values: [0, 0],
  }));
  for (const c of list) {
    const day = out[new Date(c.at).getDate() - 1];
    if (c.guestId && first.get(c.guestId) === c.at) day.values[0] += 1;
    else day.values[1] += 1;
  }
  return out;
}

// ---------- The graphs (drawn like the ones in the report) ----------

const BLUE = "#457AEE";
const GREY = "rgba(207, 211, 218, 0.82)";
const GRID = "#E6E8EC";
const WORDS = "#6E7079";
const FONT = '"Times New Roman", Times, serif';

// 0..max in about 5 steps of 1, 2, 2.5 or 5 × 10ⁿ
function steps(max) {
  if (max <= 0) return { top: 5, step: 1 };
  const rough = max / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough);
  const nice = Number.isInteger(step) ? step : Math.ceil(step);
  return { top: Math.ceil(max / nice) * nice, step: nice };
}

// A bar graph as a PNG. width × height: the size in the report (the
// picture is drawn 3 times bigger, so it's sharp when printed).
// series: one bar per value ([blue] or [blue, grey]); grey is drawn
// half over the blue one, the way the report's graph does it.
async function drawGraph(data, { width, height, labelEvery = 1 }) {
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const g = canvas.getContext("2d");
  g.scale(scale, scale);
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, 0, width, height);

  const max = Math.max(0, ...data.flatMap((d) => d.values));
  const { top, step } = steps(max);
  g.font = `12px ${FONT}`;
  const yWords = [];
  for (let v = 0; v <= top; v += step) yWords.push(String(v));
  const longest = Math.max(...data.map((d) => g.measureText(d.label).width));
  // Room for the numbers on the left, and for the first slanted name
  const left = Math.max(
    Math.ceil(Math.max(...yWords.map((w) => g.measureText(w).width))) + 14,
    Math.ceil(longest * Math.SQRT1_2) - 6,
  );
  const bottom = Math.ceil(longest * Math.SQRT1_2) + 16;
  const plot = { x: left, y: 14, w: width - left - 10, h: height - 14 - bottom };

  // Lines across, with their numbers
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (let v = 0; v <= top; v += step) {
    const y = Math.round(plot.y + plot.h - (v / top) * plot.h) + 0.5;
    g.strokeStyle = GRID;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(plot.x, y);
    g.lineTo(plot.x + plot.w, y);
    g.stroke();
    g.fillStyle = WORDS;
    g.fillText(String(v), plot.x - 8, y);
  }

  // The bars
  const slot = plot.w / data.length;
  const bar = Math.max(2, slot * (data[0].values.length > 1 ? 0.62 : 0.42));
  const shift = data[0].values.length > 1 ? bar * 0.28 : 0;
  data.forEach((d, i) => {
    const middle = plot.x + slot * (i + 0.5);
    const heightOf = (v) => (v / top) * plot.h;
    // blue on the right, grey over it on the left
    const order = d.values.length > 1 ? [[0, middle + shift], [1, middle - shift]] : [[0, middle]];
    for (const [k, centre] of order) {
      const h = heightOf(d.values[k]);
      if (h <= 0) continue;
      g.fillStyle = k === 0 ? BLUE : GREY;
      g.fillRect(centre - bar / 2, plot.y + plot.h - h, bar, h);
    }
  });

  // The names under the bars, turned 45°
  g.fillStyle = WORDS;
  g.textAlign = "right";
  g.textBaseline = "middle";
  data.forEach((d, i) => {
    if (i % labelEvery) return;
    g.save();
    g.translate(plot.x + slot * (i + 0.5) + 3, plot.y + plot.h + 9);
    g.rotate(-Math.PI / 4);
    g.fillText(d.label, 0, 0);
    g.restore();
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// ---------- Words ----------

// 17 → "17th"
function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}
// "November 17th, 2026"
export const submissionDate = (d = new Date()) =>
  `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;

const escapeXml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

// Who the report is to (the site's name) and the "Dear …": the client's
// title and last name from the site's Details ("Ms. Charles"), or
// "Sir/Madam" without a last name
export function reportNames(site) {
  const client = site.reportClient ?? {};
  const last = (client.lastName ?? "").trim();
  return {
    company: (site.name ?? "").trim(),
    contact: last ? [client.title, last].filter(Boolean).join(" ") : "Sir/Madam",
  };
}

// ---------- Getting the templates ----------

const templates = new Map();
async function template(name) {
  if (!templates.has(name)) {
    const res = await fetch(`/api/report-template/${name}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Couldn't get the report template. Try again.");
    templates.set(name, await res.arrayBuffer());
  }
  return templates.get(name);
}

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// The graphs and words for a site's month
async function makeParts({ site, connections, year, month }) {
  const range = monthRange(year, month);
  const list = signInsIn(connections, site, range);
  const [hours, days] = await Promise.all([
    // Sizes as in the report (Word: 310 × 300 and 654 × 300)
    drawGraph(byTwoHours(list), { width: 310, height: 300 }),
    drawGraph(newAndReturning(connections, list, year, month), { width: 654, height: 300 }),
  ]);
  return {
    hours,
    days,
    period: `${MONTHS[month]} ${year}`,
    submitted: submissionDate(),
    ...reportNames(site),
  };
}

const fileName = (parts, ext) => `${parts.company} - Wi-Fi Marketing Report ${parts.period}.${ext}`;

// ---------- Word ----------

export async function downloadReportWord({ site, connections, year, month }) {
  const [{ default: JSZip }, parts, file] = await Promise.all([
    import("jszip"),
    makeParts({ site, connections, year, month }),
    template("report.docx"),
  ]);
  const zip = await JSZip.loadAsync(file);
  let xml = await zip.file("word/document.xml").async("string");
  const words = {
    "{{MONTH}}": parts.period,
    "{{COMPANY}}": parts.company,
    "{{SUBMITTED}}": parts.submitted,
    "{{CONTACT}}": parts.contact,
  };
  for (const [token, value] of Object.entries(words)) xml = xml.split(token).join(escapeXml(value));
  zip.file("word/document.xml", xml);
  // image1: popular times; image2: new and returning guests
  zip.file("word/media/image1.png", parts.hours);
  zip.file("word/media/image2.png", parts.days);
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  save(blob, fileName(parts, "docx"));
}

// ---------- PDF ----------

// Where things go on the PDF's pages (points from the bottom left), as
// in the original
const LABEL_BLUE = [0, 0.471, 0.808];

export async function downloadReportPdf({ site, connections, year, month }) {
  const [{ PDFDocument, rgb }, { default: fontkit }, parts, file, regularFile, boldFile] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
    makeParts({ site, connections, year, month }),
    template("report.pdf"),
    template("Poppins-Regular.ttf"),
    template("Poppins-Bold.ttf"),
  ]);
  const pdf = await PDFDocument.load(file);
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularFile, { subset: true });
  const bold = await pdf.embedFont(boldFile, { subset: true });
  const black = rgb(0, 0, 0);
  const blue = rgb(...LABEL_BLUE);
  const [cover, , letter, graphs] = pdf.getPages();

  // A size that fits: smaller for a very long name
  const fit = (font, text, size, room) => {
    let s = size;
    while (s > 8 && font.widthOfTextAtSize(text, s) > room) s -= 0.5;
    return s;
  };

  // Cover: the title, centred
  const title = `Wi-Fi Marketing Report ${parts.period}`;
  const titleSize = fit(bold, title, 20, 440);
  cover.drawText(title, {
    x: 301.6 - bold.widthOfTextAtSize(title, titleSize) / 2,
    y: 282.47,
    size: titleSize,
    font: bold,
    color: black,
  });
  // "To: …" and "Submission date: …", the label in blue
  const line = (label, value, y) => {
    const labelWidth = bold.widthOfTextAtSize(`${label} `, 16);
    cover.drawText(label, { x: 25, y, size: 16, font: bold, color: blue });
    const size = fit(bold, value, 16, 560 - 25 - labelWidth);
    cover.drawText(value, { x: 25 + labelWidth, y, size, font: bold, color: black });
  };
  line("To:", parts.company, 205.45);
  line("Submission date:", parts.submitted, 157.45);

  // The letter
  letter.drawText(`Dear ${parts.contact}`, { x: 72.025, y: 640.15, size: 11, font: regular, color: black });

  // The graphs, where the old ones were
  const hours = await pdf.embedPng(parts.hours);
  const days = await pdf.embedPng(parts.days);
  graphs.drawImage(hours, { x: 184.1, y: 461.3, width: 227.5, height: 220.2 });
  graphs.drawImage(days, { x: 87.75, y: 155.32, width: 419.25, height: 192.3 });

  pdf.setTitle(title);
  pdf.setAuthor("Protonic Solutions Inc");
  pdf.setCreator("Foyer");
  const bytes = await pdf.save();
  save(new Blob([bytes], { type: "application/pdf" }), fileName(parts, "pdf"));
}

// ---------- Excel ----------

// Column 0 → "A", 26 → "AA"
const column = (n) => (n < 26 ? "" : column(Math.floor(n / 26) - 1)) + String.fromCharCode(65 + (n % 26));
const two = (n) => String(n).padStart(2, "0");
// "01-10-2026"
const dayText = (ms) => {
  const d = new Date(ms);
  return `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}`;
};
// "2026-10-01 02:05:29"
const timeText = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};

// The guests first seen in the month, oldest first, with the site's
// questions as columns
export function reportGuests({ site, guests, year, month }) {
  const range = monthRange(year, month);
  const fields = site.mode === "form" ? (site.fields ?? []) : [];
  const head = [...fields.map((f) => f.label), ...(fields.length ? [] : ["Device (MAC)"]), "Firstseen On", "Lastseen On", "Visits"];
  const rows = guests
    .filter((g) => g.siteId === site.id && g.firstSeenAt >= range.from && g.firstSeenAt <= range.to)
    .sort((a, b) => a.firstSeenAt - b.firstSeenAt)
    .map((g) => [
      ...fields.map((f) => {
        const value = g.answers?.[f.key];
        if (f.type === "checkbox") return answerText(f, value);
        return value === undefined || value === null ? "" : String(value);
      }),
      ...(fields.length ? [] : [g.mac]),
      dayText(g.firstSeenAt),
      timeText(g.lastSeenAt),
      g.visits ?? 1,
    ]);
  return { head, rows };
}

export async function downloadReportExcel({ site, guests, year, month }) {
  const [{ default: JSZip }, file] = await Promise.all([import("jszip"), template("guests.xlsx")]);
  const { head, rows } = reportGuests({ site, guests, year, month });
  const cell = (ref, value, style) =>
    typeof value === "number"
      ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  // Style 1: the blue heading; 2: a guest's line (as in the original)
  const xmlRows = [head, ...rows]
    .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(`${column(c)}${r + 1}`, v, r === 0 ? 1 : 2)).join("")}</row>`)
    .join("");
  // Each column as wide as its longest value (Poppins is wide)
  const widths = head.map((h, c) =>
    Math.min(60, Math.max(String(h).length, ...rows.map((row) => String(row[c]).length)) * 1.15 + 3),
  );
  const cols = `<cols>${widths
    .map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w.toFixed(2)}" style="5" customWidth="1"/>`)
    .join("")}</cols>`;

  const zip = await JSZip.loadAsync(file);
  const sheet = (await zip.file("xl/worksheets/sheet1.xml").async("string"))
    .replace("{{DIMENSION}}", `A1:${column(head.length - 1)}${rows.length + 1}`)
    .replace("{{COLS}}", cols)
    .replace("{{ROWS}}", xmlRows);
  zip.file("xl/worksheets/sheet1.xml", sheet);
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const parts = { ...reportNames(site), period: `${MONTHS[month]} ${year}` };
  save(blob, fileName(parts, "xlsx"));
  return rows.length;
}
