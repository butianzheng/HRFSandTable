/**
 * 导出模板相关的工具函数和常量
 */

export interface ExportTemplateFormValues {
  name: string;
  description?: string;
  columns: string;
  column_items?: ExportColumnItem[];
  format_rules?: string;
  format_rule_items?: FormatRuleItem[];
  is_default?: boolean;
}

export interface ExportColumnItem {
  key?: string;
  title?: string;
  enabled?: boolean;
}

export interface FormatRuleItem {
  field?: string;
  digits?: number;
  prefix?: string;
  suffix?: string;
  empty_text?: string;
  true_text?: string;
  false_text?: string;
  date_format?: string;
  uppercase?: boolean;
  lowercase?: boolean;
}

export const exportFieldLabelMap: Record<string, string> = {
  sequence: '序号',
  coil_id: '钢卷号',
  steel_grade: '钢种',
  thickness: '厚度(mm)',
  width: '宽度(mm)',
  weight: '重量(t)',
  shift_date: '班次日期',
  shift_no: '班次',
  shift_type: '班型',
  planned_start: '计划开始',
  planned_end: '计划结束',
  cumulative_weight: '累计重量(t)',
  is_roll_change: '换辊',
  is_locked: '锁定',
  risk_flags: '风险标记',
  contract_no: '合同号',
  customer_name: '客户',
  hardness_level: '硬度等级',
  surface_level: '表面等级',
  product_type: '产品大类',
  due_date: '交期',
  temp_status: '适温状态',
  remarks: '备注',
};

export const allExportFieldOptions = Object.entries(exportFieldLabelMap).map(([value, label]) => ({
  value,
  label,
}));

export function parseColumnItems(raw?: string): ExportColumnItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: ExportColumnItem[] = [];
    const seen = new Set<string>();

    for (const item of parsed) {
      if (typeof item === 'string') {
        const key = item.trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push({
          key,
          title: exportFieldLabelMap[key] || key,
          enabled: true,
        });
        continue;
      }

      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const rawKey = row.key || row.field || row.name;
        const rawTitle = row.title || row.label;
        const key = typeof rawKey === 'string' ? rawKey.trim() : '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push({
          key,
          title:
            typeof rawTitle === 'string' && rawTitle.trim()
              ? rawTitle.trim()
              : exportFieldLabelMap[key] || key,
          enabled: true,
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

export function buildColumnsJson(items?: ExportColumnItem[]): string | undefined {
  if (!Array.isArray(items)) return undefined;

  const result: Array<string | { key: string; title: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.enabled === false) continue;
    const key = item.key?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const title = item.title?.trim();
    const defaultTitle = exportFieldLabelMap[key] || key;
    if (title && title !== defaultTitle && title !== key) {
      result.push({ key, title });
    } else {
      result.push(key);
    }
  }

  if (result.length === 0) return undefined;
  return JSON.stringify(result, null, 2);
}

export function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return Array.from(duplicates);
}

export function parseColumnKeysFromColumnsConfig(raw?: string): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: string[] = [];
    const seen = new Set<string>();

    for (const item of parsed) {
      let key = '';
      if (typeof item === 'string') {
        key = item.trim();
      } else if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const rawKey = row.key || row.field || row.name;
        key = typeof rawKey === 'string' ? rawKey.trim() : '';
      }

      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }

    return result;
  } catch {
    return [];
  }
}

export function parseTemplateColumnOptions(raw?: string) {
  if (!raw) return [] as Array<{ value: string; label: string }>;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: Array<{ value: string; label: string }> = [];

    for (const item of parsed) {
      let key = '';
      let title = '';
      if (typeof item === 'string') {
        key = item.trim();
      } else if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const rawKey = row.key || row.field || row.name;
        const rawTitle = row.title || row.label;
        key = typeof rawKey === 'string' ? rawKey.trim() : '';
        title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
      }

      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push({
        value: key,
        label: title || exportFieldLabelMap[key] || key,
      });
    }

    return result;
  } catch {
    return [];
  }
}

export function parseTemplateColumnOptionsFromItems(items?: ExportColumnItem[]) {
  if (!Array.isArray(items)) return [] as Array<{ value: string; label: string }>;
  const result: Array<{ value: string; label: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.enabled === false) continue;
    const key = item.key?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      value: key,
      label: item.title?.trim() || exportFieldLabelMap[key] || key,
    });
  }
  return result;
}

export function parseFormatRuleItems(raw?: string): FormatRuleItem[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed as Record<string, unknown>).map(([field, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { field };
      }
      const row = value as Record<string, unknown>;
      return {
        field,
        digits:
          typeof row.digits === 'number'
            ? row.digits
            : typeof row.precision === 'number'
              ? row.precision
              : undefined,
        prefix: typeof row.prefix === 'string' ? row.prefix : undefined,
        suffix: typeof row.suffix === 'string' ? row.suffix : undefined,
        empty_text:
          typeof row.empty_text === 'string'
            ? row.empty_text
            : typeof row.empty === 'string'
              ? row.empty
              : undefined,
        true_text:
          typeof row.true_text === 'string'
            ? row.true_text
            : typeof row.true === 'string'
              ? row.true
              : undefined,
        false_text:
          typeof row.false_text === 'string'
            ? row.false_text
            : typeof row.false === 'string'
              ? row.false
              : undefined,
        date_format:
          typeof row.date_format === 'string'
            ? row.date_format
            : typeof row.format === 'string'
              ? row.format
              : undefined,
        uppercase: row.uppercase === true,
        lowercase: row.lowercase === true,
      };
    });
  } catch {
    return [];
  }
}

export function buildFormatRulesJson(items?: FormatRuleItem[]): string | undefined {
  const obj = buildFormatRulesObject(items);
  if (Object.keys(obj).length === 0) return undefined;
  return JSON.stringify(obj, null, 2);
}

function buildFormatRulesObject(items?: FormatRuleItem[]): Record<string, Record<string, unknown>> {
  if (!Array.isArray(items)) return {};
  const result: Record<string, Record<string, unknown>> = {};
  const seen = new Set<string>();

  for (const item of items) {
    const field = item.field?.trim();
    if (!field || seen.has(field)) continue;

    const rule: Record<string, unknown> = {};
    if (typeof item.digits === 'number' && Number.isFinite(item.digits)) {
      rule.digits = item.digits;
    }
    if (item.prefix?.trim()) rule.prefix = item.prefix.trim();
    if (item.suffix?.trim()) rule.suffix = item.suffix.trim();
    if (item.empty_text?.trim()) rule.empty_text = item.empty_text.trim();
    if (item.true_text?.trim()) rule.true_text = item.true_text.trim();
    if (item.false_text?.trim()) rule.false_text = item.false_text.trim();
    if (item.date_format?.trim()) rule.date_format = item.date_format.trim();
    if (item.uppercase) rule.uppercase = true;
    if (item.lowercase) rule.lowercase = true;

    if (Object.keys(rule).length === 0) continue;
    result[field] = rule;
    seen.add(field);
  }

  return result;
}
