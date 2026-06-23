import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Don't watch data files dropped in the repo (e.g. an open .xlsx locks the
    // file and crashes the dev server with EBUSY). These never affect the build.
    watch: { ignored: ["**/*.xlsx", "**/*.xls", "**/*.csv"] },
  },
});
