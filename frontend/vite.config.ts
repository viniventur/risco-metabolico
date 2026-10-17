/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Nome do pacote dentro de node_modules (independente do separador de caminho). */
function pacote(id: string): string {
  const i = id.lastIndexOf("node_modules");
  return i < 0 ? "" : id.slice(i + "node_modules".length + 1);
}

// Vite 8 (rolldown): codeSplitting substitui o manualChunks. Cada biblioteca pesada vira um chunk
// nomeado — o Plotly (1,4 MB) só é baixado em /estudos/:slug, a única rota que o importa.
const GRUPOS = [
  { name: "plotly", prefixos: ["plotly.js"] },
  { name: "katex", prefixos: ["katex", "rehype-katex", "remark-math"] },
  { name: "recharts", prefixos: ["recharts", "victory-vendor", "d3-"] },
];

// Sem proxy para /api de propósito: o proxy do Vite eliminaria o CORS em desenvolvimento e o
// problema só apareceria em produção. O front fala com VITE_API_URL em origem cruzada de verdade.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O alias "@" -> src vale para Vite e Vitest; o `paths` do tsconfig só vale para o tsc.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: GRUPOS.map((g) => ({
            name: g.name,
            test: (id: string) => g.prefixos.some((p) => pacote(id).startsWith(p)),
          })),
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
