# Entwicklung und Auslieferung

Diese Datei ist die Übergabe an jede künftige Claude-Sitzung mit Desktop
Commander. Sie steht bewusst **im Repository** und nicht auf dem Desktop:
so wandert sie mit dem Code, kann nicht veralten und ist nach einem
`git clone` sofort da.

> **Für Claude:** Wenn Anja um ein Update bittet, ist dies der Einstieg.
> Lies zuerst diese Datei, dann `README.md`. Die Abschnitte 5 und 6
> enthalten Fallstricke, die schon einmal Zeit gekostet haben — bitte
> vorher lesen, nicht erst nach dem Fehlschlag.

---

## 1 · Wo alles liegt

| Was | Wo |
|---|---|
| Repository | `https://github.com/Nechus0/rana` (öffentlich) |
| Arbeitskopie | `C:\Users\AnjaR\Desktop\Claude Berichte\Programm\Rana\Rana-1.1.0\rana` |
| Installierte Anwendung | `%LOCALAPPDATA%\Programs\Rana` |
| Falldaten (verschlüsselt) | `%APPDATA%\de.rana.bericht` |
| Tägliche Sicherungen | `%APPDATA%\de.rana.bericht\sicherungen` |
| Privater Signaturschlüssel | `%USERPROFILE%\.tauri\rana.key` — **nur auf diesem Rechner** |
| Anthropic-Schlüssel | Windows Credential Manager, Dienst `Rana` |

Der Rechner heisst `FROSCH-KIEBITZ`. Die Standard-Shell von Desktop
Commander ist PowerShell.

---

## 2 · Was Rana ist

Windows-Anwendung (Tauri 2, Rust-Backend, Oberfläche TypeScript ohne
Rahmenwerk) für Berichte an den Gutachter zu Fortführungsanträgen auf
Psychotherapie, Formblatt PTV 3.

Aufbau und Sicherheitsentwurf stehen im `README.md`. Der Kerngedanke in
einem Satz: **Schlüssel, Falldaten, Netzzugriff und Kostengrenze liegen
sämtlich in Rust**, die Oberfläche kommt an keines davon heran.

---

## 3 · Ein Update ausliefern

Das ist der übliche Auftrag. Fünf Schritte, in dieser Reihenfolge.

### 3.1 Ändern und prüfen

```powershell
cd "C:\Users\AnjaR\Desktop\Claude Berichte\Programm\Rana\Rana-1.1.0\rana"
npm install
npx tsc --noEmit          # muss fehlerfrei sein
npx vite build            # muss fehlerfrei sein
```

Wurde am Bericht, am Prompt oder an den Feldern gearbeitet, zusätzlich:

```powershell
npx esbuild _test/_entry.ts --bundle --format=esm --platform=neutral --outfile=_test/bundle.mjs
node _test/abnahme.mjs    # 28 Zusicherungen, muss 0 Fehler melden
node _test/seiten.mjs     # misst die Seitenzahl, braucht LibreOffice
node _test/korridor.mjs   # misst, wo der Bericht auf Seite 3 kippt
```

### 3.2 Version an vier Stellen hochzählen

**Alle vier, sonst passiert nichts** — siehe Fallstrick 5.1.

| Datei | Stelle |
|---|---|
| `package.json` | `"version"` |
| `src-tauri\Cargo.toml` | `version =` |
| `src-tauri\tauri.conf.json` | `"version"` |
| `README.md` | Zeile „Version Arvalis · …" |

Danach einmal `npm install`, damit `package-lock.json` nachzieht.

### 3.3 Lokal bauen

```powershell
npm run tauri build
```

Zeigt Fehler in drei Minuten statt in zwanzig. Der Installer landet unter
`src-tauri\target\release\bundle\nsis\`.

### 3.4 Schieben und markieren

```powershell
git add -A
git commit -m "Kurze Beschreibung"
git push origin main
git tag v1.2.0
git push origin v1.2.0
```

### 3.5 Lauf verfolgen

```powershell
$r = Invoke-RestMethod "https://api.github.com/repos/Nechus0/rana/actions/runs?per_page=3" -Headers @{Accept="application/vnd.github+json"}
$r.workflow_runs | Select-Object display_title, status, conclusion, html_url
```

Nach etwa zwanzig Minuten liegt die Veröffentlichung bereit. Anja spielt
das Update dann **in Rana selbst** ein: Seitenschiene → Aktualisierung →
„Nach Aktualisierung suchen". Nichts wird von Hand heruntergeladen.

---

## 4 · Wenn der Lauf scheitert

Protokoll des fehlgeschlagenen Schritts holen:

```powershell
$id = (Invoke-RestMethod "https://api.github.com/repos/Nechus0/rana/actions/runs?per_page=1").workflow_runs[0].id
$jobs = Invoke-RestMethod "https://api.github.com/repos/Nechus0/rana/actions/runs/$id/jobs"
$jobs.jobs | ForEach-Object { $_.name; $_.steps | Where-Object conclusion -eq "failure" | Select-Object name, conclusion }
```

Das vollständige Protokoll steht unter der `html_url` des Laufs. Ursache
beheben, erneut schieben — und die Marke dabei **verschieben**, nicht
danebensetzen:

```powershell
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0
git tag v1.2.0
git push origin v1.2.0
```

---

## 5 · Fallstricke, die schon Zeit gekostet haben

### 5.1 Vergessene Versionsnummer — stilles Nichts

Marke `v1.2.0` gesetzt, aber die Version in den Dateien auf `1.1.0`
gelassen? Dann steht in `latest.json` die `1.1.0`, und die installierte
`1.1.0` meldet „auf dem neuesten Stand". Kein Fehler, keine Meldung,
einfach kein Update. Der häufigste Stolperstein überhaupt.

### 5.2 Der öffentliche Schlüssel

In `src-tauri\tauri.conf.json` unter `plugins.updater.pubkey`. Steht dort
der Platzhalter `HIER-DEN-OEFFENTLICHEN-SCHLUESSEL-EINSETZEN`, bricht der
Lauf nach drei Sekunden im Job „Oberfläche prüfen" ab — der Wächter ist
absichtlich dort, damit es nicht erst nach zwanzig Minuten auffällt.

Der Schlüssel ist bereits eingetragen und ändert sich nur, wenn ein neues
Schlüsselpaar erzeugt wird. **Wird er ersetzt, können bereits installierte
Fassungen keine Updates mehr annehmen** — sie prüfen gegen den alten. Dann
muss von Hand neu installiert werden.

### 5.3 Die zwei GitHub-Geheimnisse

`TAURI_SIGNING_PRIVATE_KEY` und `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
liegen unter *Settings → Secrets and variables → Actions*. Sie sind
gesetzt und nach dem Speichern nicht mehr lesbar, nur überschreibbar.

**Der private Schlüssel gehört nie ins Repository, nie in einen
Chatverlauf und nie in eine Datei im Projektordner.** Wer ihn hat, kann
ein gefälschtes Rana-Update signieren, das die Anwendung dann selbsttätig
installiert. Claude fasst ihn nicht an; wenn er neu gesetzt werden muss,
macht Anja das selbst.

### 5.4 Berechtigung im Workflow

Die Repository-Voreinstellung gibt dem `GITHUB_TOKEN` nur Leserecht. Der
`windows`-Job in `.github/workflows/build.yml` hebt das eng begrenzt auf:

```yaml
    permissions:
      contents: write
```

Fehlt dieser Block, scheitert eine Marke erst nach zwanzig Minuten
Windows-Bau am Anlegen der Veröffentlichung. **Nicht die globale
Einstellung umstellen** — der Block im Workflow ist die dokumentierte
Lösung und wandert mit dem Repository mit.

### 5.5 Zeilenenden — 44 Dateien scheinbar geändert

`core.autocrlf` steht auf `true`. `git status` zeigt deshalb regelmässig
fast jede Datei als geändert, obwohl inhaltlich nichts passiert ist. Zum
Nachprüfen:

```powershell
git diff --shortstat
```

Stehen dort viele Dateien, aber fast keine eingefügten oder gelöschten
Zeilen, ist es reines Zeilenenden-Rauschen. Die echten Änderungen findet:

```powershell
(git diff --numstat 2>$null) | Where-Object { $_ -notmatch '^0\t0\t' }
```

**Empfohlene Bereinigung** (einmalig, wenn gerade keine Veröffentlichung
läuft): eine `.gitattributes` mit `* text=auto eol=lf` anlegen, dann

```powershell
git add --renormalize .
git commit -m "Zeilenenden vereinheitlichen"
```

Das erzeugt einen grossen, aber rein technischen Commit — danach ist Ruhe.

### 5.6 cmd oder PowerShell

`$env:USERPROFILE` ist PowerShell, `%USERPROFILE%` ist cmd. In der
falschen Shell nimmt Windows die Zeichenkette wörtlich als Ordnernamen und
meldet „Die Syntax für den Dateinamen … ist falsch". Desktop Commander
startet standardmässig PowerShell; wer `shell: "cmd"` setzt, muss die
Schreibweise mitwechseln.

### 5.7 Der Zeichenkorridor hat kaum Luft

Gemessen (DOCX → PDF → Seiten gezählt, `node _test/korridor.mjs`):

| Zeichen | Seiten |
|---|---|
| bis 5.127 | 2 |
| ab 5.204 | 3 |

Die eingestellte Obergrenze ist **5.100** — also 27 Zeichen Puffer. Wer am
Prompt, an den Überschriften oder an der Absatzzahl arbeitet, muss danach
**neu messen**, nicht schätzen. Ein zusätzlicher Absatz kostet rund 80
Zeichen Platz.

### 5.8 Der Updater greift erst ab 1.1.0

Fassung 1.0.0 kennt den Updater nicht. Wer noch 1.0.0 installiert hat,
muss einmal von Hand installieren.

---

## 6 · Was beim Ändern leicht kaputtgeht

### Die drei Überschriften stehen an drei Stellen

`PROMPT_TITLES` und `ABSCHNITTE` in `src/report/render.ts`, dazu der
Überschriftenblock in `systemPrompt()` in `src/report/prompt.ts`. Laufen
sie auseinander, zerlegt `parseSections()` den Modelltext nicht mehr
richtig und der Bericht zerfällt. Die alten Fassungen stehen als
Rückfallebene daneben, damit früher gespeicherte Berichte sich unverändert
öffnen lassen — **die bitte nicht entfernen.**

### Neue Felder immer hinten anhängen

In `FELDER` (`src/core/state.ts`). Gespeicherte Fälle sind eine freie
Abbildung von Name auf Wert; `leererFall()` legt neue Schlüssel leer an.
Wird ein Feld umbenannt oder eingeschoben, verlieren ältere Fälle Daten.

### Vorschau und Word dürfen nie auseinanderlaufen

`src/report/render.ts` (Bildschirm) und `src/report/docx.ts` (OOXML)
erzeugen dasselbe Layout auf zwei Wegen. Wer eines ändert, ändert beides.
Beide benutzen dieselben Zerleger (`splitParas`, `toList`, `splitLabel`) —
das ist Absicht.

### `prompt.ts` darf nicht aus `render.ts` importieren

`render.ts` importiert bereits aus `prompt.ts`. Für das Datumsformat gibt
es deshalb einen kleinen eigenen Helfer in `prompt.ts`.

### Der Word-Export nutzt kein Fremdpaket

Das OOXML ist von Hand gebaut und gegen echte Word-Dateien geprüft. Eine
Bibliothek, die beim nächsten Versionssprung anders setzt, würde genau das
zerstören. Bitte so lassen.

---

## 7 · Was noch offen ist

- **Erstantrag PTV 3** — andere Gliederung, im Profil vorgesehen.
- **Diktat** für die Verlaufsnotizen in Schritt 3.
- **Bildschirmsperre** nach Untätigkeit. Ein unbeaufsichtigter,
  entsperrter Rechner ist die grösste verbliebene Lücke.
- **Windows-Codesignatur** — kostet rund 300 € im Jahr. Erst nötig, wenn
  Rana an Kolleg:innen weitergegeben werden soll. Bis dahin warnt
  SmartScreen bei jeder Installation.
- **`.gitattributes`** gegen das Zeilenenden-Rauschen (5.5).

---

## 8 · Ton

Anja ist Ärztin, keine Entwicklerin, aber sie liest genau und will wissen,
warum etwas so ist. Was hilft:

- Messen statt schätzen. Seitenzahlen werden gezählt, nicht vermutet.
- Kompromisse benennen, statt sie zu verschweigen.
- Kurze Antworten. Sie fragt nach, wenn sie mehr will.
- Deutsche Fachbegriffe, wo es welche gibt.

---

## 9 · Beobachtung aus der ersten Veröffentlichung (v1.1.0)

Der Lauf zu `v1.1.0` ist am 26. August 2026 vollständig durchgelaufen.
Die Veröffentlichung enthält `latest.json`, `Rana_1.1.0_x64-setup.exe`
(NSIS, 3,5 MB), `Rana_1.1.0_x64_de-DE.msi` (4,4 MB) und die beiden
Signaturdateien.

**Wert zum Nachhalten:** In `latest.json` zeigt der Eintrag
`windows-x86_64` auf die **MSI**, nicht auf die NSIS-Datei — das ist die
Vorgabe von Tauri. Installiert wurde Rana aber über NSIS im Modus
`currentUser`, also ohne Administratorrechte.

Damit ist offen, ob die MSI beim Update eine UAC-Abfrage auslöst. Das
lässt sich erst beim **ersten echten Update** beobachten. Sollte eine
Administratorabfrage kommen, ist die Abhilfe, den Updater ausdrücklich auf
NSIS zu lenken — in `src/views/settings.ts` beim Aufruf:

```ts
const gefunden = await check({ target: "windows-x86_64-nsis" });
```

Bitte beim ersten Update darauf achten und diesen Abschnitt danach mit dem
Ergebnis ergänzen, statt es beim nächsten Mal wieder herausfinden zu
müssen.

### 5.9 PowerShell schreibt ein BOM — und JSON.parse stirbt daran

`Set-Content -Encoding UTF8` schreibt in Windows PowerShell 5.1 ein
**Byte Order Mark** an den Dateianfang. Bei `.ts` und `.css` fällt das
nicht auf, bei `package.json` und `tauri.conf.json` schon:

```
[vite:css] Failed to load PostCSS config:
[SyntaxError] Unexpected token '﻿', "﻿{ "name"... is not valid JSON
```

Die Meldung nennt dabei eine **CSS-Datei** als Ort, obwohl das kaputte
JSON die Ursache ist — das führt zuverlässig auf die falsche Fährte.

**Konfigurationsdateien nie mit PowerShell schreiben.** Node nehmen:

```js
import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(pfad, inhalt, "utf8");   // schreibt kein BOM
```

Zum Aufräumen, falls es doch passiert ist:

```js
const b = readFileSync(f);
if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) writeFileSync(f, b.slice(3));
```

Ebenso gilt: **Regex-haltige Node-Einzeiler nicht über `node -e` in
PowerShell** — die Anführungszeichen werden zerlegt. Skript in eine
`.mjs`-Datei schreiben und die aufrufen.

### 5.10 Lokal bauen geht auf diesem Rechner nicht

`npm run tauri build` bricht mit `linker 'link.exe' not found` ab. Die
Visual-Studio-Buildwerkzeuge sind nicht installiert, weil bewusst der
GitHub-Weg gewählt wurde. Der lokale Bau ist also **keine** Kontrolle
vor dem Schieben; es bleiben `npx tsc --noEmit` und `npx vite build`.
Rust-Änderungen fallen damit erst in der CI auf — bei grösseren
Eingriffen ins Rust-Backend entsprechend vorsichtig sein.

### 5.11 NODE_ENV=production auf diesem Rechner

In der Windows-Umgebung steht `NODE_ENV=production`. npm leitet daraus
`omit=dev` ab und **überspringt die Entwicklungsabhängigkeiten** —
TypeScript, Vite und die Tauri-CLI fehlen dann in `node_modules`, und
`npm install` meldet trotzdem zufrieden „up to date".

Erkennbar daran, dass `npx tsc` plötzlich das fremde Paket `tsc@2.0.4`
nachladen will. Abhilfe bei jedem Installieren:

```powershell
npm ci --include=dev
```

Auf GitHub ist die Variable nicht gesetzt — deshalb baut CI klaglos
weiter, während es lokal scheitert. Wer das dauerhaft beheben will,
entfernt die Benutzervariable in den Windows-Systemeinstellungen.

### 5.12 Zeilenenden brechen jede Textersetzung

Die Arbeitskopie hat CRLF (`core.autocrlf=true`), Suchtexte in Node- oder
Python-Skripten haben LF. `includes()` findet dann nichts, und der Patch
meldet „FEHLT", obwohl die Stelle dasteht. Beim Einlesen vereinheitlichen:

```js
const rd = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
```

Dasselbe blockiert auch `git merge` und `git checkout --` an einzelnen
Dateien. Wenn nichts hilft und keine eigene Arbeit im Baum liegt:
`git reset --hard origin/main`.

### 5.13 Backticks in Patch-Skripten

Ein Backtick in einem Kommentar **innerhalb** eines Template-Literals
schliesst das Literal. Führt zu `SyntaxError: missing ) after argument
list` an einer Stelle, die harmlos aussieht. In eingebetteten
CSS- oder Code-Kommentaren keine Backticks verwenden.

---

## 10 · Stand der Fassung 1.2.0

**Behoben**

- **Suchfilter.** Ging bei jedem Tastendruck nach Rust und liess dort
  jeden Fall entschlüsseln. Bei schnellem Tippen kamen die Antworten in
  falscher Reihenfolge zurück; bei fünfzig Patientinnen waren es fünfzig
  Entschlüsselungen je Anschlag. Jetzt einmal laden, im Fenster filtern.
- **Ereignisse** hängen am Behälter statt an jedem Listeneintrag.
- **`localStorage`** wurde beim Laden des Moduls gelesen und brach damit
  die Abnahmeprüfungen in Node. Jetzt gekapselt.
- **Version** stand in README und `Cargo.lock` noch auf 1.1.1, während
  die übrigen Stellen 1.1.3 sagten.

**Neu**

- Zeichenzähler nennen den erwarteten Umfang je Feld, mit Füllbalken.
  Die Werte stehen in `ZIELUMFANG` (`src/core/state.ts`) und sind aus
  den Abschnittsbudgets hergeleitet — bewusst rund ein Drittel über dem,
  was im Bericht landet: ein Modell kann kürzen, aber nichts erfinden.
- **Folgeantrag aus diesem Fall** (Schritt 1). Übernimmt Stammdaten,
  Ausgangslage und Psychodynamik, zählt die laufende Nummer hoch,
  erhöht das bewilligte Kontingent um die zuletzt beantragten Stunden,
  legt den alten Bericht als Vorbericht ab und zieht dessen Diagnose und
  Behandlungsziele in die Vorgeschichte.
- Einstellungen in acht Bereichen mit seitlichem Verzeichnis.
- Verbrauch am unteren Rand der rechten Spalte.
- Offene Pflichtangaben färben den Ring des Schrittknotens statt eines
  schwebenden gelben Punkts.
- Ausserhalb des gedruckten Berichts steht keine Schriftgrösse mehr als
  feste Zahl im Code.

**Offen: das Datenmodell**

Der Zweig **`2.0-datenmodell`** trägt die Grundlage für „ein Bericht
gehört zu einer Patientin":

- `patients`-Tabelle und Spalte `cases.patient_id` — additiv angelegt,
  vorhandene Daten bleiben lesbar.
- `src-tauri/src/patients.rs` mit der Aufteilung der Felder und der
  Namenserkennung für den Zusammenführungs-Vorschlag. Acht Prüfungen
  bestehen, darunter mit den echten Namen aus dem Bestand: gedrehte
  Schreibweise fällt zusammen, „Berg" und „Bergmann" bleiben getrennt.
- **Noch nicht in `lib.rs` eingebunden**, also ohne Wirkung.

Was dort fehlt: die Befehle in `lib.rs`, der Dialog für den
Zusammenführungs-Vorschlag, die zweistufige Navigation. Anja hat
entschieden, dass der Vorschlag ihr vorgelegt wird und sie abhakt —
**nichts wird ohne Bestätigung verschmolzen**.

Der Folgeantrag aus 1.2.0 nimmt einen guten Teil des Nutzens vorweg:
er verhindert, dass beim nächsten Antrag ein zweiter Eintrag mit
denselben Stammdaten entsteht.

---

## 11 · Stand der Fassung 2.0.0

### Was 2.0 gebracht hat

**Das Datenmodell.** Berichte hängen an einer Patientin. Neue Datei
`src-tauri/src/patients.rs`, neue Tabelle `patients`, neues Feld
`Case.patient_id`.

Die Zugehörigkeit steht **im verschlüsselten Block**, nicht in einer
eigenen Spalte. Eine Zwischenfassung hatte eine Klartextspalte
`patient_id` angelegt; sie wird nicht mehr beschrieben, bleibt in
vorhandenen Datenbanken aber stehen — ein Umbau der Tabelle wäre ein
Risiko ohne Gegenwert. Begründung für die Verschlüsselung: die Kennung
selbst verrät nichts, ihre Wiederholung über mehrere Zeilen aber sehr
wohl, nämlich welche Berichte dieselbe Person betreffen.

**Wo die Zuordnung entsteht:** in `save_case`, nicht beim Anlegen.
`lib.rs` leitet `get_case` und `save_case` durch
`patients::bericht_lesen` und `patients::bericht_speichern`. Deshalb
kann ein zweiter Eintrag zur selben Person gar nicht erst entstehen,
und deshalb merkt die Oberfläche von der Trennung fast nichts.

**Der Bericht behält alle Felder,** auch die gemeinsamen. Die Patientin
ist die massgebliche Quelle, nicht die einzige — ein Bericht bleibt für
sich lesbar, auch wenn die Patientin später entfernt wird.

### 11.1 Rust lässt sich auf diesem Rechner nicht übersetzen

`cargo check` bricht mit `linker link.exe not found` ab: die
MSVC-Buildwerkzeuge fehlen. Rust ist installiert, der Linker nicht.

**Der Ausweg, der wirklich Zeit spart:** ein Prüfstand in der
Linux-Umgebung. Er bindet `error.rs`, `store.rs` und `patients.rs`
unverändert ein und ersetzt nur, was Windows braucht:

```
/tmp/pruef/
├─ Cargo.toml          echte Abhängigkeiten: rusqlite, aes-gcm, uuid …
├─ src/secrets.rs      Ersatz: ensure_db_key() gibt [7u8; 32]
├─ stub-tauri/         AppHandle, Manager, app_data_dir()
├─ stub-keyring/       Error::NoEntry
└─ stub-reqwest/       Error mit is_timeout/is_connect
```

Die drei Ersatzpakete sind Pfadabhängigkeiten mit den Namen `tauri`,
`keyring` und `reqwest` — dann greifen die `use`-Zeilen im echten Code
unverändert. Aus zwanzig Minuten Bauserver werden zwei Sekunden.

Die Prüfungen selbst stehen inzwischen **im Repository**, in
`patients.rs` unter `mod datenmodell`, und laufen auf dem Bauserver
mit. Möglich macht das `Store::open_fuer_test`, ein `#[cfg(test)]`-
Einstieg mit festem Schlüssel; im ausgelieferten Programm existiert er
nicht.

### 5.14 Schreibrecht wird auch im Repository eingestellt

Der Lauf zur Marke v1.2.0 scheiterte, der Lauf auf `main` mit
demselben Commit nicht. Die letzte Zeile im Protokoll war:

```
Couldn't find release with tag v1.2.0. Creating one.
```

Der Bau war also fehlerfrei, beide Installer lagen fertig und signiert
vor — es scheiterte erst am **Anlegen der Veröffentlichung**.

`permissions: contents: write` stand im Workflow (§5.4) und war
gegenüber v1.1.3 unverändert. Der Grund lag woanders:

> Settings → Actions → General → **Workflow permissions**

stand auf *Read repository contents and packages permissions*. Diese
Repository-Einstellung sticht die Angabe im Workflow. Nachdem sie auf
*Read and write permissions* umgestellt war, lief dieselbe Marke ohne
Änderung am Code durch.

**Erkennungsmerkmal:** `main` grün, Marke rot, und das Protokoll endet
bei „Creating one." Dann ist es diese Einstellung und nichts anderes.

**Das Protokoll bekommt man ohne Anmeldung nicht** — die API gibt nur
die Anmerkungen heraus, und die sagen bloss „Process completed with
exit code 1":

```powershell
Invoke-RestMethod "https://api.github.com/repos/Nechus0/rana/check-runs/<JOB-ID>/annotations"
```

Schneller ist, die Nutzerin um die letzten Protokollzeilen zu bitten.

### 5.15 Die Selbstaktualisierung zog die MSI

`latest.json` führt drei Ziele: `windows-x86_64`, `-msi` und `-nsis`.
Das Standardziel zeigt auf die **MSI**, und die installiert für alle
Benutzer — also Rückfrage der Benutzerkontensteuerung bei jedem Update.
Der NSIS-Installer läuft im Benutzerprofil und kommt ohne aus.

Behoben in `views/settings.ts`:

```ts
const gefunden = await check({ target: "windows-x86_64-nsis" });
```

### 5.16 Eine Abfrage beim Start hatte sich eingeschlichen

In `main.ts` stand ein `check()` beim Programmstart. Das README sagt zu,
dass Rana von sich aus nichts ins Netz schickt. Entfernt; die Prüfung
läuft nur noch über Einstellungen → Aktualisierung.

### 5.17 Eingabefelder in einem Etikett erben dessen Schriftbild

Das ICD-10-Suchfeld sass im `<label>` des Textfeldes. Etiketten sind
in Rana `text-transform: uppercase` mit Sperrung — das Suchfeld hat das
geerbt und sah nach Fehler aus. Es steht jetzt in einer eigenen Zeile
(`.icd10-zeile`) mit ausdrücklich gesetztem Schriftbild.

**Regel:** kein Bedienelement in ein `<label>` setzen, das eine
Schriftverwandlung trägt.

### 5.18 Die Seitenvorschau hatte kein Blatt

Schritt 5 setzte das Dokument direkt in `.paper-tray`, ohne
`.paper-sheet`. Dadurch fehlten die Ränder und es sah nicht wie eine
Seite aus. Jetzt liegt es auf `.paper-sheet.paper-doc` mit 595pt Breite
und 62pt Rand — das sind genau die 11906 und 1247 Twips aus dem
`sectPr` in `report/docx.ts`. **Ändert sich dort der Rand, muss er hier
mitgeändert werden.**

### 11.2 Versionsnummer: fünf Stellen, nicht vier

`bump.mjs` im Wurzelverzeichnis erledigt alle auf einmal:

```powershell
node bump.mjs 2.0.0 2.1.0
```

Es fasst `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `README.md` und **`src-tauri/Cargo.lock`**
an. Die Sperrdatei wurde schon einmal vergessen; der Bauserver meldet
das erst nach zwanzig Minuten.

### 11.3 Der Arbeitsklon

`C:\Users\AnjaR\rana-arbeit` — angelegt, weil im Ordner
`Desktop\Claude Berichte\…` ein Abgleichdienst mitschreibt. Dort
tauchen Dateien unmittelbar nach `git reset --hard` wieder als geändert
auf, und `git merge` scheitert reihenweise. **Nicht im Desktop-Ordner
arbeiten.**

`git config core.autocrlf false` ist dort gesetzt (§5.5).
