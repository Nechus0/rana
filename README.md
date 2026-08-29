# Rana

**Version Arvalis · 2.5.5**

Assistent für Berichte an den Gutachter zu Anträgen auf Psychotherapie
(Formblatt PTV 3). Windows-Anwendung. Alle Falldaten bleiben verschlüsselt
auf dem Gerät.

Nachfolger des HTML-Artefakts *Ptv3 Fortführungsbericht*, aber ein
eigenständiges Programm mit eigenem Datenspeicher. Das alte Artefakt wird
von Rana nie verändert.

---

## Was in 2.0 neu ist

**Eine Patientin, mehrere Berichte.** Bis 1.2 war ein „Fall" gleich einem
Bericht. Wer für dieselbe Person einen zweiten Fortführungsantrag
schrieb, legte einen zweiten Fall an — mit denselben Stammdaten,
doppelt gepflegt, und in der Liste standen zwei Einträge, die dieselbe
Person meinten. Jetzt hängen die Berichte unter der Patientin.

Die Aufteilung folgt einer Frage: *ändert sich das zwischen zwei
Anträgen?* Der Therapiebeginn nicht, die Ausgangslage bei
Therapiebeginn nicht, die Psychodynamik nicht — die stehen bei der
Person. Verlauf, Befund, Prognose und die Stundenzahlen stehen beim
Bericht.

**Doppelte Einträge können nicht mehr entstehen.** Die Zuordnung
geschieht beim Speichern, nicht beim Anlegen: Rana bringt den Namen auf
eine Vergleichsform — Titel weg, Umlaute aufgelöst, Bestandteile
sortiert — und findet dadurch „Pauer, Katrin" und „Katrin Pauer" als
dieselbe Person. „Berg" und „Bergmann" bleiben getrennt.

**Der Altbestand wird vorgeschlagen, nicht umsortiert.** Ob zwei
ähnliche Namen dieselbe Person meinen, weiss nur die Behandlerin. Rana
rechnet einen Vorschlag aus und legt ihn vor; jede Gruppe, jeder Name
und jeder einzelne Bericht lässt sich vorher ändern oder abwählen.
Wird nichts bestätigt, ändert sich nichts.

**Der Folgeantrag kostet einen Klick.** Er sitzt an der Zeile der
Patientin. Rana übernimmt die Stammdaten, zählt die laufende Nummer
hoch, rechnet das zuletzt beantragte Kontingent zum bewilligten hinzu,
legt den alten Bericht als Vorbericht ab und zieht die zuletzt
vereinbarten Therapieziele daraus — die der Leitfaden im nächsten
Bericht bilanziert sehen will.

---

## Was in 1.x neu war

**Der Bericht entsteht auf Knopfdruck.** Bisher musste der Prompt kopiert,
das Fenster gewechselt, das Modell umgestellt, die Antwort als Datei
abgelegt und diese wieder eingelesen werden — sechs Handgriffe pro Bericht.
Rana ruft Claude Opus 5 direkt auf und lässt den Text im Fenster entstehen.

**Nichts ist mehr fest verdrahtet.** Praxis, Behandler:in, Verfahren,
Setting, Zielgruppe und Qualifikation werden beim ersten Start abgefragt.
Das Verfahren steuert den Prompt: ein verhaltenstherapeutischer Bericht
bekommt Verhaltensanalyse und Bedingungsmodell statt Psychodynamik.

**Die Daten liegen sicher.** Verschlüsselte Datenbank statt Browser-Speicher,
Schlüssel im Windows-Tresor, tägliche Sicherung, Papierkorb mit 30 Tagen
Frist.

---

## Die Verwandlung

*Rana arvalis*, der Moorfrosch, ist ein unauffälliges braunes Tier, das sich
für wenige Tage im Frühjahr leuchtend blau färbt und danach wieder verblasst.

Die Anwendung hält es genauso. Sie bleibt ruhig — und wird blau **genau
dann, wenn Daten das Gerät verlassen**: die Schrittspur färbt sich, ein
schmaler Faden läuft am oberen Rand, der Knoten des laufenden Schritts
pulst. Endet die Verbindung, verblasst alles über anderthalb Sekunden.

Das ist nicht nur Zierde. Die Färbung wird ausschliesslich vom Rust-Teil
gesetzt, unmittelbar vor und nach dem Netzzugriff. Die Oberfläche kann sie
weder vortäuschen noch unterdrücken. Solange etwas blau leuchtet, spricht
Rana mit Anthropic. Ist es ruhig, tut sie es nicht.

Seit Fassung 1.1.0 gibt es einen zweiten möglichen Gesprächspartner, GitHub,
für die Aktualisierung. Damit der Satz oben wahr bleibt, ruft Rana dort
**nie von selbst** an — auch nicht beim Start. Die Prüfung läuft
ausschliesslich, wenn Sie in der Seitenschiene auf „Aktualisierung“ gehen und
den Knopf drücken, und sie ist dabei die ganze Zeit im Dialog sichtbar.

---

## Sicherheit

| | |
|---|---|
| **Anthropic-Schlüssel** | Windows Credential Manager. Erreicht die Oberfläche nie — dort ist er nur maskiert sichtbar (`sk-ant-…4f2a`). |
| **Falldaten** | AES-256-GCM, Schlüssel im Windows-Tresor. Im Klartext stehen in der Datei nur Kennung und Zeitstempel — kein Name, keine Chiffre, keine Diagnose. |
| **Klarnamen** | Werden getrennt gehalten und gehen **nie** an die Schnittstelle. Vor jedem Aufruf prüft Rust den gesamten Anfragetext an Wortgrenzen; ein Treffer bricht ab, bevor etwas gesendet wird. |
| **Netz** | Zwei Ziele, beide nur über TLS mit Zertifikatsprüfung: `api.anthropic.com` für die Berichte, `github.com` ausschliesslich für die Aktualisierung — und die läuft nur, wenn Sie sie in der Seitenschiene auslösen. Keine Telemetrie, keine Absturzberichte, keine Analysedienste. |
| **Aktualisierung** | Heruntergeladene Installer müssen mit dem privaten Schlüssel der Praxis signiert sein. Eine untergeschobene Datei wird verworfen, bevor sie ausgeführt wird. |
| **Oberfläche** | Strenge CSP, kein Nachladen von aussen. Eingefügter Text wird als reiner Text übernommen. |
| **Sicherungsdatei** | AES-256-GCM, Schlüssel per PBKDF2-HMAC-SHA-256 mit 600.000 Runden aus dem Passwort. Enthält **nicht** den Anthropic-Schlüssel. |

### Was Rana nicht leisten kann

* Die Sitzung mit Anthropic ist eine **Auftragsverarbeitung**. Für den
  Praxisbetrieb wird ein AV-Vertrag gebraucht; abschliessen muss ihn die
  Praxis selbst.
* Ein unbeaufsichtigter, entsperrter Rechner bleibt die grösste reale Lücke.
  Eine Bildschirmsperre ist vorgesehen, aber nicht in dieser Fassung.
* Der Installer trägt **keine Windows-Codesignatur**. Windows zeigt beim
  ersten Öffnen eine SmartScreen-Warnung; über „Weitere Informationen“ →
  „Trotzdem ausführen“ lässt er sich starten. Das ist etwas anderes als die
  Updater-Signatur: die beweist Rana, dass ein Update von Ihnen stammt, sagt
  Windows aber nichts. Eine Codesignatur kostet rund 300 € im Jahr und wäre
  erst nötig, wenn Rana an Kolleg:innen weitergegeben werden soll.

---

## Kosten

Opus 5 kostet 5 $ je Million Eingabe- und 25 $ je Million Ausgabemarken.

| | |
|---|---|
| Eingabe je Bericht | ca. 2.400 Marken |
| Ausgabe je Bericht | ca. 1.800 Marken |
| **Kosten je Bericht** | **rund 0,05 €** |
| **Bei einem Bericht täglich** | **rund 1,60 € im Monat** |

Die Stil- und Strukturregeln machen den grössten Teil der Eingabe aus und
sind bei jedem Bericht identisch. Sie werden als zwischenspeicherbarer Block
gesendet und kosten ab dem zweiten Bericht nur noch ein Zehntel.

### Drei Grenzen

1. **In Rana.** Jeder Aufruf wird mit tatsächlichem Verbrauch protokolliert.
   Ab 70 % ein Hinweis, ab 90 % eine Warnung, bei 100 % wird nicht mehr
   gesendet. Dazu ein Tageslimit gegen Programmfehler.
2. **Je Aufruf.** `max_tokens` steht fest auf 12.000. Ein einzelner Aufruf
   kann strukturell nie mehr als etwa 0,31 € kosten. Die Grenze lag bis
   2.5.4 bei 4.000 — zu knapp: der Bericht brach dann mitten im Satz ab,
   und er tat es stillschweigend. Bezahlt werden erzeugte Marken, nicht
   erlaubte; ein gewöhnlicher Bericht bleibt bei rund 2.000. Wird die
   Grenze doch erreicht, sagt es Rana jetzt deutlich.
3. **Bei Anthropic.** Die Ersteinrichtung führt ausdrücklich zur
   Ausgabengrenze in der Console. Das ist die einzige Grenze, die auch dann
   greift, wenn der Schlüssel abhandenkommt.

---

## Weiterentwickeln

Wer an Rana arbeitet oder ein Update ausliefert: **[ENTWICKLUNG.md](ENTWICKLUNG.md)**.
Dort stehen der Ablauf, die Fallstricke und was beim Ändern leicht
kaputtgeht.

---

## Bauen

### Einmalig: Signaturschlüssel

Der Updater lädt nur Installer, die mit Ihrem privaten Schlüssel signiert
sind. Ohne Schlüsselpaar schlägt der Bau fehl.

```powershell
npm install
npx tauri signer generate -w "$env:USERPROFILE\.tauri\rana.key"
```

Der Befehl fragt nach einem Passwort und gibt den **öffentlichen** Schlüssel
aus. Diesen in `src-tauri/tauri.conf.json` unter `plugins.updater.pubkey`
eintragen — dort steht bis dahin ein Platzhalter.

Anschliessend unter *Settings → Secrets and variables → Actions* zwei
Geheimnisse anlegen:

| Name | Wert |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | vollständiger Inhalt von `rana.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | das vergebene Passwort |

Der **private** Schlüssel gehört nie ins Repository, nie in einen Chatverlauf
und nie in eine Datei im Projektordner. Wer ihn besitzt, kann ein gefälschtes
Rana-Update signieren, das Ihre Anwendung dann selbsttätig installiert.

### Über GitHub Actions (empfohlen)

Bei jedem Stand auf `main` baut GitHub auf einem echten Windows-Läufer und
legt `.msi` und `.exe` als Download bereit. Nichts muss lokal installiert
sein.

```
Repository → Actions → letzter Lauf → Artifacts → Rana-Windows
```

Für eine Veröffentlichung mit Versionsnummer:

```bash
git tag v1.1.0
git push origin v1.1.0
```

### Auf dem eigenen Rechner

Nötig sind [Rust](https://rustup.rs), Node 22 und die Visual-Studio-
Buildwerkzeuge (C++).

```bash
npm install
npm run tauri build      # Installer unter src-tauri/target/release/bundle/
npm run tauri dev        # zum Entwickeln
```

---

## Aufbau

```
src/                     Oberfläche (TypeScript, kein Rahmenwerk)
├─ core/ipc.ts           die einzige Stelle, die mit Rust spricht
├─ core/state.ts         Zustand, verzögertes Speichern, Vollständigkeit
├─ setup/wizard.ts       Ersteinrichtung
├─ report/prompt.ts      Auftrag an Claude, verfahrensabhängig
├─ report/render.ts      Rohtext → gesetztes Dokument
├─ report/docx.ts        OOXML von Hand
├─ views/steps.ts        die fünf Arbeitsschritte
├─ views/patients.ts     der Zuordnungs-Vorschlag
└─ styles/tokens.css     das Design-System

src-tauri/src/           Rust — alles Vertrauliche
├─ secrets.rs            Windows Credential Manager
├─ store.rs              verschlüsselte SQLite
├─ patients.rs           Zuordnung, Namensvergleich, Zusammenführung
├─ claude.rs             Netzzugriff, Klarnamensperre, Streaming
├─ budget.rs             Kostenwächter
├─ backup.rs             Sicherung und Wiederherstellung
└─ settings.rs           Praxisprofil
```

Der Schnitt ist bewusst: **Schlüssel, Falldaten, Netzzugriff und
Kostengrenze liegen sämtlich hinter der Brücke.** Die Oberfläche ruft
`invoke("generate_report", …)` und bekommt Text zurück — sie sieht den
Schlüssel nicht, kann die Datenbank nicht direkt lesen und den Kostenstopp
nicht umgehen.

---

## Prüfungen

`cargo test` sichert die Stellen, an denen ein Fehler wirklich weh täte:

* **Das Datenmodell** — 21 Prüfungen gegen eine echte, verschlüsselte
  SQLite-Datei: dass zwei Schreibweisen desselben Namens eine Patientin
  ergeben und zwei verschiedene Namen zwei; dass beim Zusammenführen
  kein Bericht verloren geht; dass ein zweiter Durchlauf keine zweite
  Patientin anlegt; dass ein leeres Feld im neuen Antrag kein gefülltes
  im alten überschreibt; dass eine entfernte Patientin ihre Berichte
  stehen lässt. Nur der Datenbankschlüssel kommt dabei aus einer
  Testquelle statt aus dem Windows-Tresor — sonst läuft alles echt.
* **Klarnamensperre** — erkennt Vor- und Nachnamen an Wortgrenzen,
  unabhängig von Gross- und Kleinschreibung und mit Satzzeichen daneben;
  schlägt nicht bei zusammengesetzten Wörtern an („Roesickstrasse“) und
  nicht bei Namensteilen unter drei Zeichen.
* **Kostenrechnung** — ein Bericht bleibt unter sieben Cent, ein Bericht
  täglich unter drei Euro im Monat, der teuerste denkbare Einzelaufruf unter
  fünfzehn Cent, und ein unbekanntes Modell wird zum teuersten Satz
  gerechnet.

Alle laufen bei jedem Bau auf GitHub mit. Schlagen sie fehl, entsteht kein
Installer.

---

## Tastatur

| | |
|---|---|
| `Strg` + `S` | Speichern |
| `Strg` + `N` | Neuer Fall |
| `Strg` + `F` | Fallsuche |
| `Strg` + `1` … `5` | Zu einem Schritt springen |
| `Strg` + `,` | Einstellungen |
| `←` `→` | Blättern (ausserhalb von Feldern) |
| `Esc` | Dialog schliessen |

---

## Was noch nicht drin ist

* **Erstantrag PTV 3** — andere Gliederung, im Profil vorgesehen, folgt.
* **Untertitel und Zeichenkorridor** stehen seit 2.0 nicht mehr im
  Einstellungsdialog. Die Werte bleiben im Profil und wirken unverändert
  weiter; verstellen lassen sie sich dort nicht mehr.
* **Diktat** für die Verlaufsnotizen in Schritt 3.
* **Bildschirmsperre** nach Untätigkeit.
* **PDF ohne Systemdialog.** Rana setzt das fertige Dokument in ein eigenes
  Fenster und nutzt dessen PDF-Ausgabe. Vorteil: pixelgleich zur Vorschau,
  kein zweites Layout, das auseinanderlaufen kann. Preis: ein Dialog, in dem
  „Microsoft Print to PDF“ zu wählen ist.
