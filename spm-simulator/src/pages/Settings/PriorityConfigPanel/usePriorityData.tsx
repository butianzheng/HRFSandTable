import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { message, Modal } from 'antd';
import { open, save } from '@tauri-apps/plugin-dialog';
import { configApi } from '../../../services/configApi';
import type { PriorityWeightUpsertInput } from '../../../types/config';
import { getErrorMessage } from '../../../utils/error';
import type {
  EditablePriorityWeightRow,
  EditablePriorityDimensionRow,
  EditableCustomerPriorityRow,
  EditableBatchPriorityRow,
  EditableProductTypePriorityRow,
} from '../types';
import {
  mapPriorityWeightRows,
  mapPriorityDimensionRows,
  mapCustomerPriorityRows,
  mapBatchPriorityRows,
  mapProductPriorityRows,
  trimOptionalText,
  requireText,
} from '../types';

export interface UsePriorityDataParams {
  focusKey: string;
  onClearFocus: () => void;
}

export function usePriorityData({ focusKey }: UsePriorityDataParams) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string>('weights');
  const [weightRows, setWeightRows] = useState<EditablePriorityWeightRow[]>([]);
  const [dimensionRows, setDimensionRows] = useState<EditablePriorityDimensionRow[]>([]);
  const [customerRows, setCustomerRows] = useState<EditableCustomerPriorityRow[]>([]);
  const [batchRows, setBatchRows] = useState<EditableBatchPriorityRow[]>([]);
  const [productRows, setProductRows] = useState<EditableProductTypePriorityRow[]>([]);
  const tempRowSeedRef = useRef(0);

  const createTempKey = useCallback((prefix: string) => {
    tempRowSeedRef.current += 1;
    return `${prefix}-tmp-${tempRowSeedRef.current}`;
  }, []);

  const fetchPriorityConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [weights, dimensions, customers, batches, products] = await Promise.all([
        configApi.getPriorityWeightConfigs(),
        configApi.getPriorityDimensionConfigs(),
        configApi.getCustomerPriorityConfigs(),
        configApi.getBatchPriorityConfigs(),
        configApi.getProductTypePriorityConfigs(),
      ]);
      setWeightRows(mapPriorityWeightRows(weights));
      setDimensionRows(mapPriorityDimensionRows(dimensions));
      setCustomerRows(mapCustomerPriorityRows(customers));
      setBatchRows(mapBatchPriorityRows(batches));
      setProductRows(mapProductPriorityRows(products));
    } catch (error: unknown) {
      message.error(`加载优先级配置失败: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPriorityConfigs();
  }, [fetchPriorityConfigs]);

  useEffect(() => {
    if (!focusKey) return;
    const [prefix] = focusKey.split(':', 2);
    if (prefix === 'assessment') {
      setActiveSubTab('weights');
    } else if (prefix === 'delivery' || prefix === 'contract') {
      setActiveSubTab('dimensions');
    } else if (prefix === 'customer') {
      setActiveSubTab('customers');
    } else if (prefix === 'batch') {
      setActiveSubTab('batches');
    } else if (prefix === 'product_type') {
      setActiveSubTab('products');
    }
  }, [focusKey]);

  // ─── Import / Export ───

  const handleExportPriorityConfigs = async (format: 'excel' | 'csv') => {
    const filePath = await save({
      title: format === 'excel' ? '导出优先级配置 Excel' : '导出优先级配置 CSV',
      defaultPath: format === 'excel' ? 'priority-configs.xlsx' : 'priority-configs.csv',
      filters:
        format === 'excel'
          ? [{ name: 'Excel', extensions: ['xlsx'] }]
          : [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!filePath) return;

    setSaving(true);
    try {
      const count =
        format === 'excel'
          ? await configApi.exportPriorityConfigsExcel(filePath)
          : await configApi.exportPriorityConfigsCsv(filePath);
      message.success(`导出成功：${count} 条`);
    } catch (error: unknown) {
      message.error(`导出失败: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const openPriorityImportFile = async () => {
    const selected = await open({
      title: '导入优先级配置',
      multiple: false,
      filters: [{ name: 'Config Files', extensions: ['xlsx', 'xls', 'csv'] }],
    });
    if (!selected || Array.isArray(selected)) return;
    return selected;
  };

  const showImportResult = (
    modeLabel: '预检' | '导入',
    result: {
      total_rows: number;
      imported_weight: number;
      imported_dimension: number;
      imported_customer: number;
      imported_batch: number;
      imported_product_type: number;
      skipped_rows: number;
      warnings: string[];
    }
  ) => {
    message.success(
      `${modeLabel}完成：共${result.total_rows}行，权重${result.imported_weight}，维度${result.imported_dimension}，客户${result.imported_customer}，集批${result.imported_batch}，产品${result.imported_product_type}，跳过${result.skipped_rows}`
    );
    if (result.warnings.length > 0) {
      Modal.warning({
        title: `存在 ${result.warnings.length} 条${modeLabel}警告`,
        content: (
          <div style={{ maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {result.warnings.slice(0, 20).join('\n')}
            {result.warnings.length > 20
              ? `\n... 其余 ${result.warnings.length - 20} 条已省略`
              : ''}
          </div>
        ),
        width: 640,
      });
    }
  };

  const handleImportPriorityConfigs = async (dryRun: boolean) => {
    const selected = await openPriorityImportFile();
    if (!selected) return;

    setSaving(true);
    try {
      const result = await configApi.importPriorityConfigs(selected, dryRun);
      showImportResult(dryRun ? '预检' : '导入', result);
      if (!dryRun) {
        await fetchPriorityConfigs();
      }
    } catch (error: unknown) {
      message.error(`${dryRun ? '预检' : '导入'}失败: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPriorityTemplate = async (format: 'excel' | 'csv') => {
    const filePath = await save({
      title: format === 'excel' ? '导出优先级配置模板 Excel' : '导出优先级配置模板 CSV',
      defaultPath:
        format === 'excel' ? 'priority-config-template.xlsx' : 'priority-config-template.csv',
      filters:
        format === 'excel'
          ? [{ name: 'Excel', extensions: ['xlsx'] }]
          : [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!filePath) return;

    setSaving(true);
    try {
      const count =
        format === 'excel'
          ? await configApi.exportPriorityConfigTemplateExcel(filePath)
          : await configApi.exportPriorityConfigTemplateCsv(filePath);
      message.success(`模板导出成功：示例 ${count} 条`);
    } catch (error: unknown) {
      message.error(`模板导出失败: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Save / Delete helpers ───

  const runSave = async (saveAction: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await saveAction();
      message.success(successMessage);
    } catch (error: unknown) {
      message.error(`保存失败: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runDelete = async (deleteAction: () => Promise<void>) => {
    setSaving(true);
    try {
      await deleteAction();
      message.success('删除成功');
    } catch (error: unknown) {
      message.error(`删除失败: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeights = async () => {
    await runSave(async () => {
      const payload: PriorityWeightUpsertInput[] = weightRows.map((row, index) => {
        if (!Number.isFinite(row.weight) || row.weight < 0 || row.weight > 1) {
          throw new Error(`维度 ${row.dimension_name || row.dimension_type} 权重必须在 0~1`);
        }
        return {
          dimension_type: requireText(row.dimension_type, '维度类型'),
          dimension_name: requireText(row.dimension_name, '维度名称'),
          weight: row.weight,
          enabled: row.enabled,
          sort_order: row.sort_order ?? index + 1,
          description: trimOptionalText(row.description),
        };
      });
      const latest = await configApi.upsertPriorityWeightConfigs(payload);
      setWeightRows(mapPriorityWeightRows(latest));
    }, '权重配置已保存');
  };

  const handleSaveDimensions = async () => {
    await runSave(async () => {
      for (const row of dimensionRows) {
        await configApi.upsertPriorityDimensionConfig({
          id: row.id,
          dimension_type: requireText(row.dimension_type, '维度类型'),
          dimension_code: requireText(row.dimension_code, '维度编码'),
          dimension_name: requireText(row.dimension_name, '维度名称'),
          score: row.score,
          enabled: row.enabled,
          sort_order: row.sort_order ?? 0,
          rule_config: trimOptionalText(row.rule_config),
          description: trimOptionalText(row.description),
        });
      }
      const latest = await configApi.getPriorityDimensionConfigs();
      setDimensionRows(mapPriorityDimensionRows(latest));
    }, '交期/合同维度配置已保存');
  };

  const handleSaveCustomers = async () => {
    await runSave(async () => {
      for (const row of customerRows) {
        await configApi.upsertCustomerPriorityConfig({
          id: row.id,
          customer_code: requireText(row.customer_code, '客户编码'),
          customer_name: requireText(row.customer_name, '客户名称'),
          priority_level: requireText(row.priority_level, '优先级等级'),
          priority_score: row.priority_score,
          enabled: row.enabled,
          remarks: trimOptionalText(row.remarks),
        });
      }
      const latest = await configApi.getCustomerPriorityConfigs();
      setCustomerRows(mapCustomerPriorityRows(latest));
    }, '客户优先级配置已保存');
  };

  const handleSaveBatches = async () => {
    await runSave(async () => {
      for (const row of batchRows) {
        await configApi.upsertBatchPriorityConfig({
          id: row.id,
          batch_code: requireText(row.batch_code, '集批编码'),
          batch_name: requireText(row.batch_name, '集批名称'),
          priority_type: requireText(row.priority_type, '优先级类型'),
          priority_score: row.priority_score,
          enabled: row.enabled,
          remarks: trimOptionalText(row.remarks),
        });
      }
      const latest = await configApi.getBatchPriorityConfigs();
      setBatchRows(mapBatchPriorityRows(latest));
    }, '集批优先级配置已保存');
  };

  const handleSaveProducts = async () => {
    await runSave(async () => {
      for (const row of productRows) {
        await configApi.upsertProductTypePriorityConfig({
          id: row.id,
          product_type: requireText(row.product_type, '产品大类编码'),
          product_name: requireText(row.product_name, '产品大类名称'),
          priority_level: requireText(row.priority_level, '优先级等级'),
          priority_score: row.priority_score,
          enabled: row.enabled,
          remarks: trimOptionalText(row.remarks),
        });
      }
      const latest = await configApi.getProductTypePriorityConfigs();
      setProductRows(mapProductPriorityRows(latest));
    }, '产品大类优先级配置已保存');
  };

  const handleDeleteDimensionRow = async (row: EditablePriorityDimensionRow) => {
    if (row.id === undefined) {
      setDimensionRows((prev) => prev.filter((item) => item.key !== row.key));
      return;
    }
    await runDelete(async () => {
      await configApi.deletePriorityDimensionConfig(row.id as number);
      setDimensionRows((prev) => prev.filter((item) => item.key !== row.key));
    });
  };

  const handleDeleteCustomerRow = async (row: EditableCustomerPriorityRow) => {
    if (row.id === undefined) {
      setCustomerRows((prev) => prev.filter((item) => item.key !== row.key));
      return;
    }
    await runDelete(async () => {
      await configApi.deleteCustomerPriorityConfig(row.id as number);
      setCustomerRows((prev) => prev.filter((item) => item.key !== row.key));
    });
  };

  const handleDeleteBatchRow = async (row: EditableBatchPriorityRow) => {
    if (row.id === undefined) {
      setBatchRows((prev) => prev.filter((item) => item.key !== row.key));
      return;
    }
    await runDelete(async () => {
      await configApi.deleteBatchPriorityConfig(row.id as number);
      setBatchRows((prev) => prev.filter((item) => item.key !== row.key));
    });
  };

  const handleDeleteProductRow = async (row: EditableProductTypePriorityRow) => {
    if (row.id === undefined) {
      setProductRows((prev) => prev.filter((item) => item.key !== row.key));
      return;
    }
    await runDelete(async () => {
      await configApi.deleteProductTypePriorityConfig(row.id as number);
      setProductRows((prev) => prev.filter((item) => item.key !== row.key));
    });
  };

  // ─── Focus filtering ───

  const [focusPrefix, focusCode] = useMemo(() => {
    if (!focusKey) return ['', ''] as const;
    const [prefix, code = ''] = focusKey.split(':', 2);
    return [prefix, code] as const;
  }, [focusKey]);

  const shownWeightRows = useMemo(() => {
    if (!focusKey || focusPrefix !== 'assessment') return weightRows;
    return weightRows.filter((item) => item.dimension_type === 'assessment');
  }, [focusKey, focusPrefix, weightRows]);

  const shownDimensionRows = useMemo(() => {
    if (!focusKey || (focusPrefix !== 'delivery' && focusPrefix !== 'contract'))
      return dimensionRows;
    return dimensionRows.filter((item) => {
      if (item.dimension_type !== focusPrefix) return false;
      if (!focusCode) return true;
      return item.dimension_code === focusCode;
    });
  }, [dimensionRows, focusCode, focusKey, focusPrefix]);

  const shownCustomerRows = useMemo(() => {
    if (!focusKey || focusPrefix !== 'customer') return customerRows;
    if (!focusCode || focusCode === 'default') return [];
    return customerRows.filter((item) => item.customer_code === focusCode);
  }, [customerRows, focusCode, focusKey, focusPrefix]);

  const shownBatchRows = useMemo(() => {
    if (!focusKey || focusPrefix !== 'batch') return batchRows;
    if (!focusCode || focusCode === 'default') return [];
    return batchRows.filter((item) => item.batch_code === focusCode);
  }, [batchRows, focusCode, focusKey, focusPrefix]);

  const shownProductRows = useMemo(() => {
    if (!focusKey || focusPrefix !== 'product_type') return productRows;
    if (!focusCode || focusCode === 'default') return [];
    return productRows.filter((item) => item.product_type === focusCode);
  }, [focusCode, focusKey, focusPrefix, productRows]);

  return {
    loading,
    saving,
    activeSubTab,
    setActiveSubTab,
    // row data
    shownWeightRows,
    shownDimensionRows,
    shownCustomerRows,
    shownBatchRows,
    shownProductRows,
    // row setters (for columns)
    setWeightRows,
    setDimensionRows,
    setCustomerRows,
    setBatchRows,
    setProductRows,
    // actions
    fetchPriorityConfigs,
    createTempKey,
    handleSaveWeights,
    handleSaveDimensions,
    handleSaveCustomers,
    handleSaveBatches,
    handleSaveProducts,
    handleDeleteDimensionRow,
    handleDeleteCustomerRow,
    handleDeleteBatchRow,
    handleDeleteProductRow,
    handleImportPriorityConfigs,
    handleExportPriorityConfigs,
    handleExportPriorityTemplate,
  };
}
