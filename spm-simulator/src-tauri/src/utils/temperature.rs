use chrono::{DateTime, Datelike, Utc};

use super::season::get_season_threshold;

/// Calculate temperature status for a material based on coiling time
/// Returns (status: "ready"|"waiting", wait_days: i32)
pub fn calculate_temp_status(coiling_time: &DateTime<Utc>) -> (String, i32) {
    let now = Utc::now();
    let duration = now.signed_duration_since(*coiling_time);
    let wait_days = duration.num_days() as i32;

    let current_month = now.month();
    let threshold = get_season_threshold(current_month);

    let status = if wait_days >= threshold {
        "ready".to_string()
    } else {
        "waiting".to_string()
    };

    (status, wait_days)
}
