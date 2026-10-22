// Downloads one chart as a PNG picture: the chart exactly as it is on the
// page (same size, bars and gaps, whatever the screen), in the light
// colours on white, with its title and which site and dates it's for
// above it, drawn at twice the size so it stays sharp in emails and
// documents.
import { createElement } from "react";
import BarChart, { chartSize } from "./Components/BarChart";
import { PRINT_COLORS } from "./Components/chartColors";

const PAD = 24;
const HEADER = 64;

export async function downloadChart({ title, subtitle, data, series, height = 240, fileName }) {
  const { width: WIDTH, height: chartH } = chartSize(data, series, height);
  // Only loaded when a chart is downloaded
  const { renderToStaticMarkup } = await import("react-dom/server");
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
    const chart = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Couldn't draw the chart."));
      image.src = url;
    });
    const scale = 2;
    // Wide enough for the chart and the words above it
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = "600 18px Arial, Helvetica, sans-serif";
    let textW = measure.measureText(title).width;
    measure.font = "13px Arial, Helvetica, sans-serif";
    textW = Math.max(textW, measure.measureText(subtitle || "").width);
    const w = Math.ceil(Math.max(WIDTH, textW)) + PAD * 2;
    const h = HEADER + chartH + PAD;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0f1b2d";
    ctx.font = "600 18px Arial, Helvetica, sans-serif";
    ctx.fillText(title, PAD, PAD + 14);
    if (subtitle) {
      ctx.fillStyle = "#5f6b7d";
      ctx.font = "13px Arial, Helvetica, sans-serif";
      ctx.fillText(subtitle, PAD, PAD + 34);
    }
    ctx.drawImage(chart, PAD, HEADER, WIDTH, chartH);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const link = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = link;
    a.download = `${fileName || title}.png`.replace(/[\\/:*?"<>|]+/g, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(link), 2000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
