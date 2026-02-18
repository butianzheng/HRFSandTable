/// Get the temperature threshold (days) for a given month
/// Spring (3,4,5) and Winter (12,1,2): 3 days
/// Summer (6,7,8) and Autumn (9,10,11): 4 days
pub fn get_season_threshold(month: u32) -> i32 {
    match month {
        3..=5 => 3,      // Spring
        6..=8 => 4,      // Summer
        9..=11 => 4,     // Autumn
        12 | 1 | 2 => 3, // Winter
        _ => 3,          // Default
    }
}

pub fn get_season_name(month: u32) -> &'static str {
    match month {
        3..=5 => "spring",
        6..=8 => "summer",
        9..=11 => "autumn",
        12 | 1 | 2 => "winter",
        _ => "unknown",
    }
}
