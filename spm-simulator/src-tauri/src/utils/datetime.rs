use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

/// 午夜零点常量，用于日期转日期时间的默认时间部分
pub const MIDNIGHT: NaiveTime = match NaiveTime::from_hms_opt(0, 0, 0) {
    Some(t) => t,
    None => unreachable!(),
};

/// 默认白班起始时间 08:00
pub const DEFAULT_SHIFT_START: NaiveTime = match NaiveTime::from_hms_opt(8, 0, 0) {
    Some(t) => t,
    None => unreachable!(),
};

/// Parse various date format strings into NaiveDateTime
pub fn parse_datetime(s: &str) -> Option<NaiveDateTime> {
    // Try common formats
    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y%m%d%H%M%S",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y%m%d",
    ];

    for fmt in &formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(dt);
        }
    }

    // Try date-only formats
    let date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"];
    for fmt in &date_formats {
        if let Ok(d) = NaiveDate::parse_from_str(s, fmt) {
            return Some(d.and_time(MIDNIGHT));
        }
    }

    None
}
