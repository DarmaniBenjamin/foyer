// The downloads on the Reports page:
// - the guest list as Excel: one sheet per site, every form question its
//   own column, one row per guest who signed in during the range
// - the report as Word: totals, the sign-ins graph and popular times
//
// The Excel and Word tools are big, so they're only loaded when a
// download is pressed.
import { createElement } from "react";
import { formatRange, rangeForFile } from "./dates";
import { buildReport, guestsIn } from "./reports";
import { answerText } from "./guests";
import { SIGN_IN_MODES } from "./data";
import BarChart from "./Components/BarChart";
import { GUEST_SERIES, PRINT_COLORS } from "./Components/chartColors";

const BRAND = "1D64D8";

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

// Excel shows times exactly as stored, so they're stored as local time
const excelDate = (ms) =>
  new Date(ms - new Date(ms).getTimezoneOffset() * 60 * 1000);

// Sheet names: at most 31 characters, none of : \ / ? * [ ]
function sheetName(name, used) {
  const base = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Site";
  let next = base;
  for (let n = 2; used.has(next.toLowerCase()); n++) next = `${base} ${n}`;
  used.add(next.toLowerCase());
  return next;
}

// ---------- Guest list (Excel) ----------

export async function downloadGuestExcel({ sites, guests, connections, site, range }) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "Foyer";
  book.created = new Date();
  const used = new Set();
  let rows = 0;

  for (const s of site ? [site] : sites) {
    const list = guestsIn({ connections, guests, site: s, range });
    if (!site && list.length === 0) continue;
    const fields = s.mode === "form" ? s.fields : [];
    const sheet = book.addWorksheet(sheetName(s.name, used), {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      ...fields.map((f) => ({ header: f.label, key: f.key })),
      { header: "Sign-ins in period", key: "_signins" },
      { header: "First seen", key: "_first", style: { numFmt: "d mmm yyyy h:mm AM/PM" } },
      { header: "Last seen", key: "_last", style: { numFmt: "d mmm yyyy h:mm AM/PM" } },
      { header: "Device (MAC)", key: "_mac" },
    ];

    for (const g of list) {
      const row = {
        _signins: g.signInsInRange,
        _first: excelDate(g.firstSeenAt),
        _last: excelDate(g.lastSeenAt),
        _mac: g.mac,
      };
      for (const f of fields) {
        const value = g.answers?.[f.key];
        row[f.key] = f.type === "checkbox" ? answerText(f, value) : (value ?? "");
      }
      sheet.addRow(row);
      rows += 1;
    }

    // The heading row: bold white on blue, with filter buttons
    const head = sheet.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
    head.alignment = { vertical: "middle" };
    head.height = 22;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

    // Each column as wide as its longest value (within reason)
    sheet.columns.forEach((column) => {
      let widest = String(column.header).length;
      column.eachCell({ includeEmpty: false }, (cell, n) => {
        if (n === 1) return;
        const text = cell.value instanceof Date ? "21 Oct 2026 10:30 PM" : String(cell.value ?? "");
        widest = Math.max(widest, text.length);
      });
      column.width = Math.min(50, widest + 3);
    });
  }

  if (book.worksheets.length === 0) book.addWorksheet("No guests");
  const buffer = await book.xlsx.writeBuffer();
  save(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${site ? site.name : "All sites"} guests ${rangeForFile(range)}.xlsx`,
  );
  return rows;
}

// ---------- Report (Word) ----------

// A chart → PNG picture, drawn in light colours at twice the size so it
// stays sharp when printed
async function chartPicture(renderToStaticMarkup, data, height, series) {
  const svg = renderToStaticMarkup(
    createElement(BarChart, {
      data,
      series,
      height,
      colors: PRINT_COLORS,
      fontFamily: "Arial, Helvetica, sans-serif",
      forPicture: true,
    }),
  );
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Couldn't draw a chart."));
      image.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = 720 * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, 720, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadWordReport({ sites, guests, connections, site, range }) {
  const [docx, { renderToStaticMarkup }] = await Promise.all([
    import("docx"),
    import("react-dom/server"),
  ]);
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = docx;

  const report = buildReport({ connections, guests, sites, site, range });
  const period = formatRange(range);
  const [signInsChart, hourChart, dayChart] = await Promise.all([
    chartPicture(renderToStaticMarkup, report.series, 260, GUEST_SERIES),
    chartPicture(renderToStaticMarkup, report.byHour, 220),
    chartPicture(renderToStaticMarkup, report.byWeekday, 220),
  ]);

  const line = { style: BorderStyle.SINGLE, size: 4, color: "E3E8F0" };
  const borders = { top: line, bottom: line, left: line, right: line };
  const cell = (text, { bold = false, head = false, width } = {}) =>
    new TableCell({
      borders,
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
      shading: head ? { type: ShadingType.CLEAR, fill: BRAND, color: "auto" } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: String(text), bold: bold || head, color: head ? "FFFFFF" : undefined })],
        }),
      ],
    });
  const table = (rows, widths) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        (row, r) =>
          new TableRow({
            tableHeader: r === 0,
            children: row.map((text, c) => cell(text, { head: r === 0, width: widths?.[c] })),
          }),
      ),
    });
  const picture = (data, height) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: "png", data, transformation: { width: 620, height: Math.round((620 / 720) * height) } })],
    });
  const heading = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 120 }, text });
  const note = (text) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, color: "5F6B7D", size: 20 })] });

  const busy = (item) => (item && item.value > 0 ? `${item.title} (${item.value.toLocaleString()})` : "—");

  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, text: "Guest Wi-Fi report" }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: site ? site.name : "All sites", bold: true, size: 28 }),
        new TextRun({ text: `   ${period}`, size: 28, color: "5F6B7D" }),
      ],
    }),
    heading("Summary"),
    table(
      [
        ["", ""],
        ["Sign-ins", report.signIns.toLocaleString()],
        ["Guests (devices)", report.guests.toLocaleString()],
        ["New guests", report.newGuests.toLocaleString()],
        ["Guests who came back", report.returning.toLocaleString()],
        ["Sign-ins per day (average)", report.perDay.toFixed(1)],
        [report.byMonth ? "Busiest month" : "Busiest day", busy(report.busiestDay)],
        ["Busiest time of day", busy(report.busiestHour)],
        ["Busiest day of the week", busy(report.busiestWeekday)],
      ].map((row, i) => (i === 0 ? ["What", "Number"] : row)),
      [60, 40],
    ),
    heading(report.byMonth ? "Sign-ins per month" : "Sign-ins per day"),
    picture(signInsChart, 260),
    heading("Popular times"),
    note("When guests sign in, in 2-hour blocks, across the whole period."),
    picture(hourChart, 220),
    heading("Busiest days of the week"),
    picture(dayChart, 220),
  ];

  if (!site) {
    children.push(
      heading("Sites"),
      table(
        [
          ["Site", "Sign-in", "Sign-ins", "Guests"],
          ...report.siteRows.map((r) => [
            r.site.name,
            SIGN_IN_MODES[r.site.mode].label,
            r.signIns.toLocaleString(),
            r.guests.toLocaleString(),
          ]),
        ],
        [40, 20, 20, 20],
      ),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 480 },
      children: [
        new TextRun({
          text: `Made ${new Date().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}`,
          color: "98A2B3",
          size: 18,
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: "Foyer",
    title: `Guest Wi-Fi report ${period}`,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  save(await Packer.toBlob(doc), `${site ? site.name : "All sites"} report ${rangeForFile(range)}.docx`);
}