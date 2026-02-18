import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configApi } from './configApi';
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

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('configApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('System Config', () => {
    describe('getSystemConfig', () => {
      it('应该调用 get_system_config 命令', async () => {
        const mockConfig: SystemConfig = { id: 1 } as SystemConfig;
        vi.mocked(invoke).mockResolvedValue(mockConfig);

        const result = await configApi.getSystemConfig();

        expect(invoke).toHaveBeenCalledWith('get_system_config');
        expect(result).toEqual(mockConfig);
      });
    });

    describe('updateSystemConfig', () => {
      it('应该调用 update_system_config 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.updateSystemConfig('performance', 'max_width_jump', '100');

        expect(invoke).toHaveBeenCalledWith('update_system_config', {
          group: 'performance',
          key: 'max_width_jump',
          value: '100',
        });
      });
    });
  });

  describe('Shift Config', () => {
    describe('getShiftConfig', () => {
      it('应该调用 get_shift_config 命令', async () => {
        const mockShifts: ShiftConfig[] = [{ id: 1, name: 'Shift 1' } as ShiftConfig];
        vi.mocked(invoke).mockResolvedValue(mockShifts);

        const result = await configApi.getShiftConfig();

        expect(invoke).toHaveBeenCalledWith('get_shift_config');
        expect(result).toEqual(mockShifts);
      });
    });

    describe('updateShiftConfig', () => {
      it('应该调用 update_shift_config 命令', async () => {
        const shifts: ShiftConfig[] = [{ id: 1, name: 'Shift 1' } as ShiftConfig];
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.updateShiftConfig(shifts);

        expect(invoke).toHaveBeenCalledWith('update_shift_config', { shifts });
      });
    });
  });

  describe('Priority Weight Config', () => {
    describe('getPriorityWeightConfigs', () => {
      it('应该调用 get_priority_weight_configs 命令', async () => {
        const mockConfigs: PriorityWeightConfig[] = [
          { id: 1, dimension_type: 'contract' } as PriorityWeightConfig,
        ];
        vi.mocked(invoke).mockResolvedValue(mockConfigs);

        const result = await configApi.getPriorityWeightConfigs();

        expect(invoke).toHaveBeenCalledWith('get_priority_weight_configs');
        expect(result).toEqual(mockConfigs);
      });
    });

    describe('upsertPriorityWeightConfigs', () => {
      it('应该调用 upsert_priority_weight_configs 命令', async () => {
        const inputs: PriorityWeightUpsertInput[] = [
          { dimension_type: 'contract', weight: 10 } as PriorityWeightUpsertInput,
        ];
        const mockConfigs: PriorityWeightConfig[] = [
          { id: 1, dimension_type: 'contract' } as PriorityWeightConfig,
        ];
        vi.mocked(invoke).mockResolvedValue(mockConfigs);

        const result = await configApi.upsertPriorityWeightConfigs(inputs);

        expect(invoke).toHaveBeenCalledWith('upsert_priority_weight_configs', { inputs });
        expect(result).toEqual(mockConfigs);
      });
    });
  });

  describe('Priority Dimension Config', () => {
    describe('getPriorityDimensionConfigs', () => {
      it('应该调用 get_priority_dimension_configs 命令', async () => {
        const mockConfigs: PriorityDimensionConfig[] = [
          { id: 1, dimension_type: 'contract' } as PriorityDimensionConfig,
        ];
        vi.mocked(invoke).mockResolvedValue(mockConfigs);

        const result = await configApi.getPriorityDimensionConfigs('contract');

        expect(invoke).toHaveBeenCalledWith('get_priority_dimension_configs', {
          dimensionType: 'contract',
        });
        expect(result).toEqual(mockConfigs);
      });
    });

    describe('upsertPriorityDimensionConfig', () => {
      it('应该调用 upsert_priority_dimension_config 命令', async () => {
        const input: PriorityDimensionUpsertInput = {
          dimension_type: 'contract',
        } as PriorityDimensionUpsertInput;
        const mockConfig: PriorityDimensionConfig = {
          id: 1,
          dimension_type: 'contract',
        } as PriorityDimensionConfig;
        vi.mocked(invoke).mockResolvedValue(mockConfig);

        const result = await configApi.upsertPriorityDimensionConfig(input);

        expect(invoke).toHaveBeenCalledWith('upsert_priority_dimension_config', { input });
        expect(result).toEqual(mockConfig);
      });
    });

    describe('deletePriorityDimensionConfig', () => {
      it('应该调用 delete_priority_dimension_config 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.deletePriorityDimensionConfig(1);

        expect(invoke).toHaveBeenCalledWith('delete_priority_dimension_config', { id: 1 });
      });
    });
  });

  describe('Customer Priority Config', () => {
    describe('getCustomerPriorityConfigs', () => {
      it('应该调用 get_customer_priority_configs 命令', async () => {
        const mockConfigs: CustomerPriorityConfig[] = [
          { id: 1, customer_code: 'C001' } as CustomerPriorityConfig,
        ];
        vi.mocked(invoke).mockResolvedValue(mockConfigs);

        const result = await configApi.getCustomerPriorityConfigs();

        expect(invoke).toHaveBeenCalledWith('get_customer_priority_configs');
        expect(result).toEqual(mockConfigs);
      });
    });

    describe('upsertCustomerPriorityConfig', () => {
      it('应该调用 upsert_customer_priority_config 命令', async () => {
        const input: CustomerPriorityUpsertInput = {
          customer_code: 'C001',
        } as CustomerPriorityUpsertInput;
        const mockConfig: CustomerPriorityConfig = {
          id: 1,
          customer_code: 'C001',
        } as CustomerPriorityConfig;
        vi.mocked(invoke).mockResolvedValue(mockConfig);

        const result = await configApi.upsertCustomerPriorityConfig(input);

        expect(invoke).toHaveBeenCalledWith('upsert_customer_priority_config', { input });
        expect(result).toEqual(mockConfig);
      });
    });

    describe('deleteCustomerPriorityConfig', () => {
      it('应该调用 delete_customer_priority_config 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.deleteCustomerPriorityConfig(1);

        expect(invoke).toHaveBeenCalledWith('delete_customer_priority_config', { id: 1 });
      });
    });
  });

  describe('Batch Priority Config', () => {
    describe('getBatchPriorityConfigs', () => {
      it('应该调用 get_batch_priority_configs 命令', async () => {
        const mockConfigs: BatchPriorityConfig[] = [
          { id: 1, batch_no: 'B001' } as BatchPriorityConfig,
        ];
        vi.mocked(invoke).mockResolvedValue(mockConfigs);

        const result = await configApi.getBatchPriorityConfigs();

        expect(invoke).toHaveBeenCalledWith('get_batch_priority_configs');
        expect(result).toEqual(mockConfigs);
      });
    });

    describe('upsertBatchPriorityConfig', () => {
      it('应该调用 upsert_batch_priority_config 命令', async () => {
        const input: BatchPriorityUpsertInput = {
          batch_no: 'B001',
        } as BatchPriorityUpsertInput;
        const mockConfig: BatchPriorityConfig = {
          id: 1,
          batch_no: 'B001',
        } as BatchPriorityConfig;
        vi.mocked(invoke).mockResolvedValue(mockConfig);

        const result = await configApi.upsertBatchPriorityConfig(input);

        expect(invoke).toHaveBeenCalledWith('upsert_batch_priority_config', { input });
        expect(result).toEqual(mockConfig);
      });
    });

    describe('deleteBatchPriorityConfig', () => {
      it('应该调用 delete_batch_priority_config 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.deleteBatchPriorityConfig(1);

        expect(invoke).toHaveBeenCalledWith('delete_batch_priority_config', { id: 1 });
      });
    });
  });

  describe('Product Type Priority Config', () => {
    describe('getProductTypePriorityConfigs', () => {
      it('应该调用 get_product_type_priority_configs 命令', async () => {
        const mockConfigs: ProductTypePriorityConfig[] = [
          { id: 1, product_type: 'P001' } as ProductTypePriorityConfig,
        ];
        vi.mocked(invoke).mockResolvedValue(mockConfigs);

        const result = await configApi.getProductTypePriorityConfigs();

        expect(invoke).toHaveBeenCalledWith('get_product_type_priority_configs');
        expect(result).toEqual(mockConfigs);
      });
    });

    describe('upsertProductTypePriorityConfig', () => {
      it('应该调用 upsert_product_type_priority_config 命令', async () => {
        const input: ProductTypePriorityUpsertInput = {
          product_type: 'P001',
        } as ProductTypePriorityUpsertInput;
        const mockConfig: ProductTypePriorityConfig = {
          id: 1,
          product_type: 'P001',
        } as ProductTypePriorityConfig;
        vi.mocked(invoke).mockResolvedValue(mockConfig);

        const result = await configApi.upsertProductTypePriorityConfig(input);

        expect(invoke).toHaveBeenCalledWith('upsert_product_type_priority_config', { input });
        expect(result).toEqual(mockConfig);
      });
    });

    describe('deleteProductTypePriorityConfig', () => {
      it('应该调用 delete_product_type_priority_config 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.deleteProductTypePriorityConfig(1);

        expect(invoke).toHaveBeenCalledWith('delete_product_type_priority_config', { id: 1 });
      });
    });
  });

  describe('Priority Config Import/Export', () => {
    describe('importPriorityConfigs', () => {
      it('应该调用 import_priority_configs 命令', async () => {
        const mockResult: PriorityConfigImportResult = {
          success: true,
          imported: 10,
        };
        vi.mocked(invoke).mockResolvedValue(mockResult);

        const result = await configApi.importPriorityConfigs('/path/to/file.xlsx', true);

        expect(invoke).toHaveBeenCalledWith('import_priority_configs', {
          filePath: '/path/to/file.xlsx',
          dryRun: true,
        });
        expect(result).toEqual(mockResult);
      });
    });

    describe('exportPriorityConfigsCsv', () => {
      it('应该调用 export_priority_configs_csv 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(100);

        const result = await configApi.exportPriorityConfigsCsv('/path/to/export.csv');

        expect(invoke).toHaveBeenCalledWith('export_priority_configs_csv', {
          filePath: '/path/to/export.csv',
        });
        expect(result).toBe(100);
      });
    });

    describe('exportPriorityConfigsExcel', () => {
      it('应该调用 export_priority_configs_excel 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(100);

        const result = await configApi.exportPriorityConfigsExcel('/path/to/export.xlsx');

        expect(invoke).toHaveBeenCalledWith('export_priority_configs_excel', {
          filePath: '/path/to/export.xlsx',
        });
        expect(result).toBe(100);
      });
    });

    describe('exportPriorityConfigTemplateCsv', () => {
      it('应该调用 export_priority_config_template_csv 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(50);

        const result = await configApi.exportPriorityConfigTemplateCsv('/path/to/template.csv');

        expect(invoke).toHaveBeenCalledWith('export_priority_config_template_csv', {
          filePath: '/path/to/template.csv',
        });
        expect(result).toBe(50);
      });
    });

    describe('exportPriorityConfigTemplateExcel', () => {
      it('应该调用 export_priority_config_template_excel 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(50);

        const result = await configApi.exportPriorityConfigTemplateExcel('/path/to/template.xlsx');

        expect(invoke).toHaveBeenCalledWith('export_priority_config_template_excel', {
          filePath: '/path/to/template.xlsx',
        });
        expect(result).toBe(50);
      });
    });
  });

  describe('Strategy Template', () => {
    describe('getStrategyTemplates', () => {
      it('应该调用 get_strategy_templates 命令', async () => {
        const mockTemplates: StrategyTemplate[] = [
          { id: 1, name: 'Template 1' } as StrategyTemplate,
        ];
        vi.mocked(invoke).mockResolvedValue(mockTemplates);

        const result = await configApi.getStrategyTemplates();

        expect(invoke).toHaveBeenCalledWith('get_strategy_templates');
        expect(result).toEqual(mockTemplates);
      });
    });

    describe('createStrategyTemplate', () => {
      it('应该调用 create_strategy_template 命令', async () => {
        const input = {
          name: 'New Strategy',
          sort_weights: '{}',
          constraints: '{}',
          eval_weights: '{}',
          temper_rules: '{}',
        };
        const mockTemplate: StrategyTemplate = {
          id: 1,
          name: 'New Strategy',
        } as StrategyTemplate;
        vi.mocked(invoke).mockResolvedValue(mockTemplate);

        const result = await configApi.createStrategyTemplate(input);

        expect(invoke).toHaveBeenCalledWith('create_strategy_template', { input });
        expect(result).toEqual(mockTemplate);
      });
    });

    describe('updateStrategyTemplate', () => {
      it('应该调用 update_strategy_template 命令', async () => {
        const input = { name: 'Updated Strategy' };
        const mockTemplate: StrategyTemplate = {
          id: 1,
          name: 'Updated Strategy',
        } as StrategyTemplate;
        vi.mocked(invoke).mockResolvedValue(mockTemplate);

        const result = await configApi.updateStrategyTemplate(1, input);

        expect(invoke).toHaveBeenCalledWith('update_strategy_template', { id: 1, input });
        expect(result).toEqual(mockTemplate);
      });
    });

    describe('deleteStrategyTemplate', () => {
      it('应该调用 delete_strategy_template 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.deleteStrategyTemplate(1);

        expect(invoke).toHaveBeenCalledWith('delete_strategy_template', { id: 1 });
      });
    });

    describe('setDefaultStrategy', () => {
      it('应该调用 set_default_strategy 命令', async () => {
        const mockTemplate: StrategyTemplate = {
          id: 1,
          is_default: true,
        } as StrategyTemplate;
        vi.mocked(invoke).mockResolvedValue(mockTemplate);

        const result = await configApi.setDefaultStrategy(1);

        expect(invoke).toHaveBeenCalledWith('set_default_strategy', { id: 1 });
        expect(result).toEqual(mockTemplate);
      });
    });

    describe('exportStrategyTemplate', () => {
      it('应该调用 export_strategy_template 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.exportStrategyTemplate(1, '/path/to/export.json');

        expect(invoke).toHaveBeenCalledWith('export_strategy_template', {
          id: 1,
          filePath: '/path/to/export.json',
        });
      });
    });

    describe('importStrategyTemplate', () => {
      it('应该调用 import_strategy_template 命令', async () => {
        const mockTemplate: StrategyTemplate = {
          id: 1,
          name: 'Imported Strategy',
        } as StrategyTemplate;
        vi.mocked(invoke).mockResolvedValue(mockTemplate);

        const result = await configApi.importStrategyTemplate('/path/to/import.json');

        expect(invoke).toHaveBeenCalledWith('import_strategy_template', {
          filePath: '/path/to/import.json',
        });
        expect(result).toEqual(mockTemplate);
      });
    });
  });

  describe('Maintenance Plan', () => {
    describe('getMaintenancePlans', () => {
      it('应该调用 get_maintenance_plans 命令', async () => {
        const mockPlans: MaintenancePlan[] = [{ id: 1, name: 'Plan 1' } as MaintenancePlan];
        vi.mocked(invoke).mockResolvedValue(mockPlans);

        const result = await configApi.getMaintenancePlans();

        expect(invoke).toHaveBeenCalledWith('get_maintenance_plans');
        expect(result).toEqual(mockPlans);
      });
    });

    describe('createMaintenancePlan', () => {
      it('应该调用 create_maintenance_plan 命令', async () => {
        const input: CreateMaintenancePlanInput = {
          name: 'New Plan',
        } as CreateMaintenancePlanInput;
        const mockPlan: MaintenancePlan = {
          id: 1,
          name: 'New Plan',
        } as MaintenancePlan;
        vi.mocked(invoke).mockResolvedValue(mockPlan);

        const result = await configApi.createMaintenancePlan(input);

        expect(invoke).toHaveBeenCalledWith('create_maintenance_plan', { input });
        expect(result).toEqual(mockPlan);
      });
    });

    describe('updateMaintenancePlan', () => {
      it('应该调用 update_maintenance_plan 命令', async () => {
        const input: UpdateMaintenancePlanInput = {
          name: 'Updated Plan',
        } as UpdateMaintenancePlanInput;
        const mockPlan: MaintenancePlan = {
          id: 1,
          name: 'Updated Plan',
        } as MaintenancePlan;
        vi.mocked(invoke).mockResolvedValue(mockPlan);

        const result = await configApi.updateMaintenancePlan(1, input);

        expect(invoke).toHaveBeenCalledWith('update_maintenance_plan', { id: 1, input });
        expect(result).toEqual(mockPlan);
      });
    });

    describe('deleteMaintenancePlan', () => {
      it('应该调用 delete_maintenance_plan 命令', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await configApi.deleteMaintenancePlan(1);

        expect(invoke).toHaveBeenCalledWith('delete_maintenance_plan', { id: 1 });
      });
    });
  });
});
