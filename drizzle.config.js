// Settings for drizzle-kit, the tool that writes the database update
// files (server/drizzle) from server/db/schema.js: npm run db:generate
import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./server/config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.js",
  out: "./server/drizzle",
  dbCredentials: { url: databaseUrl() },
});
