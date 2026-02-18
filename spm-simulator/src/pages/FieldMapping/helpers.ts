import type { FieldMappingItem, ValueTransformRule } from '../../types/fieldMapping';

export function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[\s_\-()（）]/g, '');
}

export function getSeasonThreshold(month: number): number {
  if (month >= 3 && month <= 5) return 3;
  if (month >= 6 && month <= 8) return 4;
  if (month >= 9 && month <= 11) return 4;
  return 3;
}

export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const baseUtc = Date.UTC(1899, 11, 30);
  const days = Math.trunc(serial);
  const fractional = serial - days;
  const millis = days * 24 * 60 * 60 * 1000 + Math.round(fractional * 24 * 60 * 60 * 1000);
  return new Date(baseUtc + millis);
}

export function parsePreviewDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 1 && numeric < 200000) {
    return excelSerialToDate(numeric);
  }

  const nativeParsed = new Date(value);
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  const compact = value.replace(/[-/:\sT]/g, '');
  if (/^\d{14}$/.test(compact)) {
    const y = Number(compact.slice(0, 4));
    const m = Number(compact.slice(4, 6));
    const d = Number(compact.slice(6, 8));
    const hh = Number(compact.slice(8, 10));
    const mm = Number(compact.slice(10, 12));
    const ss = Number(compact.slice(12, 14));
    return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  }

  if (/^\d{8}$/.test(compact)) {
    const y = Number(compact.slice(0, 4));
    const m = Number(compact.slice(4, 6));
    const d = Number(compact.slice(6, 8));
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }

  return null;
}

export function classifyImportErrorMessage(messageText: string): string {
  if (messageText.includes('缺少')) return '缺少字段';
  if (messageText.includes('不是有效数字') || messageText.includes('不是数字')) return '数值格式';
  if (messageText.includes('日期格式') || messageText.includes('时间格式')) return '日期时间格式';
  if (messageText.includes('规则') || messageText.includes('无法解析')) return '规则配置';
  if (messageText.includes('映射')) return '映射配置';
  return '其他错误';
}

export function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

const BUILTIN_TRANSFORM_RULES: Record<string, Record<string, string>> = {
  bool_yn: {
    是: 'true',
    否: 'false',
    Y: 'true',
    N: 'false',
    y: 'true',
    n: 'false',
    yes: 'true',
    no: 'false',
    true: 'true',
    false: 'false',
    '1': 'true',
    '0': 'false',
  },
  temp_status_cn: {
    适温: 'ready',
    待温: 'waiting',
    ready: 'ready',
    waiting: 'waiting',
  },
};

export function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

export function parseTransformValueMap(rule?: string): Record<string, string> | null {
  const rawRule = rule?.trim() ?? '';
  if (!rawRule) return null;

  const builtin = BUILTIN_TRANSFORM_RULES[rawRule.toLowerCase()];
  if (builtin) return builtin;

  if (rawRule.startsWith('{') && rawRule.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawRule) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v === null || v === undefined) continue;
        result[stripQuotes(k)] = stripQuotes(String(v));
      }
      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  const entries = rawRule
    .split(/[;,；，\n]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const result: Record<string, string> = {};
  entries.forEach((segment) => {
    let pair: [string, string] | null = null;
    if (segment.includes('=>')) {
      const [left, ...rest] = segment.split('=>');
      pair = [left, rest.join('=>')];
    } else if (segment.includes(':')) {
      const [left, ...rest] = segment.split(':');
      pair = [left, rest.join(':')];
    } else if (segment.includes('=')) {
      const [left, ...rest] = segment.split('=');
      pair = [left, rest.join('=')];
    }
    if (!pair) return;
    const key = stripQuotes(pair[0]);
    const value = stripQuotes(pair[1]);
    if (!key) return;
    result[key] = value;
  });

  return Object.keys(result).length > 0 ? result : null;
}

export function buildValueTransforms(rows: FieldMappingItem[]) {
  const transformRows = rows.filter((row) => row.mapping_type === 'transform');
  const errors: string[] = [];
  const rules: ValueTransformRule[] = [];

  transformRows.forEach((row, idx) => {
    const targetField = row.target_field?.trim() ?? '';
    const parsedMap = parseTransformValueMap(row.transform_rule);
    if (!targetField) {
      errors.push(`第 ${idx + 1} 条值转换映射缺少目标字段`);
      return;
    }
    if (!parsedMap) {
      errors.push(
        `${targetField} 的值转换规则无效，请使用内置键（如 bool_yn）或键值对（如 是=true,否=false）`
      );
      return;
    }
    rules.push({
      field: targetField,
      value_map: parsedMap,
      data_type: 'string',
    });
  });

  return { errors, valueTransformsJson: JSON.stringify(rules) };
}

export function hydrateTransformRuleByValueTransforms(
  rows: FieldMappingItem[],
  valueTransforms?: string
): FieldMappingItem[] {
  if (!valueTransforms?.trim()) return rows;

  let parsedRules: ValueTransformRule[] = [];
  try {
    const parsed = JSON.parse(valueTransforms) as unknown;
    if (Array.isArray(parsed)) {
      parsedRules = parsed as ValueTransformRule[];
    }
  } catch {
    return rows;
  }

  if (parsedRules.length === 0) return rows;
  const byField = new Map<string, ValueTransformRule>();
  parsedRules.forEach((rule) => {
    if (rule.field?.trim()) {
      byField.set(rule.field.trim(), rule);
    }
  });

  return rows.map((row) => {
    if (row.mapping_type !== 'transform') return row;
    if ((row.transform_rule?.trim().length ?? 0) > 0) return row;
    const matchedRule = byField.get(row.target_field?.trim() ?? '');
    if (!matchedRule?.value_map) return row;
    return {
      ...row,
      transform_rule: JSON.stringify(matchedRule.value_map),
    };
  });
}

export function validateCalculateRule(rule?: string): string | null {
  const compact = (rule ?? '').trim().replace(/\s+/g, '');
  if (!compact) return null;

  if (/^[/*+-]-?\d+(\.\d+)?$/.test(compact)) {
    const op = compact[0];
    const operand = Number(compact.slice(1));
    if (!Number.isFinite(operand)) return '规则参数不是数字';
    if (op === '/' && Math.abs(operand) < Number.EPSILON) return '除数不能为0';
    return null;
  }

  const match = compact.match(/^(x|value|raw)([/*+-])(-?\d+(\.\d+)?)$/i);
  if (!match) return '格式错误，示例: /1000 或 x*1.1';
  const op = match[2];
  const operand = Number(match[3]);
  if (!Number.isFinite(operand)) return '规则参数不是数字';
  if (op === '/' && Math.abs(operand) < Number.EPSILON) return '除数不能为0';
  return null;
}

export function hasBalancedBraces(input: string): boolean {
  let balance = 0;
  for (const ch of input) {
    if (ch === '{') balance += 1;
    if (ch === '}') balance -= 1;
    if (balance < 0) return false;
  }
  return balance === 0;
}

export function validateCombineRule(rule?: string): string | null {
  const trimmed = (rule ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase().startsWith('CONCAT(') && !trimmed.endsWith(')')) {
    return 'CONCAT 规则缺少右括号';
  }
  if (!hasBalancedBraces(trimmed)) {
    return '模板花括号不成对';
  }
  return null;
}

const RULE_PRESET_MAP: Record<
  'transform' | 'calculate' | 'combine',
  { label: string; value: string }[]
> = {
  transform: [
    { label: '布尔映射 bool_yn', value: 'bool_yn' },
    { label: '适温映射 temp_status_cn', value: 'temp_status_cn' },
    { label: '示例: 是=true,否=false', value: '是=true,否=false' },
  ],
  calculate: [
    { label: '吨位换算 /1000', value: '/1000' },
    { label: '乘系数 x*1.1', value: 'x*1.1' },
    { label: '减偏差 x-5', value: 'x-5' },
  ],
  combine: [
    { label: "CONCAT(合同号,'-',钢卷号)", value: "CONCAT(合同号,'-',钢卷号)" },
    { label: '{contract_no}-{coil_id}', value: '{contract_no}-{coil_id}' },
  ],
};

export function getRulePresetOptions(mappingType: FieldMappingItem['mapping_type']) {
  if (mappingType === 'transform') return RULE_PRESET_MAP.transform;
  if (mappingType === 'calculate') return RULE_PRESET_MAP.calculate;
  if (mappingType === 'combine') return RULE_PRESET_MAP.combine;
  return [];
}
