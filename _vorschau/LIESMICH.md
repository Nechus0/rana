# Gestaltungs-Vorschau

Rana zu bauen dauert auf dem Bauserver zwanzig Minuten; auf diesem
Rechner geht es gar nicht (kein MSVC-Linker). Für Layoutfragen ist das
viel zu langsam — und die Oberfläche über eine Bildschirmaufnahme des
laufenden Programms zu begutachten lässt das Fenster flackern, weil das
WebView bei jeder Aufnahme neu zeichnet.

Diese Vorschau bindet **die echten Formatvorlagen** ein und stellt das
Markup nach, das `main.ts` und `settings.ts` erzeugen. Sie zeigt damit
dieselben Layoutfehler, ohne etwas zu bauen und ohne den Bildschirm der
Nutzerin anzufassen.

## Benutzen

```powershell
node _vorschau/server.mjs          # laeuft auf http://localhost:4173
```

Dann im Browser öffnen:

```
http://localhost:4173/_vorschau/index.html
```

Der Pfad muss vollständig sein — `/` allein löst die relativen Verweise
im Markup falsch auf.

## Was sie schon gefunden hat

* **Die Felder unter „Praxis" waren gar nicht gestaltet.** Der Wähler
  hiess `input[type="text"]`, das Markup schrieb aber `<input>` ohne
  type-Angabe. Ein Textfeld ohne type ist trotzdem ein Textfeld — der
  Wähler trifft es nur nicht.
* **`var(--surface)` gibt es nicht.** Drei Stellen in `app.css` setzten
  damit einen Hintergrund, der deshalb durchsichtig blieb.
* **`:not()` übernimmt das Gewicht seiner Argumente.** Die Reparatur
  oben war zunächst so spezifisch, dass sie dem Suchfeld in der
  Seitenschiene den Platz für die Lupe nahm. `:not(:where(…))` behebt
  das.

## Grenze

Sie kennt keinen Zustand: keine Daten, keine Klicks, kein Rust. Für
Verhalten ist der Prüfstand in `_pruefstand` zuständig, für das
Zusammenspiel das gebaute Programm.
