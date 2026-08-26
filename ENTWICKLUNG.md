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
