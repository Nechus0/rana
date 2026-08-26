#!/bin/sh
# Holt die echten Quelldateien in den Pruefstand.
#
# Bewusst kopieren statt verlinken: so ist immer sichtbar, welcher
# Stand geprueft wurde, und ein halb gespeicherter Zustand im Editor
# reisst den Lauf nicht mit.
set -e
cd "$(dirname "$0")"

for f in error.rs store.rs patients.rs backup.rs budget.rs settings.rs; do
  cp "../src-tauri/src/$f" "src/$f"
  echo "  $f"
done

echo
echo "secrets.rs und lib.rs bleiben - das sind die Ersatzstuecke."
