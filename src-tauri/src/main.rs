// Windows: kein Konsolenfenster hinter der Anwendung.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rana_lib::run()
}
