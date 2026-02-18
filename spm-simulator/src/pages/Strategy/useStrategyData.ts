import { useState, useEffect, useCallback } from 'react';
import type { FormInstance } from 'antd';
import { message } from 'antd';
import { open, save } from '@tauri-apps/plugin-dialog';
import dayjs from 'dayjs';
import { configApi } from '../../services/configApi';
import type {
  StrategyTemplate,
  SortPriority,
  HardConstraint,
  SoftConstraint,
  TemperRules,
} from '../../types/config';
import { getErrorMessage } from '../../utils/error';
import type { EvalWeight } from './types';
import { createDefaultTemperRules } from './constants';
import { validateStrategy } from './validateStrategy';

export interface UseStrategyDataParams {
  form: FormInstance;
}

export interface UseStrategyDataReturn {
  templates: StrategyTemplate[];
  loading: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  selected: StrategyTemplate | null;
  modalOpen: boolean;
  editingId: number | null;
  // edit state
  sortWeights: SortPriority[];
  setSortWeights: (v: SortPriority[]) => void;
  hardConstraints: HardConstraint[];
  setHardConstraints: (v: HardConstraint[]) => void;
  softConstraints: SoftConstraint[];
  setSoftConstraints: (v: SoftConstraint[]) => void;
  evalWeights: Record<string, EvalWeight>;
  setEvalWeights: (v: Record<string, EvalWeight>) => void;
  temperRules: TemperRules;
  setTemperRules: (v: TemperRules) => void;
  // actions
  handleCreate: () => void;
  handleEdit: (t: StrategyTemplate) => void;
  handleDuplicate: (t: StrategyTemplate) => void;
  handleDelete: (id: number) => Promise<void>;
  handleSetDefault: (id: number) => Promise<void>;
  handleSave: () => Promise<void>;
  handleExportTemplate: () => Promise<void>;
  handleImportTemplate: () => Promise<void>;
  closeModal: () => void;
  // readonly parsed
  selectedSortWeights: SortPriority[];
  selectedHardConstraints: HardConstraint[];
  selectedSoftConstraints: SoftConstraint[];
  selectedEvalWeights: Record<string, EvalWeight>;
  selectedTemperRules: TemperRules | null;
}

export function useStrategyData({ form }: UseStrategyDataParams): UseStrategyDataReturn {
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [sortWeights, setSortWeights] = useState<SortPriority[]>([]);
  const [hardConstraints, setHardConstraints] = useState<HardConstraint[]>([]);
  const [softConstraints, setSoftConstraints] = useState<SoftConstraint[]>([]);
  const [evalWeights, setEvalWeights] = useState<Record<string, EvalWeight>>({});
  const [temperRules, setTemperRules] = useState<TemperRules>(createDefaultTemperRules());

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await configApi.getStrategyTemplates();
      setTemplates(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      message.error('加载策略模板失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const parseTemplate = (t: StrategyTemplate) => {
    try {
      setSortWeights(JSON.parse(t.sort_weights).priorities || []);
    } catch {
      setSortWeights([]);
    }
    try {
      setHardConstraints(JSON.parse(t.constraints).constraints || []);
    } catch {
      setHardConstraints([]);
    }
    try {
      setSoftConstraints(JSON.parse(t.soft_constraints || '{"constraints":[]}').constraints || []);
    } catch {
      setSoftConstraints([]);
    }
    try {
      setEvalWeights(JSON.parse(t.eval_weights).weights || {});
    } catch {
      setEvalWeights({});
    }
    try {
      setTemperRules(JSON.parse(t.temper_rules));
    } catch {
      setTemperRules(createDefaultTemperRules());
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ name: '', description: '' });
    const defaultTpl = templates.find((t) => t.is_default) ?? templates.find((t) => t.is_system);
    if (defaultTpl) {
      parseTemplate(defaultTpl);
    } else {
      setSortWeights([]);
      setHardConstraints([]);
      setSoftConstraints([]);
      setEvalWeights({});
      setTemperRules(createDefaultTemperRules());
    }
    form.setFieldValue('set_as_default', false);
    setModalOpen(true);
  };

  const handleEdit = (t: StrategyTemplate) => {
    setEditingId(t.id);
    form.setFieldsValue({
      name: t.name,
      description: t.description || '',
      set_as_default: Boolean(t.is_default),
    });
    parseTemplate(t);
    setModalOpen(true);
  };

  const handleDuplicate = (t: StrategyTemplate) => {
    setEditingId(null);
    form.setFieldsValue({
      name: `${t.name} - 副本`,
      description: t.description || '',
      set_as_default: false,
    });
    parseTemplate(t);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await configApi.deleteStrategyTemplate(id);
      message.success('删除成功');
      if (selectedId === id) setSelectedId(null);
      fetchTemplates();
    } catch (err) {
      message.error('删除失败');
      console.error(err);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const result = await configApi.setDefaultStrategy(id);
      message.success(`已设为默认策略: ${result.name}`);
      await fetchTemplates();
      setSelectedId(result.id);
    } catch (error: unknown) {
      message.error(`设置默认失败: ${getErrorMessage(error)}`);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (
        !validateStrategy({
          sortWeights,
          hardConstraints,
          softConstraints,
          evalWeights,
          temperRules,
        })
      ) {
        return;
      }

      const payload = {
        name: values.name,
        description: values.description,
        sort_weights: JSON.stringify({ priorities: sortWeights }),
        constraints: JSON.stringify({ constraints: hardConstraints }),
        soft_constraints: JSON.stringify({ constraints: softConstraints }),
        eval_weights: JSON.stringify({ weights: evalWeights }),
        temper_rules: JSON.stringify(temperRules ?? createDefaultTemperRules()),
      };

      let saved: StrategyTemplate;
      if (editingId) {
        saved = await configApi.updateStrategyTemplate(editingId, payload);
      } else {
        saved = await configApi.createStrategyTemplate(payload);
      }
      if (values.set_as_default) {
        saved = await configApi.setDefaultStrategy(saved.id);
      }

      message.success(editingId ? '更新成功' : '创建成功');
      setModalOpen(false);
      await fetchTemplates();
      setSelectedId(saved.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportTemplate = async () => {
    if (!selected) {
      message.warning('请先选择一个策略模板');
      return;
    }
    try {
      const filePath = await save({
        defaultPath: `策略模板_${selected.name}_${dayjs().format('YYYYMMDD_HHmmss')}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!filePath) return;
      await configApi.exportStrategyTemplate(selected.id, filePath);
      message.success('策略模板导出成功');
    } catch (error: unknown) {
      message.error(`导出失败: ${getErrorMessage(error)}`);
    }
  };

  const handleImportTemplate = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!filePath || Array.isArray(filePath)) return;
      const imported = await configApi.importStrategyTemplate(filePath);
      message.success(`导入成功: ${imported.name}`);
      await fetchTemplates();
      setSelectedId(imported.id);
    } catch (error: unknown) {
      message.error(`导入失败: ${getErrorMessage(error)}`);
    }
  };

  const safeParse = <T>(json: string | undefined, fallback: T): T => {
    try {
      return JSON.parse(json || '') ?? fallback;
    } catch {
      return fallback;
    }
  };

  const selectedSortWeights: SortPriority[] =
    safeParse(selected?.sort_weights, { priorities: [] }).priorities ?? [];
  const selectedHardConstraints: HardConstraint[] =
    safeParse(selected?.constraints, { constraints: [] }).constraints ?? [];
  const selectedSoftConstraints: SoftConstraint[] =
    safeParse(selected?.soft_constraints, { constraints: [] }).constraints ?? [];
  const selectedEvalWeights: Record<string, EvalWeight> =
    safeParse(selected?.eval_weights, { weights: {} }).weights ?? {};
  const selectedTemperRules = safeParse<TemperRules | null>(selected?.temper_rules, null);

  return {
    templates,
    loading,
    selectedId,
    setSelectedId,
    selected,
    modalOpen,
    editingId,
    sortWeights,
    setSortWeights,
    hardConstraints,
    setHardConstraints,
    softConstraints,
    setSoftConstraints,
    evalWeights,
    setEvalWeights,
    temperRules,
    setTemperRules,
    handleCreate,
    handleEdit,
    handleDuplicate,
    handleDelete,
    handleSetDefault,
    handleSave,
    handleExportTemplate,
    handleImportTemplate,
    closeModal: () => setModalOpen(false),
    selectedSortWeights,
    selectedHardConstraints,
    selectedSoftConstraints,
    selectedEvalWeights,
    selectedTemperRules,
  };
}
