use std::collections::HashMap;

use super::super::types::PriorityWeightUpsertInput;

pub type SheetRows = Vec<(usize, HashMap<String, String>)>;

pub fn calamine_cell_to_string(cell: &calamine::Data) -> String {
    match cell {
        calamine::Data::Empty => String::new(),
        calamine::Data::String(v) => v.clone(),
        calamine::Data::Bool(v) => {
            if *v {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        _ => cell.to_string(),
    }
}

pub fn read_priority_sheet_rows(
    range: &calamine::Range<calamine::Data>,
) -> Vec<(usize, HashMap<String, String>)> {
    let rows: Vec<Vec<String>> = range
        .rows()
        .map(|row| row.iter().map(calamine_cell_to_string).collect())
        .collect();

    if rows.is_empty() {
        return Vec::new();
    }

    let headers: Vec<String> = rows[0]
        .iter()
        .map(|h| h.trim().to_ascii_lowercase())
        .collect();

    let mut result = Vec::new();
    for (idx, row) in rows.iter().enumerate().skip(1) {
        let mut map = HashMap::new();
        let mut non_empty = false;
        for (col_idx, header) in headers.iter().enumerate() {
            let value = row.get(col_idx).cloned().unwrap_or_default();
            if !value.trim().is_empty() {
                non_empty = true;
            }
            map.insert(header.clone(), value);
        }
        if non_empty {
            result.push((idx + 1, map));
        }
    }
    result
}

pub fn validate_weight_inputs(inputs: &[PriorityWeightUpsertInput]) -> Vec<String> {
    let mut warnings = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in inputs {
        let key = item.dimension_type.to_ascii_lowercase();
        if !seen.insert(key) {
            warnings.push(format!(
                "weight 存在重复 dimension_type,后值会覆盖前值: {}",
                item.dimension_type
            ));
        }
    }
    warnings
}
