import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// For GitHub Pages project sites use VITE_BASE=/your-repo-name/ so /assets/* resolves.
// For Netlify / Cloudflare Pages at *.netlify.app / *.pages.dev, use "/" (default).
const rawBase = process.env.VITE_BASE;
const base =
  rawBase == null || rawBase === ""
    ? "/"
    : rawBase.replace(/\/?$/, "/");

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        player: resolve(__dirname, "index.html"),
        dataSite: resolve(__dirname, "data-site/index.html"),
        formSite: resolve(__dirname, "form-site/index.html"),
      },
    },
  },
});
