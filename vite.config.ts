import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A plain static bundle keeps the site deployable on GitHub Pages, including
// the custom-domain root at tools.integ.life.
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
