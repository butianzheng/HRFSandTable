import { useState, useEffect } from 'react';
import {
  Form,
  InputNumber,
  Switch,
  Button,
  message,
  Space,
  Typography,
  Input,
  Select,
  Card,
} from 'antd';
import { SaveOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import type { ConfigValue } from '../../types/config';
import { getErrorMessage } from '../../utils/error';
import type { ConfigFieldDef } from './types';

const { Text, Paragraph } = Typography;
const schedulerPresets: Record<string, Record<string, string | number | boolean>> = {
  bDefault: {
    mode: 'hybrid',
    beam_width: 10,
    beam_lookahead: 3,
    beam_top_k: 40,
    time_budget_ms: 120000,
    max_nodes: 200000,
    fallback_enabled: true,
  },
  bTuned: {
    mode: 'hybrid',
    beam_width: 12,
    beam_lookahead: 3,
    beam_top_k: 60,
    time_budget_ms: 90000,
    max_nodes: 300000,
    fallback_enabled: true,
  },
};
const schedulerImpactMap: Record<string, string> = {
  mode: 'hybrid 综合解质量和时效，beam 偏最优但更耗时，greedy 最快但最易产生局部次优。',
  beam_width: '增大可提高全局搜索能力与解质量上限，但内存/CPU 与求解时长同步上升。',
  beam_lookahead: '增大可减少短视决策，提升序列稳定性，但会显著增加搜索复杂度。',
  beam_top_k: '增大可降低错过可行候选的概率，但单步扩展成本会上升。',
  time_budget_ms: '增大可给 Beam 更多求解时间，结果更稳定；过小会更频繁触发贪心兜底。',
  max_nodes: '增大可放宽搜索空间，减少过早截断；过大可能拉长极端场景耗时。',
  fallback_enabled:
    '开启后超时/超节点自动退化到贪心，保障可用性；关闭后在 beam 模式下可能因超限提前结束。',
};
const schedulerUsageNotes = [
  '推荐默认使用 B（主）+A（超时兜底）思路：模式选 hybrid 且启用兜底。',
  '先调预算与节点上限，再调 beam_width / beam_top_k，最后再提高前瞻步数。',
  '数据量上升时优先保证可用性（兜底开启），避免仅追求 Beam 最优导致等待过长。',
  '调参后建议在计划工作台核对空档与跳跃风险，再决定是否持久化保存。',
];

export default function ConfigPanel({
  group,
  fields,
  config,
  onSave,
}: {
  group: string;
  fields: ConfigFieldDef[];
  config: Record<string, ConfigValue> | undefined;
  onSave: (group: string, key: string, value: string) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const writableFields = fields.filter((field) => !field.readOnly);
  const allReadOnly = writableFields.length === 0;

  const handlePickFolder = async (fieldKey: string) => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
        title: '选择备份目录',
      });
      if (!selected || Array.isArray(selected)) return;
      form.setFieldValue(fieldKey, selected);
    } catch (error: unknown) {
      message.error(`选择目录失败: ${getErrorMessage(error)}`);
    }
  };

  useEffect(() => {
    if (config) {
      const values: Record<string, unknown> = {};
      fields.forEach((f) => {
        const cv = config[f.key];
        if (cv) {
          if (f.type === 'boolean') {
            values[f.key] = cv.value === 'true';
          } else if (f.type === 'number') {
            values[f.key] = parseFloat(cv.value);
          } else {
            values[f.key] = cv.value;
          }
        }
      });
      form.setFieldsValue(values);
    }
  }, [config, fields, form]);

  const handleSave = async () => {
    if (allReadOnly) {
      message.info('该分组参数已归并到策略配置，请在策略配置中维护');
      return;
    }
    setSaving(true);
    try {
      const values = await form.validateFields();
      for (const field of writableFields) {
        const val = values[field.key];
        if (val !== undefined && val !== null) {
          const strVal = String(val);
          await onSave(group, field.key, strVal);
        }
      }
      message.success('保存成功');
    } catch (err) {
      console.error(err);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleApplySchedulerPreset = async (presetKey: 'bDefault' | 'bTuned') => {
    const presetValues = schedulerPresets[presetKey];
    setSaving(true);
    try {
      form.setFieldsValue(presetValues);
      for (const field of writableFields) {
        if (!Object.prototype.hasOwnProperty.call(presetValues, field.key)) {
          continue;
        }
        const value = presetValues[field.key];
        await onSave(group, field.key, String(value));
      }
      message.success(presetKey === 'bDefault' ? '已应用 B 默认预设' : '已应用 B 调优预设');
    } catch (err) {
      console.error(err);
      message.error('应用预设失败');
    } finally {
      setSaving(false);
    }
  };

  const buildFieldExtra = (field: ConfigFieldDef) => {
    const impact = group === 'scheduler' ? schedulerImpactMap[field.key] : undefined;
    return (
      <Space size={4} direction="vertical">
        <Space size={4}>
          {field.description && <Text type="secondary">{field.description}</Text>}
          {field.unit && <Text type="secondary">({field.unit})</Text>}
        </Space>
        {impact && <Text type="secondary">影响: {impact}</Text>}
        {field.readOnlyHint && <Text type="warning">说明: {field.readOnlyHint}</Text>}
      </Space>
    );
  };

  return (
    <div>
      {group === 'scheduler' && (
        <Card size="small" title="调度算法使用说明" style={{ marginBottom: 12 }}>
          <Paragraph style={{ marginBottom: 8 }}>
            调度建议优先使用 <Text strong>hybrid（Beam主 + 贪心兜底）</Text>。当数据规模较大或时限严格时，优先保证兜底开启以确保按时产出方案。
          </Paragraph>
          {schedulerUsageNotes.map((note, idx) => (
            <Paragraph key={`scheduler-note-${idx}`} style={{ marginBottom: 4 }}>
              {idx + 1}. {note}
            </Paragraph>
          ))}
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            可通过下方 <Text code>应用B默认</Text> / <Text code>应用B调优</Text> 快速套用建议参数，再按业务目标微调。
          </Paragraph>
        </Card>
      )}
      {allReadOnly && (
        <Paragraph style={{ marginTop: 4 }} type="secondary">
          该分组参数已归并到策略配置，不在设置中心生效。
        </Paragraph>
      )}

      <Form form={form} layout="horizontal" labelCol={{ span: 8 }} wrapperCol={{ span: 12 }}>
        {fields.map((field) => (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            extra={buildFieldExtra(field)}
            valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
          >
            {field.type === 'boolean' ? (
              <Switch disabled={field.readOnly} />
            ) : field.type === 'number' ? (
              <InputNumber
                min={field.min}
                max={field.max}
                style={{ width: 200 }}
                disabled={field.readOnly}
                step={field.key === 'avg_rhythm' || field.key === 'max_thickness_jump' ? 0.1 : 1}
              />
            ) : group === 'backup' && field.key === 'path' ? (
              <Space.Compact style={{ width: 420 }}>
                <Input
                  style={{ width: 280 }}
                  placeholder="留空使用默认路径"
                  disabled={field.readOnly}
                />
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={() => handlePickFolder(field.key)}
                  disabled={field.readOnly}
                >
                  选择
                </Button>
                <Button onClick={() => form.setFieldValue(field.key, '')} disabled={field.readOnly}>
                  清空
                </Button>
              </Space.Compact>
            ) : field.options && field.options.length > 0 ? (
              <Select style={{ width: 200 }} options={field.options} disabled={field.readOnly} />
            ) : (
              <Input style={{ width: 200 }} disabled={field.readOnly} />
            )}
          </Form.Item>
        ))}
        {group === 'scheduler' && (
          <Form.Item wrapperCol={{ offset: 8 }}>
            <Space>
              <Button onClick={() => void handleApplySchedulerPreset('bDefault')} loading={saving}>
                应用B默认
              </Button>
              <Button onClick={() => void handleApplySchedulerPreset('bTuned')} loading={saving}>
                应用B调优
              </Button>
            </Space>
          </Form.Item>
        )}
        <Form.Item wrapperCol={{ offset: 8 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={allReadOnly}
          >
            保存配置
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
