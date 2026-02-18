import {
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Row,
  Col,
  Card,
  Space,
  Button,
  Select,
  Alert,
} from 'antd';
import type { FormInstance } from 'antd';
import { PlusOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { ExportTemplateFormValues } from './exportTemplateUtils';
import { allExportFieldOptions } from './exportTemplateUtils';

interface ExportTemplateFormModalProps {
  open: boolean;
  editingTemplate: { id: number } | null;
  templateForm: FormInstance<ExportTemplateFormValues>;
  templateSubmitting: boolean;
  dragColumnIndex: number | null;
  dragOverColumnIndex: number | null;
  dragRuleIndex: number | null;
  dragOverRuleIndex: number | null;
  columnsPreview: string | undefined;
  formatFieldOptions: Array<{ value: string; label: string }>;
  formatRulesPreview: string | undefined;
  columnConflictMessages: string[];
  ruleConflictMessages: string[];
  onClose: () => void;
  onSave: () => void;
  setDragColumnIndex: (v: number | null) => void;
  setDragOverColumnIndex: (v: number | null) => void;
  setDragRuleIndex: (v: number | null) => void;
  setDragOverRuleIndex: (v: number | null) => void;
}

export default function ExportTemplateFormModal({
  open,
  editingTemplate,
  templateForm,
  templateSubmitting,
  dragColumnIndex,
  dragOverColumnIndex,
  dragRuleIndex,
  dragOverRuleIndex,
  columnsPreview,
  formatFieldOptions,
  formatRulesPreview,
  columnConflictMessages,
  ruleConflictMessages,
  onClose,
  onSave,
  setDragColumnIndex,
  setDragOverColumnIndex,
  setDragRuleIndex,
  setDragOverRuleIndex,
}: ExportTemplateFormModalProps) {
  return (
    <Modal
      title={editingTemplate ? '编辑导出模板' : '新建导出模板'}
      open={open}
      onCancel={onClose}
      onOk={onSave}
      confirmLoading={templateSubmitting}
      width={720}
    >
      <Form layout="vertical" form={templateForm} initialValues={{ is_default: false }}>
        <Form.Item
          label="模板名称"
          name="name"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label="导出列配置（可视化）">
          <Form.List name="column_items">
            {(fields, { add, remove, move }) => (
              <>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 8 }}
                  onClick={() => add({ key: allExportFieldOptions[0]?.value, enabled: true })}
                >
                  新增列
                </Button>
                {fields.length > 0 && (
                  <div style={{ color: '#999', marginBottom: 8 }}>
                    提示: 可直接拖拽列卡片调整导出顺序
                  </div>
                )}
                {fields.length === 0 && (
                  <div style={{ color: '#999', marginBottom: 8 }}>
                    未配置导出列，请新增后再保存。
                  </div>
                )}
                {fields.map((field, index) => (
                  <ColumnItemCard
                    key={field.key}
                    field={field}
                    index={index}
                    fieldsLength={fields.length}
                    dragColumnIndex={dragColumnIndex}
                    dragOverColumnIndex={dragOverColumnIndex}
                    setDragColumnIndex={setDragColumnIndex}
                    setDragOverColumnIndex={setDragOverColumnIndex}
                    move={move}
                    remove={remove}
                  />
                ))}
              </>
            )}
          </Form.List>
        </Form.Item>
        {columnConflictMessages.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="列配置冲突提示"
            description={columnConflictMessages.join('；')}
          />
        )}
        <Form.Item label="列配置预览(JSON)">
          <Input.TextArea rows={6} value={columnsPreview || ''} readOnly />
        </Form.Item>
        <Form.Item label="高级列JSON（可选，优先级低于可视化）" name="columns">
          <Input.TextArea rows={4} placeholder='例如: ["coil_id","steel_grade","width"]' />
        </Form.Item>
        <Form.Item label="格式规则（可视化，可选）">
          <Form.List name="format_rule_items">
            {(fields, { add, remove, move }) => (
              <>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 8 }}
                  onClick={() => add({ field: formatFieldOptions[0]?.value || 'weight' })}
                >
                  新增规则
                </Button>
                {fields.length > 0 && (
                  <div style={{ color: '#999', marginBottom: 8 }}>
                    提示: 可直接拖拽规则卡片调整顺序
                  </div>
                )}
                {fields.length === 0 && (
                  <div style={{ color: '#999', marginBottom: 8 }}>
                    未配置格式规则，导出将使用默认显示。
                  </div>
                )}
                {fields.map((field, index) => (
                  <RuleItemCard
                    key={field.key}
                    field={field}
                    index={index}
                    dragRuleIndex={dragRuleIndex}
                    dragOverRuleIndex={dragOverRuleIndex}
                    setDragRuleIndex={setDragRuleIndex}
                    setDragOverRuleIndex={setDragOverRuleIndex}
                    formatFieldOptions={formatFieldOptions}
                    move={move}
                    remove={remove}
                  />
                ))}
              </>
            )}
          </Form.List>
        </Form.Item>
        {ruleConflictMessages.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="规则配置冲突提示"
            description={ruleConflictMessages.join('；')}
          />
        )}
        <Form.Item label="规则预览(JSON)">
          <Input.TextArea rows={5} value={formatRulesPreview || ''} readOnly />
        </Form.Item>
        <Form.Item label="高级JSON（可选，优先级低���可视化）" name="format_rules">
          <Input.TextArea rows={4} placeholder='例如: {"weight":{"digits":2}}' />
        </Form.Item>
        <Form.Item label="设为默认模板" name="is_default" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── 列配置卡片 ───
interface ColumnItemCardProps {
  field: { key: number; name: number };
  index: number;
  fieldsLength: number;
  dragColumnIndex: number | null;
  dragOverColumnIndex: number | null;
  setDragColumnIndex: (v: number | null) => void;
  setDragOverColumnIndex: (v: number | null) => void;
  move: (from: number, to: number) => void;
  remove: (name: number) => void;
}

function ColumnItemCard({
  field,
  index,
  fieldsLength,
  dragColumnIndex,
  dragOverColumnIndex,
  setDragColumnIndex,
  setDragOverColumnIndex,
  move,
  remove,
}: ColumnItemCardProps) {
  return (
    <div
      draggable
      onDragStart={() => {
        setDragColumnIndex(index);
        setDragOverColumnIndex(index);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (dragColumnIndex === null || dragColumnIndex === index) return;
        setDragOverColumnIndex(index);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (dragColumnIndex === null || dragColumnIndex === index) return;
        setDragOverColumnIndex(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (dragColumnIndex === null) return;
        if (dragColumnIndex !== index) {
          move(dragColumnIndex, index);
        }
        setDragColumnIndex(null);
        setDragOverColumnIndex(null);
      }}
      onDragEnd={() => {
        setDragColumnIndex(null);
        setDragOverColumnIndex(null);
      }}
      style={{ marginBottom: 8 }}
    >
      <Card
        size="small"
        style={{
          borderColor: dragOverColumnIndex === index ? '#1677ff' : undefined,
          cursor: 'grab',
        }}
      >
        <Row gutter={8}>
          <Col span={7}>
            <Form.Item
              label="字段"
              name={[field.name, 'key']}
              rules={[{ required: true, message: '请选择字段' }]}
              style={{ marginBottom: 8 }}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={allExportFieldOptions}
                placeholder="选择字段"
              />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item label="列标题" name={[field.name, 'title']} style={{ marginBottom: 8 }}>
              <Input maxLength={24} placeholder="为空则使用默认标题" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item
              label="启用"
              name={[field.name, 'enabled']}
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Space style={{ marginTop: 30 }}>
              <Button
                icon={<ArrowUpOutlined />}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              />
              <Button
                icon={<ArrowDownOutlined />}
                disabled={index === fieldsLength - 1}
                onClick={() => move(index, index + 1)}
              />
              <Button danger onClick={() => remove(field.name)}>
                删除
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

// ─── 规则配置卡片 ───
interface RuleItemCardProps {
  field: { key: number; name: number };
  index: number;
  dragRuleIndex: number | null;
  dragOverRuleIndex: number | null;
  setDragRuleIndex: (v: number | null) => void;
  setDragOverRuleIndex: (v: number | null) => void;
  formatFieldOptions: Array<{ value: string; label: string }>;
  move: (from: number, to: number) => void;
  remove: (name: number) => void;
}

function RuleItemCard({
  field,
  index,
  dragRuleIndex,
  dragOverRuleIndex,
  setDragRuleIndex,
  setDragOverRuleIndex,
  formatFieldOptions,
  move,
  remove,
}: RuleItemCardProps) {
  return (
    <div
      draggable
      onDragStart={() => {
        setDragRuleIndex(index);
        setDragOverRuleIndex(index);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (dragRuleIndex === null || dragRuleIndex === index) return;
        setDragOverRuleIndex(index);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (dragRuleIndex === null || dragRuleIndex === index) return;
        setDragOverRuleIndex(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (dragRuleIndex === null) return;
        if (dragRuleIndex !== index) {
          move(dragRuleIndex, index);
        }
        setDragRuleIndex(null);
        setDragOverRuleIndex(null);
      }}
      onDragEnd={() => {
        setDragRuleIndex(null);
        setDragOverRuleIndex(null);
      }}
      style={{ marginBottom: 8 }}
    >
      <Card
        size="small"
        style={{
          borderColor: dragOverRuleIndex === index ? '#1677ff' : undefined,
          cursor: 'grab',
        }}
      >
        <Row gutter={8}>
          <Col span={6}>
            <Form.Item
              label="字段"
              name={[field.name, 'field']}
              rules={[{ required: true, message: '请选择字段' }]}
              style={{ marginBottom: 8 }}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={formatFieldOptions}
                placeholder="选择字段"
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="小数位" name={[field.name, 'digits']} style={{ marginBottom: 8 }}>
              <InputNumber min={0} max={6} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item label="前缀" name={[field.name, 'prefix']} style={{ marginBottom: 8 }}>
              <Input maxLength={12} placeholder="如 ¥" />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item label="后缀" name={[field.name, 'suffix']} style={{ marginBottom: 8 }}>
              <Input maxLength={12} placeholder="如 t" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Button danger style={{ marginTop: 30 }} onClick={() => remove(field.name)}>
              删除
            </Button>
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={6}>
            <Form.Item
              label="空值文案"
              name={[field.name, 'empty_text']}
              style={{ marginBottom: 8 }}
            >
              <Input maxLength={16} placeholder="如 -" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label="真值文案"
              name={[field.name, 'true_text']}
              style={{ marginBottom: 8 }}
            >
              <Input maxLength={16} placeholder="如 是" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label="假值文案"
              name={[field.name, 'false_text']}
              style={{ marginBottom: 8 }}
            >
              <Input maxLength={16} placeholder="如 否" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label="日期格式"
              name={[field.name, 'date_format']}
              style={{ marginBottom: 8 }}
            >
              <Input maxLength={24} placeholder="%Y/%m/%d" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={6}>
            <Form.Item
              label="大写"
              name={[field.name, 'uppercase']}
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label="小写"
              name={[field.name, 'lowercase']}
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
