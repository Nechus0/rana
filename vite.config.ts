import { defineConfig } from "vite";

export default defineConfig({
  // Tauri liefert die Oberfläche aus einem eigenen Protokoll aus,
  // deshalb relative Pfade.
  base: "./",
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    target: "chrome105",
    outDir: "dist",
    emptyOutDir: true,
    // Kein Nachladen zur Laufzeit: alles liegt in der Anwendung.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
