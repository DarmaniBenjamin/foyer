import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // npm run dev: the pages ask the server (npm run server) for /api,
    // and guests arriving from a controller go to the server too
    proxy: {
      "/api": "http://localhost:4100",
      "/guest/s": "http://localhost:4100",
      "/omada": "http://localhost:4100",
    },
  },
  build: {
    // The Excel tool is about 1 MB on its own. It's only downloaded when
    // someone presses "Guest list (Excel)", so that's fine.
    chunkSizeWarningLimit: 1200,
  },
});