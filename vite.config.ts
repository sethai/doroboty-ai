import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// PostHog is sent through /ingest on the app's own origin. Netlify proxies it
// in production (netlify.toml); this mirrors it for `npm run dev` and preview.
function posthogProxy(host: string | undefined) {
  if (!host) return undefined;
  const assets = host.replace(/:\/\/(eu|us)\.i\./, "://$1-assets.i.");
  return {
    "/ingest/static": {
      target: assets,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ingest/, ""),
    },
    "/ingest": {
      target: host,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ingest/, ""),
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_PUBLIC_POSTHOG_");
  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy: posthogProxy(env.VITE_PUBLIC_POSTHOG_HOST) },
  };
});
