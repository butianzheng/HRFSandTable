import { memo } from 'react';
import { Modal, Form, Input, Switch, Row, Col, InputNumber, Tabs, Typography, Alert } from 'antd';
import type { FormInstance } from 'antd';
import type { SortPriority, HardConstraint, SoftConstraint, TemperRules } from '../../types/config';
import type { EvalWeight } from './types';
import { evalLabels } from './constants';
import SortWeightsEditor from './SortWeightsEditor';
import HardConstraintsEditor from './HardConstraintsEditor';
import SoftConstraintsEditor from './SoftConstraintsEditor';
import TemperRulesEditor from './TemperRulesEditor';

const { Text } = Typography;

export interface StrategyEditModalProps {
  open: boolean;
  editingId: number | null;
  form: FormInstance;
  onOk: () => Promise<void>;
  onCancel: () => void;
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
}

export default memo(function StrategyEditModal({
  open,
  editingId,
  form,
  onOk,
  onCancel,
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
}: StrategyEditModalProps) {
  return (
    <Modal
      title={editingId ? '编辑策略模板' : '新建策略模板'}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      width={900}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="模板名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder="如：宽幅板优先策略" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="描述">
              <Input placeholder="可选" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="set_as_default" label="设为默认模板" valuePropName="checked">
          <Switch size="small" />
        </Form.Item>
      </Form>

      <Tabs
        defaultActiveKey="sort"
        items={[
          {
            key: 'sort',
            label: '排序权重',
            children: <SortWeightsEditor value={sortWeights} onChange={setSortWeights} />,
          },
          {
            key: 'hard',
            label: '硬约束',
            children: (
              <HardConstraintsEditor value={hardConstraints} onChange={setHardConstraints} />
            ),
          },
          {
            key: 'soft',
            label: '软约束',
            children: (
              <SoftConstraintsEditor value={softConstraints} onChange={setSoftConstraints} />
            ),
          },
          {
            key: 'eval',
            label: '评估权重',
            children: (
              <div>
                {Object.entries(evalWeights).map(([k, v]) => (
                  <Row key={k} gutter={8} style={{ marginBottom: 8 }} align="middle">
                    <Col span={8}>
                      <Text>{evalLabels[k] || k}</Text>
                    </Col>
                    <Col span={8}>
                      <InputNumber
                        size="small"
                        min={0}
                        max={100}
                        value={v.weight}
                        addonAfter="%"
                        style={{ width: '100%' }}
                        onChange={(val) => {
                          setEvalWeights({
                            ...evalWeights,
                            [k]: { ...v, weight: val ?? 0 },
                          });
                        }}
                      />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">{v.description || ''}</Text>
                    </Col>
                  </Row>
                ))}
              </div>
            ),
          },
          {
            key: 'temper',
            label: '适温规则',
            children: (
              <div>
                <Alert
                  showIcon
                  type="info"
                  style={{ marginBottom: 8 }}
                  title="适温参数已归并到设置中心 > 适温参数，策略配置中仅展示。"
                />
                <TemperRulesEditor value={temperRules} onChange={setTemperRules} readOnly />
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
});
