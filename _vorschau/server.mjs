// Winziger Dateiserver nur fuer die Gestaltungs-Vorschau.
// Chrome laesst sich per file:// schlecht fernsteuern; ueber
// http://localhost geht es zuverlaessig.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const WURZEL = normalize(new URL("..", import.meta.url).pathname.replace(/^\//, ""));
const TYPEN = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };

createServer(async (req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const datei = join(WURZEL, pfad === "/" ? "_vorschau/index.html" : pfad);
  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, { "Content-Type": TYPEN[extname(datei)] ?? "application/octet-stream" });
    res.end(inhalt);
  } catch {
    res.writeHead(404).end("nicht gefunden: " + datei);
  }
}).listen(4173, () => console.log("Vorschau auf http://localhost:4173"));
