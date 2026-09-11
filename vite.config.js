import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@website": path.resolve(rootDir, "../SmartCRM-Website-Frontend/src"),
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
      "react-router-dom": path.resolve(rootDir, "node_modules/react-router-dom"),
      "framer-motion": path.resolve(rootDir, "node_modules/framer-motion"),
      "lucide-react": path.resolve(rootDir, "node_modules/lucide-react"),
      "motion-dom": path.resolve(rootDir, "node_modules/motion-dom"),
    },
    dedupe: ["react", "react-dom", "react-router-dom", "framer-motion", "lucide-react"],
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    fs: {
      allow: [rootDir, path.resolve(rootDir, "../SmartCRM-Website-Frontend")],
    },
    allowedHosts: [
      ".trycloudflare.com",
      ".ngrok.io",
    ],
  },
  plugins: [react()],
});
