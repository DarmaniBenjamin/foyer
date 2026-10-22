// The web server: the API under /api, and the built pages (the dist
// folder, made by "npm run build") for every other address, so
// /sites/3 or /p/grand-anse-mall open the right page.
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { ROOT, PRODUCTION } from "./config.js";
import { authRouter, loadSession, setupRouter } from "./auth.js";
import { dataRouter } from "./routes/data.js";
import { usersRouter } from "./routes/users.js";
import { controllersRouter } from "./routes/controllers.js";
import { sitesRouter } from "./routes/sites.js";
import { adsRouter, guestsRouter, vouchersRouter, whitelistRouter } from "./routes/siteData.js";
import { portalRouter } from "./routes/portal.js";
import { arriveRouter } from "./routes/arrive.js";
import { maintenanceRouter } from "./routes/maintenance.js";
import { announceChanges, liveRouter, startLive } from "./live.js";

const DIST = path.join(ROOT, "dist");

export function makeApp() {
  const app = express();
  app.disable("x-powered-by");
  // SiteGround (and any https host) passes requests on from its own
  // front server; this makes req.secure and req.ip right
  app.set("trust proxy", 1);

  // Pictures (logos, backgrounds, ads) come inside the JSON
  app.use("/api", express.json({ limit: "15mb" }));
  // copy: which running copy of the app answered (a host may run several)
  app.get("/api/health", (req, res) =>
    res.json({
      server: "ok",
      database: "ok",
      // false: controllers can't be saved until SECRET_KEY is added
      secretKey: Boolean(process.env.SECRET_KEY) || !PRODUCTION,
      copy: process.pid,
      upSeconds: Math.round(process.uptime()),
    }),
  );
  app.use("/api", loadSession);
  // Every open tab hears about changes (live.js)
  app.use("/api", announceChanges);
  app.use("/api/live", liveRouter);
  startLive();
  app.use("/api/auth", authRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/data", dataRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/controllers", controllersRouter);
  app.use("/api/sites", sitesRouter);
  app.use("/api/vouchers", vouchersRouter);
  app.use("/api/whitelist", whitelistRouter);
  app.use("/api/ads", adsRouter);
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
      res.setHeader("Cache-Control", "no-cache");
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
