import { describe, expect, it, vi } from 'vitest';
import type { FieldMappingItem } from '../../types/fieldMapping';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
}));

vi.mock('../../services/fieldMappingApi', () => ({
  fieldMappingApi: {},
}));

vi.mock('../../services/materialApi', () => ({
  materialApi: {},
}));

import {
  buildValueTransforms,
  classifyImportErrorMessage,
  escapeCsvCell,
  excelSerialToDate,
  getRulePresetOptions,
  getSeasonThreshold,
  hasBalancedBraces,
  hydrateTransformRuleByValueTransforms,
  normalizeFieldName,
  parsePreviewDate,
  parseTransformValueMap,
  stripQuotes,
  validateCalculateRule,
  validateCombineRule,
} from './helpers';

function makeRow(partial: Partial<FieldMappingItem>): FieldMappingItem {
  return {
    source_field: '',
    target_field: '',
    mapping_type: 'direct',
    ...partial,
  };
}

describe('FieldMapping helper functions', () => {
  // ─── normalizeFieldName ───
  it('normalizes field names and classifies errors', () => {
    expect(normalizeFieldName(' Coil_ID (测试) ')).toBe('coilid测试');
    expect(classifyImportErrorMessage('缺少字段: coiling_time')).toBe('缺少字段');
    expect(classifyImportErrorMessage('字段A不是有效数字')).toBe('数值格式');
    expect(classifyImportErrorMessage('日期格式不正确')).toBe('日期时间格式');
    expect(classifyImportErrorMessage('规则无法解析')).toBe('规则配置');
    expect(classifyImportErrorMessage('映射关系异常')).toBe('映射配置');
    expect(classifyImportErrorMessage('unknown')).toBe('其他错误');
  });

  it('normalizes unicode, hyphens, and mixed-case names', () => {
    expect(normalizeFieldName('Steel-Grade')).toBe('steelgrade');
    expect(normalizeFieldName('（宽度）')).toBe('宽度');
    expect(normalizeFieldName('  ')).toBe('');
    expect(normalizeFieldName('COIL_ID')).toBe('coilid');
    expect(normalizeFieldName('customer name (客户)')).toBe('customername客户');
  });

  // ─── excelSerialToDate ───
  it('parses excel serial and preview date formats', () => {
    expect(excelSerialToDate(Number.NaN)).toBeNull();
    const serialDate = excelSerialToDate(45292);
    expect(serialDate).not.toBeNull();
    expect(parsePreviewDate('')).toBeNull();
    expect(parsePreviewDate('45292')).not.toBeNull();
    expect(parsePreviewDate('2025-01-02 03:04:05')).not.toBeNull();
    expect(parsePreviewDate('20250102030405')).not.toBeNull();
    expect(parsePreviewDate('20250102')).not.toBeNull();
    expect(parsePreviewDate('not-a-date')).toBeNull();
  });

  it('handles excel serial date edge cases', () => {
    expect(excelSerialToDate(Infinity)).toBeNull();
    expect(excelSerialToDate(-Infinity)).toBeNull();
    // serial 1 = 1899-12-31
    const day1 = excelSerialToDate(1);
    expect(day1).not.toBeNull();
    expect(day1!.getUTCFullYear()).toBe(1899);
    // serial 0
    const day0 = excelSerialToDate(0);
    expect(day0).not.toBeNull();
    // fractional serial (time component)
    const withTime = excelSerialToDate(45292.5);
    expect(withTime).not.toBeNull();
    expect(withTime!.getUTCHours()).toBe(12);
  });

  it('parses ISO 8601 and slash date formats', () => {
    expect(parsePreviewDate('2025-06-15T10:30:00Z')).not.toBeNull();
    expect(parsePreviewDate('2025/06/15')).not.toBeNull();
    expect(parsePreviewDate('   2025-01-01   ')).not.toBeNull();
    // boundary: numeric value at range limit
    expect(parsePreviewDate('2')).not.toBeNull(); // valid serial
    // value 0 is <= 1, falls through to native parse
    expect(parsePreviewDate('0')).not.toBeNull(); // native Date can parse '0'
  });

  // ─── classifyImportErrorMessage ───
  it('classifies all error message variants', () => {
    expect(classifyImportErrorMessage('字段不是数字')).toBe('数值格式');
    expect(classifyImportErrorMessage('时间格式错误')).toBe('日期时间格式');
    expect(classifyImportErrorMessage('无法解析规则')).toBe('规则配置');
    expect(classifyImportErrorMessage('')).toBe('其他错误');
  });

  // ─── parseTransformValueMap ───
  it('builds transform value map from builtin/json/pairs', () => {
    expect(parseTransformValueMap('bool_yn')).toMatchObject({ 是: 'true', 否: 'false' });
    expect(parseTransformValueMap('{"A":"1","B":"2"}')).toEqual({ A: '1', B: '2' });
    expect(parseTransformValueMap('{"A":"1","B":null}')).toEqual({ A: '1' });
    expect(parseTransformValueMap('["a"]')).toBeNull();
    expect(parseTransformValueMap('是=true, 否=false')).toEqual({ 是: 'true', 否: 'false' });
    expect(parseTransformValueMap('A=>1;B:2;C=3')).toEqual({ A: '1', B: '2', C: '3' });
    expect(parseTransformValueMap('=1')).toBeNull();
    expect(parseTransformValueMap('{invalid')).toBeNull();
    expect(parseTransformValueMap('invalid-rule')).toBeNull();
  });

  it('handles empty / undefined / whitespace transform rules', () => {
    expect(parseTransformValueMap(undefined)).toBeNull();
    expect(parseTransformValueMap('')).toBeNull();
    expect(parseTransformValueMap('   ')).toBeNull();
  });

  it('handles builtin rule case-insensitivity', () => {
    expect(parseTransformValueMap('BOOL_YN')).toMatchObject({ 是: 'true' });
    expect(parseTransformValueMap('Temp_Status_CN')).toMatchObject({ 适温: 'ready' });
  });

  it('handles JSON with all null values', () => {
    expect(parseTransformValueMap('{"A":null,"B":null}')).toBeNull();
  });

  it('handles semicolon-separated pairs with Chinese delimiters', () => {
    expect(parseTransformValueMap('好=good；坏=bad')).toEqual({ 好: 'good', 坏: 'bad' });
    expect(parseTransformValueMap('好=good，坏=bad')).toEqual({ 好: 'good', 坏: 'bad' });
  });

  // ─── buildValueTransforms / hydrateTransformRuleByValueTransforms ───
  it('builds and hydrates transform rows', () => {
    const rows: FieldMappingItem[] = [
      makeRow({
        mapping_type: 'transform',
        target_field: 'temp_status',
        transform_rule: 'temp_status_cn',
      }),
      makeRow({ mapping_type: 'transform', target_field: '', transform_rule: 'a=b' }),
      makeRow({ mapping_type: 'transform', target_field: 'bool_flag', transform_rule: '' }),
    ];
    const built = buildValueTransforms(rows);
    expect(built.errors.some((item) => item.includes('缺少目标字段'))).toBe(true);
    expect(built.valueTransformsJson).toContain('"temp_status"');

    const hydrated = hydrateTransformRuleByValueTransforms(
      rows,
      JSON.stringify([{ field: 'bool_flag', value_map: { Y: 'true', N: 'false' } }])
    );
    expect(hydrated[2].transform_rule).toContain('"Y":"true"');

    expect(hydrateTransformRuleByValueTransforms(rows, '')).toEqual(rows);
    expect(hydrateTransformRuleByValueTransforms(rows, 'not-json')).toEqual(rows);
    expect(hydrateTransformRuleByValueTransforms(rows, '[]')).toEqual(rows);
    const unchanged = hydrateTransformRuleByValueTransforms(
      [
        makeRow({ mapping_type: 'direct', target_field: 'coil_id' }),
        makeRow({
          mapping_type: 'transform',
          target_field: 'temp_status',
          transform_rule: 'temp_status_cn',
        }),
      ],
      JSON.stringify([{ field: 'missing', value_map: { A: '1' } }])
    );
    expect(unchanged[0].mapping_type).toBe('direct');
    expect(unchanged[1].transform_rule).toBe('temp_status_cn');
  });

  it('buildValueTransforms handles empty rows and invalid rules', () => {
    const empty = buildValueTransforms([]);
    expect(empty.errors).toHaveLength(0);
    expect(JSON.parse(empty.valueTransformsJson)).toEqual([]);

    const allInvalid = buildValueTransforms([
      makeRow({ mapping_type: 'transform', target_field: 'f1', transform_rule: 'invalid-format' }),
    ]);
    expect(allInvalid.errors.length).toBeGreaterThan(0);

    // mixed types — only transform rows are processed
    const mixed = buildValueTransforms([
      makeRow({ mapping_type: 'direct', target_field: 'coil_id' }),
      makeRow({ mapping_type: 'transform', target_field: 'status', transform_rule: 'bool_yn' }),
    ]);
    expect(mixed.errors).toHaveLength(0);
    expect(mixed.valueTransformsJson).toContain('"status"');
  });

  // ─── validateCalculateRule ───
  it('validates calculate/combine rules and braces', () => {
    expect(validateCalculateRule('')).toBeNull();
    expect(validateCalculateRule('/1000')).toBeNull();
    expect(validateCalculateRule('x*1.1')).toBeNull();
    expect(validateCalculateRule('/0')).toBe('除数不能为0');
    expect(validateCalculateRule('x/0')).toBe('除数不能为0');
    expect(validateCalculateRule('abc')).toContain('格式错误');

    expect(hasBalancedBraces('{a}-{b}')).toBe(true);
    expect(hasBalancedBraces('}{')).toBe(false);
    expect(hasBalancedBraces('{a-{b}')).toBe(false);
    expect(validateCombineRule('')).toBeNull();
    expect(validateCombineRule('{a}-{b}')).toBeNull();
    expect(validateCombineRule('CONCAT(a,b')).toBe('CONCAT 规则缺少右括号');
    expect(validateCombineRule('{a-{b}')).toBe('模板花括号不成对');
  });

  it('validates additional calculate rule patterns', () => {
    expect(validateCalculateRule('*2')).toBeNull();
    expect(validateCalculateRule('+100')).toBeNull();
    expect(validateCalculateRule('-50')).toBeNull();
    expect(validateCalculateRule('value*1.5')).toBeNull();
    expect(validateCalculateRule('raw/100')).toBeNull();
    expect(validateCalculateRule('VALUE+10')).toBeNull();
    expect(validateCalculateRule('  /1000  ')).toBeNull();
    expect(validateCalculateRule(undefined)).toBeNull();
    // negative operand
    expect(validateCalculateRule('x*-2')).toBeNull();
    expect(validateCalculateRule('/-0')).toBe('除数不能为0');
  });

  it('validates CONCAT with closing paren', () => {
    expect(validateCombineRule('CONCAT(a,b)')).toBeNull();
    expect(validateCombineRule('concat(x,y')).toBe('CONCAT 规则缺少右括号');
  });

  it('hasBalancedBraces with empty input', () => {
    expect(hasBalancedBraces('')).toBe(true);
    expect(hasBalancedBraces('no braces here')).toBe(true);
    expect(hasBalancedBraces('{}')).toBe(true);
    expect(hasBalancedBraces('{{}')).toBe(false);
  });

  // ─── escapeCsvCell / stripQuotes / getSeasonThreshold / getRulePresetOptions ───
  it('covers csv escape, quote strip and rule presets', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(stripQuotes('"abc"')).toBe('abc');
    expect(stripQuotes("'xyz'")).toBe('xyz');

    expect(getSeasonThreshold(1)).toBe(3);
    expect(getSeasonThreshold(4)).toBe(3);
    expect(getSeasonThreshold(7)).toBe(4);
    expect(getSeasonThreshold(10)).toBe(4);

    expect(getRulePresetOptions('transform').length).toBeGreaterThan(0);
    expect(getRulePresetOptions('calculate').length).toBeGreaterThan(0);
    expect(getRulePresetOptions('combine').length).toBeGreaterThan(0);
    expect(getRulePresetOptions('direct')).toEqual([]);
  });

  it('escapeCsvCell handles numeric and empty values', () => {
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell('')).toBe('');
  });

  it('stripQuotes handles non-quoted and short strings', () => {
    expect(stripQuotes('abc')).toBe('abc');
    expect(stripQuotes('a')).toBe('a');
    expect(stripQuotes('')).toBe('');
    expect(stripQuotes('"mismatched')).toBe('"mismatched');
    expect(stripQuotes('" spaced "')).toBe('spaced');
  });

  it('getSeasonThreshold covers all months', () => {
    expect(getSeasonThreshold(2)).toBe(3); // winter
    expect(getSeasonThreshold(3)).toBe(3); // spring start
    expect(getSeasonThreshold(5)).toBe(3); // spring end
    expect(getSeasonThreshold(6)).toBe(4); // summer start
    expect(getSeasonThreshold(8)).toBe(4); // summer end
    expect(getSeasonThreshold(9)).toBe(4); // autumn start
    expect(getSeasonThreshold(11)).toBe(4); // autumn end
    expect(getSeasonThreshold(12)).toBe(3); // winter
  });

  it('getRulePresetOptions for default/date returns empty', () => {
    expect(getRulePresetOptions('default')).toEqual([]);
    expect(getRulePresetOptions('date')).toEqual([]);
  });
});
