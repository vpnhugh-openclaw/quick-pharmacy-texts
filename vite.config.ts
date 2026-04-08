import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
let componentTagger: (() => unknown) | null = null;

try {
  if (process.env.NODE_ENV !== 'production') {
    const lovableTagger = await import('lovable-tagger');
    componentTagger = lovableTagger.componentTagger;
  }
} catch {
  componentTagger = null;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger ? componentTagger() : null].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
