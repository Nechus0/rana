//! Der Kostenwächter.
//!
//! Er sitzt bewusst in Rust und nicht in der Oberfläche. Das Frontend
//! kann eine Warnung anzeigen oder verschweigen — verhindern kann es
//! den Stopp nicht, weil jeder Aufruf hier vorbeimuss.
//!
//! Drei Grenzen greifen ineinander:
//!
//!   1. Monatsbudget in Euro. Bei 70 % ein Hinweis, bei 90 % eine
//!      Warnung, bei 100 % wird nicht mehr gesendet.
//!   2. Tageslimit an Berichten. Es zielt nicht auf das Geld, sondern
//!      auf den Fall, dass ein Programmfehler in einer Schleife sendet.
//!   3. Eine feste Obergrenze an Ausgabemarken je Aufruf (in claude.rs).
//!      Damit ist der teuerste denkbare Einzelaufruf nach oben begrenzt,
//!      egal was sonst schiefgeht.
//!
//! Die Grenze in der Anthropic-Console ersetzt das alles nicht — sie
//! ist die einzige, die auch bei verlorenem Schlüssel noch greift.
//! Der Einrichtungsassistent führt deshalb ausdrücklich dorthin.

use crate::error::{RanaError, Result};
use crate::store::Store;
use serde::{Deserialize, Serialize};

/// Preise je Million Marken, in US-Dollar. Stand August 2026.
/// Ändern sich die Preise, ist dies die einzige Stelle.
pub struct Price {
    pub input: f64,
    pub cached_read: f64,
    pub output: f64,
}

pub fn price_for(model: &str) -> Price {
    match model {
        // Zwischengespeicherte Eingabe kostet ein Zehntel der normalen.
        // Genau davon lebt der Aufbau in claude.rs: der grosse,
        // unveränderliche Regelteil wird nur einmal voll berechnet.
        "claude-opus-5" => Price { input: 5.0, cached_read: 0.50, output: 25.0 },
        "claude-sonnet-5" => Price { input: 3.0, cached_read: 0.30, output: 15.0 },
        "claude-haiku-4-5-20251001" => Price { input: 1.0, cached_read: 0.10, output: 5.0 },
        // Unbekanntes Modell: mit dem teuersten rechnen. Lieber zu früh
        // bremsen als zu spät.
        _ => Price { input: 5.0, cached_read: 0.50, output: 25.0 },
    }
}

/// Umrechnung Dollar → Euro. Ein fester, konservativ gewählter Kurs.
/// Er soll nicht die Buchhaltung ersetzen, sondern die Grenze zuverlässig
/// auslösen; deshalb ist er absichtlich eher hoch angesetzt.
pub const USD_TO_EUR: f64 = 0.95;

pub fn cost_eur(model: &str, input: u64, cached: u64, output: u64) -> f64 {
    let p = price_for(model);
    // `input` meldet Anthropic ohne die zwischengespeicherten Marken,
    // deshalb werden beide getrennt gerechnet.
    let usd = (input as f64 / 1_000_000.0) * p.input
        + (cached as f64 / 1_000_000.0) * p.cached_read
        + (output as f64 / 1_000_000.0) * p.output;
    usd * USD_TO_EUR
}

// ---------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BudgetSettings {
    /// Monatsbudget in Euro.
    pub monthly_eur: f64,
    /// Höchstzahl formulierter Berichte je Tag.
    pub daily_reports: u32,
}

impl Default for BudgetSettings {
    fn default() -> Self {
        // Bei einem Bericht am Tag liegt der tatsächliche Verbrauch bei
        // rund 1,60 € im Monat. Zehn Euro sind deshalb keine Einschränkung,
        // sondern eine Reissleine.
        BudgetSettings { monthly_eur: 10.0, daily_reports: 5 }
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct BudgetState {
    pub month_spent_eur: f64,
    pub month_limit_eur: f64,
    pub month_pct: f64,
    pub today_reports: u32,
    pub daily_limit: u32,
    /// "ok" · "hinweis" (ab 70 %) · "warnung" (ab 90 %) · "gestoppt"
    pub level: &'static str,
    pub may_send: bool,
    /// Was ein weiterer Bericht ungefähr kosten wird.
    pub estimate_eur: f64,
}

/// Geschätzte Kosten eines Berichts: rund 2.400 Marken hinein,
/// rund 1.800 hinaus. Aus gemessenen Läufen des Vorgängers.
pub fn estimate_report_eur(model: &str) -> f64 {
    cost_eur(model, 2_400, 0, 1_800)
}

fn month_start_ms() -> i64 {
    use chrono::{Datelike, TimeZone, Utc};
    let now = Utc::now();
    Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
        .single()
        .map(|d| d.timestamp_millis())
        .unwrap_or(0)
}

fn day_start_ms() -> i64 {
    use chrono::{Timelike, Utc};
    let now = Utc::now();
    now.timestamp_millis()
        - (now.hour() as i64 * 3_600_000
            + now.minute() as i64 * 60_000
            + now.second() as i64 * 1_000)
}

pub fn state(store: &Store, settings: &BudgetSettings, model: &str) -> Result<BudgetState> {
    let spent = store.spend_since(month_start_ms())?;
    let today = store.calls_since(day_start_ms())?;
    let limit = settings.monthly_eur.max(0.0);
    let pct = if limit > 0.0 { (spent / limit) * 100.0 } else { 0.0 };

    let over_month = limit > 0.0 && spent >= limit;
    let over_day = settings.daily_reports > 0 && today >= settings.daily_reports;

    let level = if over_month || over_day {
        "gestoppt"
    } else if pct >= 90.0 {
        "warnung"
    } else if pct >= 70.0 {
        "hinweis"
    } else {
        "ok"
    };

    Ok(BudgetState {
        month_spent_eur: spent,
        month_limit_eur: limit,
        month_pct: pct.min(999.0),
        today_reports: today,
        daily_limit: settings.daily_reports,
        level,
        may_send: !over_month && !over_day,
        estimate_eur: estimate_report_eur(model),
    })
}

/// Wird vor jedem Aufruf ausgeführt. Gibt es hier einen Fehler,
/// unterbleibt der Netzzugriff vollständig — es entstehen keine Kosten.
pub fn guard(store: &Store, settings: &BudgetSettings, model: &str) -> Result<()> {
    let s = state(store, settings, model)?;

    if settings.daily_reports > 0 && s.today_reports >= settings.daily_reports {
        return Err(RanaError::DailyLimit { limit: settings.daily_reports });
    }
    if s.month_limit_eur > 0.0 && s.month_spent_eur >= s.month_limit_eur {
        return Err(RanaError::BudgetExhausted {
            used: s.month_spent_eur,
            limit: s.month_limit_eur,
        });
    }
    // Auch der Fall, dass ein einzelner Aufruf über die Grenze tragen
    // würde, wird abgefangen — sonst reisst der letzte Bericht des
    // Monats das Budget.
    if s.month_limit_eur > 0.0 && s.month_spent_eur + s.estimate_eur > s.month_limit_eur {
        return Err(RanaError::BudgetExhausted {
            used: s.month_spent_eur,
            limit: s.month_limit_eur,
        });
    }
    Ok(())
}
