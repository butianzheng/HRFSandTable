import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  Button,
  InputNumber,
  Descriptions,
  Radio,
  Alert,
} from 'antd';
import type { FormInstance } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import type { SchedulePlan, ExportTemplate } from '../../types/schedule';
import type { StrategyTemplate } from '../../types/config';
import type { FieldMapping as FieldMappingType } from '../../types/fieldMapping';
import type { Material, ConflictMode } from '../../types/material';

export interface WorkbenchModalsProps {
  // Import modal
  importModalOpen: boolean;
  setImportModalOpen: (v: boolean) => void;
  importFilePath: string;
  importing: boolean;
  handleImportMaterials: () => Promise<void>;
  handlePickImportFile: () => Promise<void>;
  mappingTemplates: FieldMappingType[];
  selectedMappingId: number | null;
  setSelectedMappingId: (v: number | null) => void;
  conflictMode: ConflictMode;
  setConflictMode: (v: ConflictMode) => void;

  // Add modal
  addModalOpen: boolean;
  setAddModalOpen: (v: boolean) => void;
  insertPosition: number | null;
  setInsertPosition: (v: number | null) => void;
  selectedMaterialIds: number[];
  scheduleItemsLength: number;
  handleAddToSchedule: (position?: number) => Promise<void>;

  // Export modal
  exportModalOpen: boolean;
  setExportModalOpen: (v: boolean) => void;
  exporting: boolean;
  exportTemplates: ExportTemplate[];
  exportTemplateId: number | null;
  setExportTemplateId: (v: number | null) => void;
  currentPlan: SchedulePlan | null;
  handleExportPlan: (format: 'excel' | 'csv') => Promise<void>;

  // Priority modal
  priorityModalOpen: boolean;
  setPriorityModalOpen: (v: boolean) => void;
  priorityValue: number;
  setPriorityValue: (v: number) => void;
  handleBatchUpdatePriority: () => Promise<void>;

  // Create plan modal
  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  createModalMode: 'create' | 'save_as';
  setCreateModalMode: (v: 'create' | 'save_as') => void;
  createForm: FormInstance;
  plans: SchedulePlan[];
  strategies: StrategyTemplate[];
  handleCreatePlan: () => Promise<void>;

  // Material detail modal
  materialDetailOpen: boolean;
  setMaterialDetailOpen: (v: boolean) => void;
  materialDetail: Material | null;

  // Auto schedule modal
  scheduleModalOpen: boolean;
  setScheduleModalOpen: (v: boolean) => void;
  selectedStrategyId: number | null;
  setSelectedStrategyId: (v: number | null) => void;
  handleAutoSchedule: () => Promise<void>;
}

const WorkbenchModals: React.FC<WorkbenchModalsProps> = (props) => {
  const {
    // Import modal
    importModalOpen,
    setImportModalOpen,
    importFilePath,
    importing,
    handleImportMaterials,
    handlePickImportFile,
    mappingTemplates,
    selectedMappingId,
    setSelectedMappingId,
    conflictMode,
    setConflictMode,
    // Add modal
    addModalOpen,
    setAddModalOpen,
    insertPosition,
    setInsertPosition,
    selectedMaterialIds,
    scheduleItemsLength,
    handleAddToSchedule,
    // Export modal
    exportModalOpen,
    setExportModalOpen,
    exporting,
    exportTemplates,
    exportTemplateId,
    setExportTemplateId,
    currentPlan,
    handleExportPlan,
    // Priority modal
    priorityModalOpen,
    setPriorityModalOpen,
    priorityValue,
    setPriorityValue,
    handleBatchUpdatePriority,
    // Create plan modal
    createModalOpen,
    setCreateModalOpen,
    createModalMode,
    setCreateModalMode,
    createForm,
    plans,
    strategies,
    handleCreatePlan,
    // Material detail modal
    materialDetailOpen,
    setMaterialDetailOpen,
    materialDetail,
    // Auto schedule modal
    scheduleModalOpen,
    setScheduleModalOpen,
    selectedStrategyId,
    setSelectedStrategyId,
    handleAutoSchedule,
  } = props;

  return (
    <>
      {/* 导入材料 Modal */}
      <Modal
        title="导入材料"
        open={importModalOpen}
        onOk={handleImportMaterials}
        okText="开始导入"
        confirmLoading={importing}
        onCancel={() => setImportModalOpen(false)}
        width={640}
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="导入文件">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                style={{ width: '100%' }}
                placeholder="请选择 .xlsx/.xls/.csv 文件"
                value={importFilePath}
                readOnly
              />
              <Button onClick={handlePickImportFile}>选择文件</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="映射模板（可选）" extra="不选择则按系统默认列名映射导入">
            <Select
              allowClear
              value={selectedMappingId ?? undefined}
              onChange={(value) => setSelectedMappingId(value ?? null)}
              placeholder="选择字段映射模板"
              options={mappingTemplates.map((item) => ({
                value: item.id,
                label: `${item.template_name}${item.is_default ? ' (默认)' : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="冲突策略">
            <Radio.Group
              value={conflictMode}
              onChange={(e) => setConflictMode(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="skip">跳过重复 — 遇到同钢卷号时跳过</Radio>
              <Radio value="overwrite">覆盖更新 — 遇到同钢卷号时用新数据覆盖</Radio>
              <Radio value="replace_all">全量替换 — 清除全部材料和排程项，导入新版本材料清单</Radio>
            </Radio.Group>
          </Form.Item>
          {conflictMode === 'replace_all' && (
            <Alert
              type="warning"
              showIcon
              message="全量替换警告"
              description="此操作将删除所有材料（含已排程材料）及全部排程项，然后导入新版本材料清单。排程方案结构保留但内容清空。此操作不可撤销。"
              style={{ marginBottom: 12 }}
            />
          )}
        </Form>
      </Modal>

      {/* 批量添加到排程 Modal */}
      <Modal
        title="批量添加到排程"
        open={addModalOpen}
        okText="确认添加"
        onOk={() => handleAddToSchedule(insertPosition ?? undefined)}
        onCancel={() => {
          setAddModalOpen(false);
          setInsertPosition(null);
        }}
        width={520}
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item>已选材料：{selectedMaterialIds.length} 块</Form.Item>
          <Form.Item label={`插入位置（1 ~ ${scheduleItemsLength + 1}，留空表示追加到末尾）`}>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={scheduleItemsLength + 1}
              value={insertPosition ?? undefined}
              placeholder="留空则追加到末尾"
              onChange={(value) => {
                if (typeof value === 'number') {
                  setInsertPosition(value);
                  return;
                }
                setInsertPosition(null);
              }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导出排程 Modal */}
      <Modal
        title="导出排程"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        footer={null}
        width={540}
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="当前方案">
            <Input
              value={currentPlan ? `${currentPlan.name} (${currentPlan.plan_no})` : ''}
              readOnly
            />
          </Form.Item>
          <Form.Item label="导出模板（可选）" extra="留空则使用系统默认导出列">
            <Select
              allowClear
              value={exportTemplateId ?? undefined}
              onChange={(value) => setExportTemplateId(value ?? null)}
              placeholder="选择导出模板"
              options={exportTemplates.map((item) => ({
                value: item.id,
                label: `${item.name}${item.is_default ? ' (默认)' : ''}`,
              }))}
            />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              disabled={!currentPlan}
              onClick={() => handleExportPlan('excel')}
            >
              导出 Excel
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              disabled={!currentPlan}
              onClick={() => handleExportPlan('csv')}
            >
              导出 CSV
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* 批量设置材料优先级 Modal */}
      <Modal
        title="批量设置材料优先级"
        open={priorityModalOpen}
        okText="确认"
        onOk={handleBatchUpdatePriority}
        onCancel={() => setPriorityModalOpen(false)}
        width={420}
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item>已选材料：{selectedMaterialIds.length} 条</Form.Item>
          <Form.Item label="人工优先级（1-10）">
            <InputNumber
              min={1}
              max={10}
              precision={0}
              style={{ width: '100%' }}
              value={priorityValue}
              onChange={(value) => setPriorityValue(typeof value === 'number' ? value : 5)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建方案 Modal */}
      <Modal
        title={createModalMode === 'save_as' ? '方案另存为' : '新建排程方案'}
        open={createModalOpen}
        onOk={handleCreatePlan}
        onCancel={() => {
          setCreateModalOpen(false);
          setCreateModalMode('create');
          createForm.resetFields();
        }}
        destroyOnHidden
        width={480}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="方案名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如: 2024-W01 日计划" />
          </Form.Item>
          <Form.Item
            name="period_type"
            label="周期类型"
            rules={[{ required: true }]}
            initialValue="daily"
          >
            <Select
              options={[
                { value: 'daily', label: '日计划' },
                { value: 'weekly', label: '周计划' },
                { value: 'monthly', label: '月计划' },
                { value: 'custom', label: '自定义' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="dates"
            label="起止日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="strategy_id" label="排程策略">
            <Select
              allowClear
              placeholder="选择策略模板"
              options={strategies.map((s) => ({
                value: s.id,
                label: s.name + (s.is_default ? ' (默认)' : ''),
              }))}
            />
          </Form.Item>
          <Form.Item name="parent_id" label="基于已有方案">
            <Select
              allowClear
              placeholder="留空则创建全新方案"
              options={plans.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.plan_no}) v${p.version ?? 1}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 材料详情 Modal */}
      <Modal
        title={materialDetail ? `材料详情 - ${materialDetail.coil_id}` : '材料详情'}
        open={materialDetailOpen}
        footer={null}
        onCancel={() => setMaterialDetailOpen(false)}
        width={720}
      >
        {materialDetail ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="钢卷号">{materialDetail.coil_id}</Descriptions.Item>
            <Descriptions.Item label="钢种">{materialDetail.steel_grade || '-'}</Descriptions.Item>
            <Descriptions.Item label="规格">{`${materialDetail.width} × ${materialDetail.thickness}`}</Descriptions.Item>
            <Descriptions.Item label="重量">{materialDetail.weight ?? '-'} t</Descriptions.Item>
            <Descriptions.Item label="合同号">
              {materialDetail.contract_no || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="客户">
              {materialDetail.customer_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="卷取时间">
              {materialDetail.coiling_time || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="交期">{materialDetail.due_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="适温状态">
              {materialDetail.temp_status || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="待温天数">
              {materialDetail.temp_wait_days ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">{materialDetail.status || '-'}</Descriptions.Item>
            <Descriptions.Item label="优先级">
              {materialDetail.priority_final ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>
              {materialDetail.remarks || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      {/* 自动排程 Modal */}
      <Modal
        title="自动排程"
        open={scheduleModalOpen}
        onOk={handleAutoSchedule}
        onCancel={() => setScheduleModalOpen(false)}
        okText="开始排程"
        width={400}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>选择排程策略:</div>
          <Select
            style={{ width: '100%' }}
            value={selectedStrategyId}
            onChange={(v) => setSelectedStrategyId(v)}
            options={strategies.map((s) => ({
              value: s.id,
              label: s.name + (s.is_default ? ' (默认)' : ''),
            }))}
          />
          {currentPlan && (
            <div style={{ marginTop: 12, color: '#666', fontSize: 12 }}>
              当前方案: {currentPlan.name} ({currentPlan.start_date} ~ {currentPlan.end_date})
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default WorkbenchModals;
