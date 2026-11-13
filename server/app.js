// The web server: the API under /api, and the built pages (the dist
// folder, made by "npm run build") for every other address, so
// /sites/3 or /p/grand-anse-mall open the right page.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import compression from "compression";
import { ROOT, PRODUCTION } from "./config.js";
import { authRouter, loadSession, requireAccess, setupRouter } from "./auth.js";
import { healthDetails } from "./healthDetails.js";
import { dataRouter } from "./routes/data.js";
import { usersRouter } from "./routes/users.js";
import { controllersRouter } from "./routes/controllers.js";
import { sitesRouter } from "./routes/sites.js";
import { adsRouter, guestsRouter, vouchersRouter, whitelistRouter } from "./routes/siteData.js";
import { portalRouter } from "./routes/portal.js";
import { mediaRouter, serveAdPicture, serveMedia } from "./routes/media.js";
import { arriveRouter } from "./routes/arrive.js";
import { maintenanceRouter } from "./routes/maintenance.js";
import { announceChanges, liveRouter, startLive } from "./live.js";
import { startWatching } from "./controllers/watch.js";

const DIST = path.join(ROOT, "dist");

// The Content-Security-Policy. The one script written into index.html
// (it picks light or dark before the page draws) is allowed by its
// fingerprint, so it's read from the built page.
function contentPolicy() {
  const inline = [];
  try {
    const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
    for (const [, code] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
      inline.push(`'sha256-${crypto.createHash("sha256").update(code).digest("base64")}'`);
  } catch {
    // Not built yet
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${inline.join(" ")}`.trim(),
    // The pages set colours and sizes on elements themselves
    "style-src 'self' 'unsafe-inline'",
    // Pictures and videos in ads can be anywhere on the web
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    // (the sign-in page also checks the guest is online by asking a
    // website for nothing)
    "connect-src 'self' data: blob: https: http:",
    // Videos in ads: YouTube and Vimeo players only
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function makeApp() {
  const app = express();
  app.disable("x-powered-by");
  // SiteGround (and any https host) passes requests on from its own
  // front server; this makes req.secure and req.ip right
  app.set("trust proxy", 1);

  // Nothing from Foyer may be kept by a cache in between. SiteGround's
  // "Dynamic Cache" keeps every page and API answer unless told not to,
  // and then hands out old answers: a site you just made vanishes on
  // refresh, or one person's data reaches another. Only the built files
  // (dist/assets, which never change) say otherwise, further down.
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // What browsers are told to refuse, on every answer:
  // - only Foyer's own code may run on its pages (a planted script in a
  //   name, an ad or a copied portal does nothing)
  // - no other website may show Foyer inside itself (to trick clicks)
  // - files are shown as the type Foyer says, never guessed
  // - other websites aren't told the address you came from (a guest's
  //   sign-in details are in theirs)
  // - once opened over https, always https
  const policy = contentPolicy();
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", policy);
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
    next();
  });

  // A change (anything but reading) must come from Foyer's own pages.
  // Browsers say where a request came from (Origin); another website
  // can't use your sign-in to change things behind your back.
  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.get("origin");
    const site = req.get("sec-fetch-site");
    let foreign = site === "cross-site";
    if (origin && origin !== "null") {
      try {
        const from = new URL(origin);
        foreign = from.host !== req.get("host") && from.hostname !== req.hostname;
      } catch {
        foreign = true;
      }
    } else if (origin === "null") foreign = true;
    if (foreign) return res.status(403).json({ error: "That came from another website, so it was refused." });
    next();
  });

  // Everything sent is squeezed (gzip) when the browser can take it: the
  // app's code and the data (sites, guests…) come down 3–5 times smaller.
  // Not the live line (it must arrive at once, not when a block is full),
  // nor pictures and videos, which are squeezed already.
  app.use(
    compression({
      filter: (req, res) =>
        !req.path.startsWith("/api/live") &&
        !req.path.startsWith("/media/") &&
        !req.path.startsWith("/ad-pictures/") &&
        compression.filter(req, res),
    }),
  );

  // Pictures (logos, backgrounds, ads) come inside the JSON
  app.use("/api", express.json({ limit: "15mb" }));
  // Anyone can ask this (hosts check it), so it only says it's running
  app.get("/api/health", (req, res) =>
    res.json({
      server: "ok",
      database: "ok",
      // false: controllers can't be saved until SECRET_KEY is added
      secretKey: Boolean(process.env.SECRET_KEY) || !PRODUCTION,
    }),
  );
  app.use("/api", loadSession);
  // Which database this copy uses: admins only
  app.get("/api/health/details", requireAccess("maintenance"), healthDetails);
  // Every open tab hears about changes (live.js)
  app.use("/api", announceChanges);
  app.use("/api/live", liveRouter);
  startLive();
  // Every controller checked every 5 minutes (controllers/watch.js)
  startWatching();
  app.use("/api/auth", authRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/data", dataRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/controllers", controllersRouter);
  app.use("/api/sites", sitesRouter);
  app.use("/api/vouchers", vouchersRouter);
  app.use("/api/whitelist", whitelistRouter);
  app.use("/api/ads", adsRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/guests", guestsRouter);
  app.use("/api/portal", portalRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use("/api", (req, res) => res.status(404).json({ error: "There's nothing at that address." }));

  // Errors: a Problem has words for the page; anything else is logged
  // and the page gets a general message
  app.use("/api", (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.status && err.status < 500)
      return res.status(err.status).json({ error: err.message });
    // A server setting that's missing, in words for whoever set it up
    if (err.expose) return res.status(500).json({ error: err.message });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "That's too big to save. Use smaller pictures." });
    console.error(`${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ error: "Something went wrong on the server. Try again." });
  });

  // Pictures and videos uploaded in the splash ad builder
  app.get("/media/:key", serveMedia);
  // Each picture of a picture ad, at its own address
  app.get("/ad-pictures/:id/:code", serveAdPicture);

  // Guests arriving from UniFi (/guest/s/…) and Omada (/omada/…)
  app.use(arriveRouter);

  // The pages
  if (fs.existsSync(DIST)) {
    app.use(
      express.static(DIST, {
        index: false,
        // Files with a hash in their name never change, so browsers keep them
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`))
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    // Any other address (/login, /sites/3/settings, a typo…) gets the app,
    // which opens that page, or sends you to the dashboard / sign-in.
    // root + dotfiles: SiteGround keeps apps in a hidden folder
    // (~/.nodejs/…), and sendFile refuses those by default ("Not Found")
    app.get("/{*any}", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.sendFile("index.html", { root: DIST, dotfiles: "allow" });
    });
  } else {
    app.get("/{*any}", (req, res) =>
      res
        .status(503)
        .type("text")
        .send(
          PRODUCTION
            ? "The site isn't built yet. Set the build command to: npm run build"
            : "Run the pages with: npm run dev (then open http://localhost:5173)",
        ),
    );
  }
  return app;
}
