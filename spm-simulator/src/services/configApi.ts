import { invoke } from '@tauri-apps/api/core';
import type {
  StrategyTemplate,
  SystemConfig,
  ShiftConfig,
  MaintenancePlan,
  CreateMaintenancePlanInput,
  UpdateMaintenancePlanInput,
  PriorityWeightConfig,
  PriorityWeightUpsertInput,
  PriorityDimensionConfig,
  PriorityDimensionUpsertInput,
  CustomerPriorityConfig,
  CustomerPriorityUpsertInput,
  BatchPriorityConfig,
  BatchPriorityUpsertInput,
  ProductTypePriorityConfig,
  ProductTypePriorityUpsertInput,
  PriorityConfigImportResult,
} from '../types/config';

interface CreateStrategyInput {
  name: string;
  description?: string;
  sort_weights: string;
  constraints: string;
  soft_constraints?: string;
  eval_weights: string;
  temper_rules: string;
}

interface UpdateStrategyInput {
  name?: string;
  description?: string;
  is_default?: boolean;
  sort_weights?: string;
  constraints?: string;
  soft_constraints?: string;
  eval_weights?: string;
  temper_rules?: string;
}

export const configApi = {
  getSystemConfig: () => invoke<SystemConfig>('get_system_config'),

  updateSystemConfig: (group: string, key: string, value: string) =>
    invoke<void>('update_system_config', { group, key, value }),

  getShiftConfig: () => invoke<ShiftConfig[]>('get_shift_config'),

  updateShiftConfig: (shifts: ShiftConfig[]) => invoke<void>('update_shift_config', { shifts }),

  getPriorityWeightConfigs: () => invoke<PriorityWeightConfig[]>('get_priority_weight_configs'),

  upsertPriorityWeightConfigs: (inputs: PriorityWeightUpsertInput[]) =>
    invoke<PriorityWeightConfig[]>('upsert_priority_weight_configs', { inputs }),

  getPriorityDimensionConfigs: (dimensionType?: string) =>
    invoke<PriorityDimensionConfig[]>('get_priority_dimension_configs', { dimensionType }),

  upsertPriorityDimensionConfig: (input: PriorityDimensionUpsertInput) =>
    invoke<PriorityDimensionConfig>('upsert_priority_dimension_config', { input }),

  deletePriorityDimensionConfig: (id: number) =>
    invoke<void>('delete_priority_dimension_config', { id }),

  getCustomerPriorityConfigs: () =>
    invoke<CustomerPriorityConfig[]>('get_customer_priority_configs'),

  upsertCustomerPriorityConfig: (input: CustomerPriorityUpsertInput) =>
    invoke<CustomerPriorityConfig>('upsert_customer_priority_config', { input }),

  deleteCustomerPriorityConfig: (id: number) =>
    invoke<void>('delete_customer_priority_config', { id }),

  getBatchPriorityConfigs: () => invoke<BatchPriorityConfig[]>('get_batch_priority_configs'),

  upsertBatchPriorityConfig: (input: BatchPriorityUpsertInput) =>
    invoke<BatchPriorityConfig>('upsert_batch_priority_config', { input }),

  deleteBatchPriorityConfig: (id: number) => invoke<void>('delete_batch_priority_config', { id }),

  getProductTypePriorityConfigs: () =>
    invoke<ProductTypePriorityConfig[]>('get_product_type_priority_configs'),

  upsertProductTypePriorityConfig: (input: ProductTypePriorityUpsertInput) =>
    invoke<ProductTypePriorityConfig>('upsert_product_type_priority_config', { input }),

  deleteProductTypePriorityConfig: (id: number) =>
    invoke<void>('delete_product_type_priority_config', { id }),

  importPriorityConfigs: (filePath: string, dryRun?: boolean) =>
    invoke<PriorityConfigImportResult>('import_priority_configs', { filePath, dryRun }),

  exportPriorityConfigsCsv: (filePath: string) =>
    invoke<number>('export_priority_configs_csv', { filePath }),

  exportPriorityConfigsExcel: (filePath: string) =>
    invoke<number>('export_priority_configs_excel', { filePath }),

  exportPriorityConfigTemplateCsv: (filePath: string) =>
    invoke<number>('export_priority_config_template_csv', { filePath }),

  exportPriorityConfigTemplateExcel: (filePath: string) =>
    invoke<number>('export_priority_config_template_excel', { filePath }),

  getStrategyTemplates: () => invoke<StrategyTemplate[]>('get_strategy_templates'),

  createStrategyTemplate: (input: CreateStrategyInput) =>
    invoke<StrategyTemplate>('create_strategy_template', { input }),

  updateStrategyTemplate: (id: number, input: UpdateStrategyInput) =>
    invoke<StrategyTemplate>('update_strategy_template', { id, input }),

  deleteStrategyTemplate: (id: number) => invoke<void>('delete_strategy_template', { id }),

  setDefaultStrategy: (id: number) => invoke<StrategyTemplate>('set_default_strategy', { id }),

  exportStrategyTemplate: (id: number, filePath: string) =>
    invoke<void>('export_strategy_template', { id, filePath }),

  importStrategyTemplate: (filePath: string) =>
    invoke<StrategyTemplate>('import_strategy_template', { filePath }),

  getMaintenancePlans: () => invoke<MaintenancePlan[]>('get_maintenance_plans'),

  createMaintenancePlan: (input: CreateMaintenancePlanInput) =>
    invoke<MaintenancePlan>('create_maintenance_plan', { input }),

  updateMaintenancePlan: (id: number, input: UpdateMaintenancePlanInput) =>
    invoke<MaintenancePlan>('update_maintenance_plan', { id, input }),

  deleteMaintenancePlan: (id: number) => invoke<void>('delete_maintenance_plan', { id }),
};
