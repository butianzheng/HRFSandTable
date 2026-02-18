import { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, message } from 'antd';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

import { fieldMappingApi } from '../../services/fieldMappingApi';
import { materialApi } from '../../services/materialApi';
import {
  TARGET_FIELDS,
  type FilePreviewResult,
  type FieldMapping as FieldMappingType,
  type FieldMappingItem,
} from '../../types/fieldMapping';
import type { ImportTestResult } from '../../types/material';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  normalizeFieldName,
  getSeasonThreshold,
  parsePreviewDate,
  classifyImportErrorMessage,
  escapeCsvCell,
  parseTransformValueMap,
  buildValueTransforms,
  hydrateTransformRuleByValueTransforms,
  validateCalculateRule,
  validateCombineRule,
  getRulePresetOptions,
} from './helpers';

const targetFields = TARGET_FIELDS;

interface RowIssueItem {
  level: 'error' | 'warning';
  text: string;
}

export interface TempPreviewRow {
  key: string;
  row_no: number;
  raw_value: string;
  status: 'ready' | 'waiting' | 'invalid' | 'missing_mapping';
  wait_days?: number;
  threshold_days?: number;
  remain_days?: number;
  note?: string;
}

export const DATE_FORMAT_PRESET_OPTIONS: { label: string; value: string }[] = [
  { label: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
  { label: 'YYYY/MM/DD HH:mm:ss', value: 'YYYY/MM/DD HH:mm:ss' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'YYYY/MM/DD', value: 'YYYY/MM/DD' },
  { label: 'YYYYMMDD', value: 'YYYYMMDD' },
  { label: 'YYYYMMDDHHmmss', value: 'YYYYMMDDHHmmss' },
];

export { targetFields, getRulePresetOptions };

export function useFieldMappingData() {
  const [mappings, setMappings] = useState<FieldMappingType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<FieldMappingType | null>(null);
  const [form] = Form.useForm();

  const [mappingRows, setMappingRows] = useState<FieldMappingItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFilePath, setPreviewFilePath] = useState('');
  const [previewData, setPreviewData] = useState<FilePreviewResult | null>(null);
  const [testImporting, setTestImporting] = useState(false);
  const [exportingTestResult, setExportingTestResult] = useState(false);
  const [testResult, setTestResult] = useState<ImportTestResult | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);

  const sourceFieldOptions = useMemo(
    () => (previewData?.headers ?? []).map((header) => ({ value: header, label: header })),
    [previewData]
  );

  const testErrorSummary = useMemo(() => {
    if (!testResult || testResult.errors.length === 0) return [];
    const counts = new Map<string, number>();
    testResult.errors.forEach((item) => {
      const key = classifyImportErrorMessage(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [testResult]);

  const mappingRowsKey = useMemo(
    () =>
      JSON.stringify(
        mappingRows.map((r) => [
          r.source_field,
          r.target_field,
          r.mapping_type,
          r.transform_rule,
          r.default_value,
          r.source_format,
        ])
      ),
    [mappingRows]
  );
  const debouncedMappingRowsKey = useDebouncedValue(mappingRowsKey, 300);

  // ─── 诊断逻辑 ───
  const mappingDiagnosis = useMemo(() => {
    void debouncedMappingRowsKey;
    const rowIssues: Record<number, RowIssueItem[]> = {};
    const pushRowIssue = (rowIndex: number, issue: RowIssueItem) => {
      if (!rowIssues[rowIndex]) rowIssues[rowIndex] = [];
      rowIssues[rowIndex].push(issue);
    };
    const rowLabel = (row: FieldMappingItem, index: number) => {
      const target = row.target_field?.trim();
      const source = row.source_field?.trim();
      return target || source || `第${index + 1}行`;
    };

    const requiredTargets = targetFields.filter((f) => f.required).map((f) => f.field);
    const targetRows = mappingRows
      .map((row) => row.target_field?.trim() || '')
      .filter((field) => field.length > 0);
    const sourceRows = mappingRows
      .map((row) => row.source_field?.trim() || '')
      .filter((field) => field.length > 0);
    const mappedTargetSet = new Set(targetRows);
    const missingRequired = requiredTargets.filter((field) => !mappedTargetSet.has(field));
    const duplicateTargets = targetRows.filter((field, idx) => targetRows.indexOf(field) !== idx);
    const duplicateTargetSet = Array.from(new Set(duplicateTargets));
    const targetCountMap = new Map<string, number>();
    mappingRows.forEach((row) => {
      const target = row.target_field?.trim();
      if (!target) return;
      targetCountMap.set(target, (targetCountMap.get(target) ?? 0) + 1);
    });

    const headers = previewData?.headers ?? [];
    const normalizedHeaders = new Set(headers.map((h) => normalizeFieldName(h)));
    const sourceMissingInPreview = sourceRows.filter((source) => {
      const normalized = normalizeFieldName(source);
      return !normalizedHeaders.has(normalized);
    });
    const matchedSourceCount = sourceRows.length - sourceMissingInPreview.length;
    const transformRows = mappingRows.filter((row) => row.mapping_type === 'transform');
    const transformMissingRule = transformRows
      .filter((row) => !(row.transform_rule?.trim().length ?? 0))
      .map((row) => row.target_field || row.source_field || '(未命名字段)');
    const transformInvalidRule = transformRows
      .filter(
        (row) =>
          (row.transform_rule?.trim().length ?? 0) > 0 &&
          !parseTransformValueMap(row.transform_rule)
      )
      .map((row) => row.target_field || row.source_field || '(未命名字段)');
    const calculateInvalidRule: string[] = [];
    const combineRuleWarning: string[] = [];
    const dateFormatWarning: string[] = [];
    const defaultMissingValue: string[] = [];
    const sourceMissingForType: string[] = [];

    mappingRows.forEach((row, index) => {
      const target = row.target_field?.trim() ?? '';
      const source = row.source_field?.trim() ?? '';
      const defaultValue = row.default_value?.trim() ?? '';
      const rule = row.transform_rule?.trim() ?? '';
      const label = rowLabel(row, index);

      if (!target) pushRowIssue(index, { level: 'error', text: '目标字段为空' });
      if (target && (targetCountMap.get(target) ?? 0) > 1)
        pushRowIssue(index, { level: 'error', text: `目标字段重复: ${target}` });
      if (row.mapping_type === 'default' && !defaultValue) {
        defaultMissingValue.push(label);
        pushRowIssue(index, { level: 'error', text: '默认值映射缺少默认值' });
      }
      const shouldCheckSource =
        row.mapping_type === 'direct' ||
        row.mapping_type === 'transform' ||
        row.mapping_type === 'date' ||
        row.mapping_type === 'calculate';
      if (shouldCheckSource && !source) {
        sourceMissingForType.push(label);
        pushRowIssue(index, { level: 'warning', text: '源列名为空，导入时可能取空值' });
      }
      if (row.mapping_type === 'combine' && !source && !rule) {
        sourceMissingForType.push(label);
        pushRowIssue(index, { level: 'warning', text: '组合映射缺少源列与规则' });
      }
      if (row.mapping_type === 'transform' && !rule)
        pushRowIssue(index, { level: 'warning', text: '值转换缺少规则，将按原值导入' });
      if (row.mapping_type === 'transform' && rule && !parseTransformValueMap(rule))
        pushRowIssue(index, { level: 'error', text: '值转换规则无法解析' });
      if (row.mapping_type === 'calculate') {
        const err = validateCalculateRule(rule);
        if (err) {
          calculateInvalidRule.push(label);
          pushRowIssue(index, { level: 'error', text: `计算规则无效: ${err}` });
        }
      }
      if (row.mapping_type === 'combine') {
        const warning = validateCombineRule(rule);
        if (warning) {
          combineRuleWarning.push(label);
          pushRowIssue(index, { level: 'warning', text: `组合规则提示: ${warning}` });
        }
      }
      if (row.mapping_type === 'date') {
        const sourceFormat = row.source_format?.trim() ?? '';
        if (!sourceFormat) {
          dateFormatWarning.push(label);
          pushRowIssue(index, {
            level: 'warning',
            text: '日期解析未配置 source_format，将使用自动识别',
          });
        }
      }
    });

    return {
      missingRequired,
      duplicateTargets: duplicateTargetSet,
      sourceMissingInPreview: Array.from(new Set(sourceMissingInPreview)),
      mappedCount: mappedTargetSet.size,
      sourceCount: sourceRows.length,
      matchedSourceCount,
      transformMissingRule: Array.from(new Set(transformMissingRule)),
      transformInvalidRule: Array.from(new Set(transformInvalidRule)),
      calculateInvalidRule: Array.from(new Set(calculateInvalidRule)),
      combineRuleWarning: Array.from(new Set(combineRuleWarning)),
      dateFormatWarning: Array.from(new Set(dateFormatWarning)),
      defaultMissingValue: Array.from(new Set(defaultMissingValue)),
      sourceMissingForType: Array.from(new Set(sourceMissingForType)),
      rowIssues,
    };
  }, [mappingRows, previewData, debouncedMappingRowsKey]);

  // ─── 适温预览 ───
  const tempPreview = useMemo(() => {
    if (!previewData || previewData.headers.length === 0 || previewData.sample_rows.length === 0) {
      return { headerName: '', rows: [] as TempPreviewRow[], invalidCount: 0 };
    }
    const normalizeToHeader = new Map<string, string>();
    previewData.headers.forEach((header) => {
      normalizeToHeader.set(normalizeFieldName(header), header);
    });
    const coilingSourceFromMapping = mappingRows
      .find(
        (row) => row.target_field === 'coiling_time' && (row.source_field?.trim()?.length ?? 0) > 0
      )
      ?.source_field?.trim();
    const fallbackHeader =
      normalizeToHeader.get(normalizeFieldName('coiling_time')) ??
      normalizeToHeader.get(normalizeFieldName('卷取时间')) ??
      '';
    const headerName = coilingSourceFromMapping || fallbackHeader;
    if (!headerName) {
      return {
        headerName: '',
        invalidCount: 0,
        rows: previewData.sample_rows.map((_, idx) => ({
          key: `row-${idx}`,
          row_no: idx + 2,
          raw_value: '',
          status: 'missing_mapping' as const,
          note: '未配置卷取时间映射',
        })),
      };
    }
    const headerIndex = previewData.headers.findIndex(
      (header) => normalizeFieldName(header) === normalizeFieldName(headerName)
    );
    if (headerIndex < 0) {
      return {
        headerName,
        invalidCount: 0,
        rows: previewData.sample_rows.map((_, idx) => ({
          key: `row-${idx}`,
          row_no: idx + 2,
          raw_value: '',
          status: 'missing_mapping' as const,
          note: `预览文件中未找到列: ${headerName}`,
        })),
      };
    }
    const now = new Date();
    const threshold = getSeasonThreshold(now.getUTCMonth() + 1);
    const rows = previewData.sample_rows.map((row, idx) => {
      const raw = row[headerIndex] ?? '';
      const parsed = parsePreviewDate(raw);
      if (!parsed)
        return {
          key: `row-${idx}`,
          row_no: idx + 2,
          raw_value: raw,
          status: 'invalid' as const,
          note: raw ? '时间格式无法识别' : '时间为空',
        };
      const waitDays = Math.floor((now.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000));
      const status: TempPreviewRow['status'] = waitDays >= threshold ? 'ready' : 'waiting';
      return {
        key: `row-${idx}`,
        row_no: idx + 2,
        raw_value: raw,
        status,
        wait_days: waitDays,
        threshold_days: threshold,
        remain_days: Math.max(0, threshold - waitDays),
      };
    });
    return {
      headerName,
      rows,
      invalidCount: rows.filter((row) => row.status === 'invalid').length,
    };
  }, [previewData, mappingRows]);

  // ─── 数据加载 ───
  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fieldMappingApi.getFieldMappings();
      setMappings(data);
    } catch (err) {
      message.error('加载映射模板失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  // ─── 操作处理 ───
  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ template_name: '', source_type: 'excel', is_default: false });
    setMappingRows(
      targetFields
        .filter((f) => f.required)
        .map((f) => ({
          source_field: f.label,
          target_field: f.field,
          mapping_type: 'direct' as const,
        }))
    );
    setPreviewData(null);
    setPreviewFilePath('');
    setModalOpen(true);
  };

  const handleEdit = async (record: FieldMappingType) => {
    setEditingId(record.id);
    form.setFieldsValue({
      template_name: record.template_name,
      source_type: record.source_type,
      is_default: !!record.is_default,
    });
    try {
      const items: FieldMappingItem[] = JSON.parse(record.mappings);
      setMappingRows(hydrateTransformRuleByValueTransforms(items, record.value_transforms));
    } catch {
      setMappingRows([]);
    }
    setPreviewData(null);
    setPreviewFilePath('');
    setModalOpen(true);
  };

  const handleDetail = (record: FieldMappingType) => {
    setDetailData(record);
    setDetailOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await fieldMappingApi.deleteFieldMapping(id);
      message.success('删除成功');
      fetchMappings();
    } catch (err) {
      message.error('删除失败');
      console.error(err);
    }
  };

  const handleSetDefault = async (record: FieldMappingType) => {
    if (record.is_default) return;
    try {
      setSettingDefaultId(record.id);
      const resetTasks = mappings
        .filter((item) => item.id !== record.id && item.is_default)
        .map((item) => fieldMappingApi.updateFieldMapping(item.id, { is_default: false }));
      if (resetTasks.length > 0) await Promise.all(resetTasks);
      await fieldMappingApi.updateFieldMapping(record.id, { is_default: true });
      message.success(`已将「${record.template_name}」设为默认模板`);
      await fetchMappings();
    } catch (err) {
      message.error('设置默认模板失败');
      console.error(err);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDuplicate = async (record: FieldMappingType) => {
    try {
      setCopyingId(record.id);
      await fieldMappingApi.createFieldMapping({
        template_name: `${record.template_name}_副本`,
        source_type: record.source_type,
        mappings: record.mappings,
        value_transforms: record.value_transforms,
        is_default: false,
      });
      message.success('复制模板成功');
      await fetchMappings();
    } catch (err) {
      message.error('复制模板失败');
      console.error(err);
    } finally {
      setCopyingId(null);
    }
  };

  const normalizeMappingRows = (rows: FieldMappingItem[]) =>
    rows.map((row) => {
      const mappingType = row.mapping_type;
      const normalized: FieldMappingItem = {
        ...row,
        source_field: row.source_field?.trim() ?? '',
        target_field: row.target_field?.trim() ?? '',
      };
      normalized.default_value = row.default_value?.trim() || undefined;
      normalized.source_format =
        mappingType === 'date' ? row.source_format?.trim() || undefined : undefined;
      if (mappingType === 'transform' || mappingType === 'calculate' || mappingType === 'combine') {
        normalized.transform_rule = row.transform_rule?.trim() || undefined;
      } else {
        normalized.transform_rule = undefined;
      }
      return normalized;
    });

  const validateBeforeSave = (normalizedRows: FieldMappingItem[]) => {
    const transformBuildResult = buildValueTransforms(normalizedRows);
    if (transformBuildResult.errors.length > 0) {
      message.error(transformBuildResult.errors[0]);
      return null;
    }
    if (normalizedRows.length === 0) {
      message.error('请至少保留一条映射行');
      return null;
    }
    if (mappingDiagnosis.missingRequired.length > 0) {
      message.error(`缺少必填目标字段映射: ${mappingDiagnosis.missingRequired.join(', ')}`);
      return null;
    }
    if (mappingDiagnosis.duplicateTargets.length > 0) {
      message.error(`存在重复目标字段映射: ${mappingDiagnosis.duplicateTargets.join(', ')}`);
      return null;
    }
    if (mappingDiagnosis.defaultMissingValue.length > 0) {
      message.error(`以下默认值映射缺少默认值: ${mappingDiagnosis.defaultMissingValue.join(', ')}`);
      return null;
    }
    if (mappingDiagnosis.transformInvalidRule.length > 0) {
      message.error(`以下值转换规则无法解析: ${mappingDiagnosis.transformInvalidRule.join(', ')}`);
      return null;
    }
    if (mappingDiagnosis.calculateInvalidRule.length > 0) {
      message.error(`以下计算规则无效: ${mappingDiagnosis.calculateInvalidRule.join(', ')}`);
      return null;
    }
    return transformBuildResult;
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const normalizedRows = normalizeMappingRows(mappingRows);
      const transformBuildResult = validateBeforeSave(normalizedRows);
      if (!transformBuildResult) return;

      if (mappingDiagnosis.dateFormatWarning.length > 0)
        message.warning(
          `以下日期映射未配置格式，将自动识别: ${mappingDiagnosis.dateFormatWarning.join(', ')}`
        );
      if (values.is_default) {
        const resetTasks = mappings
          .filter((item) => item.id !== editingId && item.is_default)
          .map((item) => fieldMappingApi.updateFieldMapping(item.id, { is_default: false }));
        if (resetTasks.length > 0) await Promise.all(resetTasks);
      }

      const mappingsJson = JSON.stringify(normalizedRows);
      if (editingId) {
        await fieldMappingApi.updateFieldMapping(editingId, {
          template_name: values.template_name,
          source_type: values.source_type,
          mappings: mappingsJson,
          value_transforms: transformBuildResult.valueTransformsJson,
          is_default: !!values.is_default,
        });
        message.success('更新成功');
      } else {
        await fieldMappingApi.createFieldMapping({
          template_name: values.template_name,
          source_type: values.source_type,
          mappings: mappingsJson,
          value_transforms: transformBuildResult.valueTransformsJson,
          is_default: !!values.is_default,
        });
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchMappings();
    } catch (err) {
      console.error(err);
    }
  };

  const addMappingRow = () => {
    setMappingRows([
      ...mappingRows,
      { source_field: '', target_field: '', mapping_type: 'direct' },
    ]);
  };
  const removeMappingRow = (index: number) => {
    setMappingRows(mappingRows.filter((_, i) => i !== index));
  };

  const handleEnsureRequiredMappings = () => {
    const existing = new Set(
      mappingRows.map((row) => row.target_field?.trim() || '').filter((field) => field.length > 0)
    );
    const missing = targetFields.filter((f) => f.required && !existing.has(f.field));
    if (missing.length === 0) {
      message.info('必填字段已全部配置');
      return;
    }
    setMappingRows([
      ...mappingRows,
      ...missing.map((field) => ({
        source_field: field.label,
        target_field: field.field,
        mapping_type: 'direct' as const,
      })),
    ]);
    message.success(`已补齐 ${missing.length} 个必填字段`);
  };

  const handlePreviewFile = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: 'Excel', extensions: ['xlsx', 'xls'] },
          { name: 'CSV', extensions: ['csv'] },
        ],
      });
      if (!filePath || Array.isArray(filePath)) return;
      setPreviewLoading(true);
      const data = await fieldMappingApi.previewFileHeaders(filePath);
      setPreviewData(data);
      setPreviewFilePath(filePath);
      message.success('已加载文件预览');
    } catch (err) {
      message.error('文件预览失败');
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyPreviewMapping = () => {
    if (!previewData || previewData.headers.length === 0) {
      message.warning('请先预览文件');
      return;
    }
    const headerMap = new Map(
      previewData.headers.map((header) => [normalizeFieldName(header), header])
    );
    const byTarget = new Map<string, FieldMappingItem>();
    targetFields
      .filter((f) => f.required)
      .forEach((f) => {
        byTarget.set(f.field, {
          source_field: f.label,
          target_field: f.field,
          mapping_type: 'direct',
        });
      });
    targetFields.forEach((field) => {
      const matchedHeader =
        headerMap.get(normalizeFieldName(field.field)) ??
        headerMap.get(normalizeFieldName(field.label));
      if (!matchedHeader) return;
      byTarget.set(field.field, {
        source_field: matchedHeader,
        target_field: field.field,
        mapping_type: 'direct',
      });
    });
    setMappingRows(Array.from(byTarget.values()));
    message.success(`已自动匹配 ${byTarget.size} 个字段`);
  };

  const handleTestImport = async () => {
    if (!previewFilePath) {
      message.warning('请先选择并预览源文件');
      return;
    }
    const normalizedRows = normalizeMappingRows(mappingRows);
    const transformBuildResult = validateBeforeSave(normalizedRows);
    if (!transformBuildResult) return;
    try {
      setTestImporting(true);
      const mappingsJson = JSON.stringify(normalizedRows);
      const result = await materialApi.testImportMaterials(
        previewFilePath,
        editingId ?? undefined,
        mappingsJson,
        transformBuildResult.valueTransformsJson,
        30
      );
      setTestResult(result);
      setTestModalOpen(true);
      if (result.failed > 0) {
        const firstError = result.errors[0] ?? '请查看明细';
        message.warning(
          `沙盒测试完成：成功 ${result.success}，失败 ${result.failed}，首条错误：${firstError}`
        );
      } else {
        message.success(`沙盒测试通过：${result.success}/${result.total}`);
      }
    } catch (err) {
      message.error('沙盒测试导入失败');
      console.error(err);
    } finally {
      setTestImporting(false);
    }
  };

  const handleExportTestResult = async () => {
    if (!testResult) return;
    try {
      setExportingTestResult(true);
      const now = new Date();
      const stamp = `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}_${`${now.getHours()}`.padStart(2, '0')}${`${now.getMinutes()}`.padStart(2, '0')}${`${now.getSeconds()}`.padStart(2, '0')}`;
      const filePath = await save({
        defaultPath: `导入测试结果_${stamp}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!filePath) return;
      const rows: Array<Array<string | number>> = [
        ['项', '值'],
        ['导出时间', now.toISOString()],
        ['总计', testResult.total],
        ['成功', testResult.success],
        ['失败', testResult.failed],
      ];
      rows.push([]);
      rows.push(['错误分类', '数量']);
      if (testErrorSummary.length > 0)
        testErrorSummary.forEach((item) => rows.push([item.type, item.count]));
      else rows.push(['无', 0]);
      rows.push([]);
      rows.push(['行号', '结果', '说明']);
      testResult.rows.forEach((row) => {
        rows.push([row.line_no, row.status === 'ok' ? '通过' : '失败', row.message]);
      });
      const csvText = rows
        .map((row) => row.map((item) => escapeCsvCell(item ?? '')).join(','))
        .join('\n');
      await writeTextFile(filePath, csvText);
      message.success('测试结果CSV导出成功');
    } catch (error) {
      message.error('测试结果导出失败');
      console.error(error);
    } finally {
      setExportingTestResult(false);
    }
  };

  const updateMappingRow = (index: number, field: keyof FieldMappingItem, value: string) => {
    const updated = [...mappingRows];
    const nextRow = { ...updated[index], [field]: value };
    if (field === 'mapping_type') {
      const mappingType = value as FieldMappingItem['mapping_type'];
      if (mappingType !== 'transform' && mappingType !== 'calculate' && mappingType !== 'combine')
        nextRow.transform_rule = undefined;
      if (mappingType !== 'date') nextRow.source_format = undefined;
      if (mappingType !== 'default')
        nextRow.default_value = nextRow.default_value?.trim() || undefined;
    }
    updated[index] = nextRow;
    setMappingRows(updated);
  };

  return {
    mappings,
    loading,
    modalOpen,
    setModalOpen,
    detailOpen,
    setDetailOpen,
    editingId,
    detailData,
    form,
    mappingRows,
    previewLoading,
    previewFilePath,
    previewData,
    testImporting,
    exportingTestResult,
    testResult,
    testModalOpen,
    setTestModalOpen,
    settingDefaultId,
    copyingId,
    sourceFieldOptions,
    testErrorSummary,
    mappingDiagnosis,
    tempPreview,
    // 操作
    fetchMappings,
    handleCreate,
    handleEdit,
    handleDetail,
    handleDelete,
    handleSetDefault,
    handleDuplicate,
    handleSave,
    addMappingRow,
    removeMappingRow,
    updateMappingRow,
    handleEnsureRequiredMappings,
    handlePreviewFile,
    handleApplyPreviewMapping,
    handleTestImport,
    handleExportTestResult,
  };
}
