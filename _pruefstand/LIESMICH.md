# Prüfstand für den Rust-Teil

Auf Anjas Rechner fehlt der MSVC-Linker; `cargo check` in `src-tauri`
bricht mit `linker link.exe not found` ab. Der Bauserver braucht für
dieselbe Auskunft rund zwanzig Minuten.

Dieser Ordner ist der Ausweg: eine kleine Kiste, die **die echten
Quelldateien** aus `../src-tauri/src` einbindet und nur das ersetzt,
was Windows braucht — den Tresor, `tauri`, `keyring`, `reqwest`.
Ergebnis: zwei Sekunden statt zwanzig Minuten.

## Benutzen

```bash
./kopieren.sh    # holt die echten Dateien herüber
cargo test
```

Das Skript ist für eine Linux- oder WSL-Umgebung gedacht. Rust wird
dort gegebenenfalls erst installiert:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
. "$HOME/.cargo/env"
```

## Was hier geprüft wird

`tests/sicherung.rs` — die Sicherung mit Patientinnen. Sie steht hier
und nicht im Repository-Testlauf, weil `write_backup` den
Datenbankschlüssel aus dem Windows-Tresor holt; auf dem Bauserver gibt
es den nicht.

Die Prüfungen zum Datenmodell selbst liegen im Repository, in
`src-tauri/src/patients.rs` unter `mod datenmodell`, und laufen bei
jedem Bau mit.

## Was hier NICHT geprüft wird

`lib.rs` und `claude.rs` fehlen — die erste braucht die Makros von
Tauri, die zweite ein echtes `reqwest`.

**Das hat schon einmal Zeit gekostet:** Als `Case` das Feld
`patient_id` bekam, brach ein Struktur-Literal in `lib.rs`
(`import_legacy`). Der Prüfstand war grün, der Bauserver rot.

> **Regel:** Wer ein Feld zu `Case` oder `Patient` hinzufügt, sucht
> anschliessend im **ganzen** Ordner `src-tauri/src` nach
> `Case {` und `Patient {` — einschliesslich `lib.rs`.
