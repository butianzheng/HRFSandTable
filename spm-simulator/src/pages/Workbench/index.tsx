import { useState, useRef, useMemo, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Table,
  Tag,
  Form,
  Input,
  Select,
  Tooltip,
  Popconfirm,
  Spin,
} from 'antd';
import type { TableColumnsType, InputRef } from 'antd';
import {
  PlusOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  CopyOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { PriorityHitCodeSets } from '../../utils/priorityHit';
import { nextPriorityHitFilter } from '../../utils/priorityHit';
import type { ScheduleRow } from './types';
import { statusColorMap, statusLabelMap } from './constants';
import {
  scheduleStatusLabelMap,
  scheduleStatusColorMap,
} from '../../constants/material';

import { useWorkbenchData } from './useWorkbenchData';
import { useWorkbenchFilters } from './useWorkbenchFilters';
import { usePriorityHit } from './usePriorityHit';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useScheduleOperations } from './useScheduleOperations';
import { useDragDrop } from './useDragDrop';
import { useWorkbenchModals } from './useWorkbenchModals';
import GanttView from './GanttView';
import MaterialTable from '../../components/MaterialTable';
import WorkbenchModals from './WorkbenchModals';
import ImportBatchPanel from './ImportBatchPanel';

export default function Workbench() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ─── Local UI State ───
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [activePanel, setActivePanel] = useState<'materials' | 'schedule'>('materials');
  const [scheduleViewMode, setScheduleViewMode] = useState<'list' | 'gantt'>('list');
  const [focusedScheduleItemId, setFocusedScheduleItemId] = useState<number | null>(null);
  const materialSearchRef = useRef<InputRef>(null);

  // ─── Modal state (useReducer) ───
  const modals = useWorkbenchModals();
  const [createForm] = Form.useForm();

  // Lifted filter state
  const [materialTempFilter, setMaterialTempFilter] = useState<'all' | 'ready' | 'waiting'>('all');
  const [materialStatusFilter, setMaterialStatusFilter] = useState<'all' | 'pending' | 'frozen'>(
    'pending'
  );
  const [forecastReadyDateFilter, setForecastReadyDateFilter] = useState<string | null>(null);
  const [forecastMaterialIdsFilter, setForecastMaterialIdsFilter] = useState<number[] | null>(null);

  // ─── Hook 1: Data Loading ───
  const data = useWorkbenchData({
    navigate,
    searchParams,
    setActivePanel,
    setScheduleViewMode,
    setSelectedItemIds,
    setFocusedScheduleItemId,
    setMaterialTempFilter,
    setMaterialStatusFilter,
    setForecastReadyDateFilter,
    setForecastMaterialIdsFilter,
    importModalOpen: modals.importModalOpen,
    exportModalOpen: modals.exportModalOpen,
    focusedScheduleItemId,
  });

  // ─── Compute priorityHitCodeSets + maps at index level (breaks circular dep) ───
  const priorityHitCodeSets = useMemo<PriorityHitCodeSets>(
    () => ({
      customerCodes: new Set(data.customerPriorityConfigs.map((c) => c.customer_code)),
      batchCodes: new Set(data.batchPriorityConfigs.map((c) => c.batch_code)),
      productTypeCodes: new Set(data.productTypePriorityConfigs.map((c) => c.product_type)),
    }),
    [data.customerPriorityConfigs, data.batchPriorityConfigs, data.productTypePriorityConfigs]
  );

  const priorityDimensionNameMap = useMemo(
    () => new Map(data.priorityDimensionConfigs.map((d) => [d.dimension_code, d.dimension_name])),
    [data.priorityDimensionConfigs]
  );
  const customerPriorityMap = useMemo(
    () => new Map(data.customerPriorityConfigs.map((c) => [c.customer_code, c])),
    [data.customerPriorityConfigs]
  );
  const batchPriorityMap = useMemo(
    () => new Map(data.batchPriorityConfigs.map((c) => [c.batch_code, c])),
    [data.batchPriorityConfigs]
  );
  const productTypePriorityMap = useMemo(
    () => new Map(data.productTypePriorityConfigs.map((c) => [c.product_type, c])),
    [data.productTypePriorityConfigs]
  );

  // ─── Hook 2: Filters (needs priorityHitCodeSets) ───
  const filters = useWorkbenchFilters({
    materials: data.materials,
    scheduleItems: data.scheduleItems,
    selectedMaterialIds,
    setSelectedMaterialIds,
    currentPlan: data.currentPlan,
    clearForecastFilter: data.clearForecastFilter,
    priorityHitCodeSets,
    materialTempFilter,
    setMaterialTempFilter,
    materialStatusFilter,
    setMaterialStatusFilter,
    forecastReadyDateFilter,
    setForecastReadyDateFilter,
    forecastMaterialIdsFilter,
    setForecastMaterialIdsFilter,
  });

  // ─── Hook 3: Priority Hit (needs baseAvailableMaterials from filters) ───
  const priorityHit = usePriorityHit({
    baseAvailableMaterials: filters.baseAvailableMaterials,
    priorityHitCodeSets,
    priorityDimensionConfigs: data.priorityDimensionConfigs,
    customerPriorityConfigs: data.customerPriorityConfigs,
    batchPriorityConfigs: data.batchPriorityConfigs,
    productTypePriorityConfigs: data.productTypePriorityConfigs,
    priorityDimensionNameMap,
    customerPriorityMap,
    batchPriorityMap,
    productTypePriorityMap,
  });

  // ─── Hook 5: Schedule Operations ───
  const ops = useScheduleOperations({
    currentPlan: data.currentPlan,
    scheduleItems: data.scheduleItems,
    undoCount: data.undoCount,
    redoCount: data.redoCount,
    selectedMaterialIds,
    selectedItemIds,
    materials: data.materials,
    strategies: data.strategies,
    plans: data.plans,
    exportTemplateId: data.exportTemplateId,
    loadScheduleItems: data.loadScheduleItems,
    loadUndoRedoCount: data.loadUndoRedoCount,
    loadMaterials: data.loadMaterials,
    loadStrategies: data.loadStrategies,
    setScheduling: data.setScheduling,
    setCurrentPlan: data.setCurrentPlan,
    setPlans: data.setPlans,
    setExportTemplateId: data.setExportTemplateId,
    setSelectedMaterialIds,
    setSelectedItemIds,
    setAddModalOpen: modals.setAddModalOpen,
    setInsertPosition: modals.setInsertPosition,
    setScheduleModalOpen: modals.setScheduleModalOpen,
    setExportModalOpen: modals.setExportModalOpen,
    setImportModalOpen: modals.setImportModalOpen,
    setImporting: modals.setImporting,
    setExporting: modals.setExporting,
    setImportFilePath: modals.setImportFilePath,
    setSelectedMappingId: modals.setSelectedMappingId,
    setCreateModalOpen: modals.setCreateModalOpen,
    setCreateModalMode: modals.setCreateModalMode,
    setMaterialDetail: modals.setMaterialDetail,
    setMaterialDetailOpen: modals.setMaterialDetailOpen,
    setPriorityModalOpen: modals.setPriorityModalOpen,
    setSelectedStrategyId: modals.setSelectedStrategyId,
    createForm,
    createModalMode: modals.createModalMode,
    importFilePath: modals.importFilePath,
    selectedMappingId: modals.selectedMappingId,
    selectedStrategyId: modals.selectedStrategyId,
    conflictMode: modals.conflictMode,
    setConflictMode: modals.setConflictMode,
  });

  // ─── Hook 4: Keyboard Shortcuts ───
  useKeyboardShortcuts({
    activePanel,
    currentPlan: data.currentPlan,
    undoCount: data.undoCount,
    redoCount: data.redoCount,
    availableMaterials: filters.availableMaterials,
    scheduleItems: data.scheduleItems,
    selectedItemIds,
    setSelectedMaterialIds,
    setSelectedItemIds,
    setActivePanel,
    materialSearchRef,
    handleUndo: ops.handleUndo,
    handleRedo: ops.handleRedo,
    handleSavePlan: ops.handleSavePlan,
    handleRefreshTemper: ops.handleRefreshTemper,
    handleLockItems: ops.handleLockItems,
    handleMoveItem: ops.handleMoveItem,
    handleRemoveItems: ops.handleRemoveItems,
  });

  // ─── Hook 6: Drag & Drop ───
  const drag = useDragDrop({
    currentPlan: data.currentPlan,
    scheduleItems: data.scheduleItems,
    refreshAfterMutation: ops.refreshAfterMutation,
    setSelectedItemIds,
  });

  // ─── Derived ───
  const totalWeight = useMemo(
    () => data.scheduleItems.reduce((sum, r) => sum + (r.material?.weight ?? 0), 0),
    [data.scheduleItems]
  );
  const scheduleDays = useMemo(() => {
    if (!data.currentPlan) return 1;
    const diff = Math.max(
      1,
      Math.ceil(
        (new Date(data.currentPlan.end_date).getTime() -
          new Date(data.currentPlan.start_date).getTime()) /
          86400000
      ) + 1
    );
    return diff;
  }, [data.currentPlan]);

  const dailyAchievementText = useMemo(() => {
    if (data.dailyTarget <= 0) return null;
    return `日目标达成: ${((totalWeight / (data.dailyTarget * scheduleDays)) * 100).toFixed(1)}% (${scheduleDays}天×${data.dailyTarget}t)`;
  }, [data.dailyTarget, totalWeight, scheduleDays]);

  const shiftCapacityText = useMemo(() => {
    if (data.shiftCapacity <= 0) return null;
    return `(按班次2×${data.shiftCapacity}t)`;
  }, [data.shiftCapacity]);

  // ─── Stable callbacks for MaterialTable (avoids re-render on unrelated state changes) ───
  const { handleScopedMaterialSelectionChange } = filters;
  const { readyIds, waitingIds } = filters.materialGroups;
  const handleReadySelectionChange = useCallback(
    (keys: number[]) => handleScopedMaterialSelectionChange(readyIds, keys),
    [handleScopedMaterialSelectionChange, readyIds]
  );
  const handleWaitingSelectionChange = useCallback(
    (keys: number[]) => handleScopedMaterialSelectionChange(waitingIds, keys),
    [handleScopedMaterialSelectionChange, waitingIds]
  );
  const enableScheduleVirtual = data.scheduleItems.length >= 200;
  const enableReadyVirtual = filters.materialGroups.ready.length >= 200;
  const enableWaitingVirtual = filters.materialGroups.waiting.length >= 200;

  // ─── Schedule table columns ───
  const { setMaterialDetail, setMaterialDetailOpen } = modals;
  const scheduleColumns: TableColumnsType<ScheduleRow> = useMemo(
    () => [
      { title: '序号', dataIndex: 'sequence', width: 60, align: 'center' },
      {
        title: '卷号',
        key: 'coil_id',
        width: 120,
        render: (_: unknown, row: ScheduleRow) => (
          <Button
            type="link"
            size="small"
            onClick={() => {
              if (row.material) {
                setMaterialDetail(row.material);
                setMaterialDetailOpen(true);
              }
            }}
          >
            {row.material?.coil_id ?? '-'}
          </Button>
        ),
      },
      {
        title: '钢种',
        key: 'steel_grade',
        width: 80,
        render: (_: unknown, row: ScheduleRow) => row.material?.steel_grade ?? '-',
      },
      {
        title: '宽度',
        key: 'width',
        width: 80,
        align: 'right',
        render: (_: unknown, row: ScheduleRow) => row.material?.width ?? '-',
      },
      {
        title: '厚度',
        key: 'thickness',
        width: 80,
        align: 'right',
        render: (_: unknown, row: ScheduleRow) =>
          row.material?.thickness != null ? row.material.thickness.toFixed(2) : '-',
      },
      {
        title: '重量',
        key: 'weight',
        width: 70,
        align: 'right',
        render: (_: unknown, row: ScheduleRow) => row.material?.weight ?? '-',
      },
      {
        title: '客户',
        key: 'customer',
        width: 120,
        render: (_: unknown, row: ScheduleRow) =>
          row.material?.customer_name || row.material?.customer_code || '-',
      },
      {
        title: '交期',
        key: 'due_date',
        width: 110,
        align: 'center',
        render: (_: unknown, row: ScheduleRow) => {
          const due = row.material?.due_date;
          return due ? due.slice(0, 10) : '-';
        },
      },
      {
        title: '产品大类',
        key: 'product_type',
        width: 100,
        render: (_: unknown, row: ScheduleRow) => row.material?.product_type ?? '-',
      },
      {
        title: '排程日期',
        dataIndex: 'shift_date',
        width: 100,
        align: 'center',
        render: (v: string) => v || '-',
      },
      {
        title: '班次',
        dataIndex: 'shift_type',
        width: 60,
        align: 'center',
        render: (v: string) => (v === 'day' ? '白' : v === 'night' ? '夜' : v || '-'),
      },
      {
        title: '排程状态',
        key: 'schedule_status',
        width: 80,
        align: 'center',
        render: () => (
          <Tag color={scheduleStatusColorMap['in_plan']} style={{ margin: 0 }}>
            {scheduleStatusLabelMap['in_plan']}
          </Tag>
        ),
      },
      {
        title: '锁定',
        dataIndex: 'is_locked',
        width: 50,
        align: 'center',
        render: (v: boolean) => (v ? <LockOutlined style={{ color: '#faad14' }} /> : null),
      },
    ],
    [setMaterialDetail, setMaterialDetailOpen]
  );

  return (
    <Spin spinning={data.loading}>
      <Row gutter={12}>
        {/* ─── Left: Materials ─── */}
        <Col span={12}>
          <Card
            size="small"
            title={`待排材料 (${filters.availableMaterials.length})`}
            extra={
              <Space size="small">
                <Input
                  ref={materialSearchRef}
                  size="small"
                  placeholder="搜索卷号/钢种/客户/合同..."
                  prefix={<SearchOutlined />}
                  value={filters.materialSearch}
                  onChange={(e) => filters.setMaterialSearch(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                <Tooltip title="刷新适温 (F5)">
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={ops.handleRefreshTemper}
                  />
                </Tooltip>
                <Button
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => modals.setImportModalOpen(true)}
                >
                  导入材料
                </Button>
              </Space>
            }
          >
            {/* Priority hit chips */}
            <div style={{ marginBottom: 8 }}>
              {priorityHit.priorityHitChips.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {priorityHit.priorityHitChips.map((chip) => (
                    <Tag
                      key={chip.key}
                      color={filters.priorityHitFilter === chip.key ? chip.color : undefined}
                      style={{ cursor: 'pointer', margin: 0 }}
                      onClick={() =>
                        filters.setPriorityHitFilter(
                          nextPriorityHitFilter(filters.priorityHitFilter, chip.key)
                        )
                      }
                      onDoubleClick={() => navigate('/settings?tab=priority')}
                    >
                      {chip.label} {chip.count}
                    </Tag>
                  ))}
                  {filters.priorityHitFilter !== 'all' && (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => filters.setPriorityHitFilter('all')}
                    >
                      清除命中筛选
                    </Button>
                  )}
                </Space>
              ) : (
                <span style={{ color: '#999', fontSize: 12 }}>暂无命中项</span>
              )}
            </div>

            {/* Forecast filter */}
            {forecastReadyDateFilter && (
              <div style={{ marginBottom: 8 }}>
                <Tag color="blue">预测适温 {forecastReadyDateFilter}</Tag>
                {filters.availableMaterials.length === 0 && (
                  <span style={{ color: '#faad14', fontSize: 12 }}>
                    当前预测日期无待排待温材料，可清除预测筛选后继续操作。
                  </span>
                )}
                <Button size="small" type="link" onClick={() => data.clearForecastFilter(true)}>
                  清除预测筛选
                </Button>
              </div>
            )}

            {/* Selection actions */}
            {selectedMaterialIds.length > 0 && (
              <Space size="small" style={{ marginBottom: 8 }}>
                <Tooltip title={filters.materialAddBlockedReason}>
                  <Button
                    size="small"
                    type="primary"
                    disabled={!filters.canAddSelected}
                    onClick={() => modals.setAddModalOpen(true)}
                  >
                    添加选中 ({filters.selectedReadyPendingCount}/{selectedMaterialIds.length})
                  </Button>
                </Tooltip>
                <Button size="small" onClick={() => modals.setPriorityModalOpen(true)}>
                  优先级
                </Button>
              </Space>
            )}

            {/* Material tables (ready / waiting groups) */}
            <MaterialTable
              dataSource={filters.materialGroups.ready}
              selectedRowKeys={filters.readySelectedMaterialIds}
              onSelectionChange={handleReadySelectionChange}
              virtual={enableReadyVirtual}
            />

            <MaterialTable
              dataSource={filters.materialGroups.waiting}
              selectedRowKeys={filters.waitingSelectedMaterialIds}
              onSelectionChange={handleWaitingSelectionChange}
              virtual={enableWaitingVirtual}
            />

            <ImportBatchPanel
              onLoadBatches={ops.handleLoadImportBatches}
              onDeleteBatch={ops.handleDeleteImportBatch}
            />
          </Card>
        </Col>

        {/* ─── Right: Schedule ─── */}
        <Col span={12}>
          <Card
            size="small"
            title={`排程序列 (${data.scheduleItems.length} 块)`}
            extra={
              <Space size="small">
                {data.currentPlan && (
                  <Tag color={statusColorMap[data.currentPlan.status ?? 'draft']}>
                    {statusLabelMap[data.currentPlan.status ?? 'draft']}
                  </Tag>
                )}
                {data.currentPlan && (
                  <span style={{ color: '#666', fontSize: 12 }}>({data.currentPlan.plan_no})</span>
                )}
                <Select
                  size="small"
                  style={{ width: 180 }}
                  value={data.currentPlan?.id ?? undefined}
                  placeholder="选择方案"
                  onChange={(id: number) =>
                    data.setCurrentPlan(data.plans.find((p) => p.id === id) ?? null)
                  }
                  options={data.plans.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.plan_no})`,
                  }))}
                />
              </Space>
            }
          >
            {/* Toolbar */}
            <Space size="small" style={{ marginBottom: 8 }} wrap>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  modals.setCreateModalMode('create');
                  createForm.resetFields();
                  modals.setCreateModalOpen(true);
                }}
              >
                新建方案
              </Button>
              {data.currentPlan && (
                <Button size="small" icon={<CopyOutlined />} onClick={ops.handleOpenSaveAs}>
                  另存为
                </Button>
              )}
              <Button
                size="small"
                icon={<UploadOutlined />}
                onClick={ops.handleOpenScheduleModal}
                disabled={!data.currentPlan}
              >
                自动排程
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => modals.setExportModalOpen(true)}
                disabled={!data.currentPlan}
              >
                导出
              </Button>
              <Button
                size="small"
                icon={<UploadOutlined />}
                onClick={() => modals.setImportModalOpen(true)}
              >
                导入材料
              </Button>
              {data.currentPlan && data.currentPlan.status !== 'confirmed' && data.currentPlan.status !== 'archived' && (
                <Button
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={ops.handleSavePlan}
                >
                  保存
                </Button>
              )}
              {data.currentPlan && data.currentPlan.status !== 'confirmed' && data.currentPlan.status !== 'archived' && (
                <Popconfirm
                  title="确认生效"
                  description="方案确认生效后将不可编辑，是否继续？"
                  onConfirm={ops.handleConfirmPlan}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                    确认生效
                  </Button>
                </Popconfirm>
              )}
              {data.currentPlan && data.currentPlan.status === 'confirmed' && (
                <Popconfirm
                  title="归档方案"
                  description="归档后方案将标记为历史版本，是否继续？"
                  onConfirm={ops.handleArchivePlan}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button size="small" icon={<InboxOutlined />}>
                    归档
                  </Button>
                </Popconfirm>
              )}
            </Space>

            {/* Undo/redo & view toggle */}
            <div
              style={{
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: '#999' }}>
                撤销栈: {data.undoCount}步 / 重做栈: {data.redoCount}步
              </span>
              <Button
                size="small"
                onClick={() => setScheduleViewMode(scheduleViewMode === 'list' ? 'gantt' : 'list')}
              >
                {scheduleViewMode === 'list' ? '甘特图视图' : '列表视图'}
              </Button>
            </div>

            {/* Selection actions */}
            {selectedItemIds.length > 0 && (
              <Space size="small" style={{ marginBottom: 8 }}>
                <Button
                  size="small"
                  icon={<LockOutlined />}
                  onClick={() => ops.handleLockItems(true)}
                >
                  锁定
                </Button>
                <Button
                  size="small"
                  icon={<UnlockOutlined />}
                  onClick={() => ops.handleLockItems(false)}
                >
                  解锁
                </Button>
                <Popconfirm
                  title={`确定移除 ${selectedItemIds.length} 条？`}
                  onConfirm={ops.handleRemoveItems}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    移除 ({selectedItemIds.length})
                  </Button>
                </Popconfirm>
              </Space>
            )}

            {/* List view */}
            {scheduleViewMode === 'list' && (
              <Table
                size="small"
                pagination={false}
                dataSource={data.scheduleItems}
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedItemIds,
                  onChange: (keys) => setSelectedItemIds(keys as number[]),
                }}
                columns={scheduleColumns}
                virtual={enableScheduleVirtual}
                scroll={{ x: 1260, y: data.viewportHeight - 400 }}
                onRow={(row) => ({
                  draggable: true,
                  onDragStart: (e) => drag.handleDragStart(row.id, e),
                  onDragOver: (e) => drag.handleDragOver(row.id, e),
                  onDragLeave: drag.handleDragLeave,
                  onDragEnd: drag.handleDragEnd,
                  onDrop: (e) => drag.handleDragDrop(row.id, e),
                  className:
                    drag.dragOverScheduleItemId === row.id
                      ? drag.dragOverSchedulePlacement === 'above'
                        ? 'drag-over-top-row'
                        : 'drag-over-bottom-row'
                      : undefined,
                })}
              />
            )}

            {/* Gantt view */}
            {scheduleViewMode === 'gantt' && (
              <GanttView
                scheduleItems={data.scheduleItems}
                selectedItemIds={selectedItemIds}
                ganttZoom={data.ganttZoom}
                setGanttZoom={data.setGanttZoom}
                ganttGroupBy={data.ganttGroupBy}
                onGroupByChange={data.setGanttGroupBy}
                dragOverScheduleItemId={drag.dragOverScheduleItemId}
                dragOverSchedulePlacement={drag.dragOverSchedulePlacement}
                onDragStart={drag.handleDragStart}
                onDragOver={drag.handleDragOver}
                onDragLeave={drag.handleDragLeave}
                onDragEnd={drag.handleDragEnd}
                onDrop={drag.handleDragDrop}
                onClick={drag.handleGanttClick}
              />
            )}

            {/* Status bar */}
            {data.currentPlan && (dailyAchievementText || shiftCapacityText) && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                {dailyAchievementText}
                {shiftCapacityText && (
                  <span style={{ marginLeft: dailyAchievementText ? 8 : 0 }}>
                    {shiftCapacityText}
                  </span>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <WorkbenchModals
        importModalOpen={modals.importModalOpen}
        setImportModalOpen={modals.setImportModalOpen}
        importFilePath={modals.importFilePath}
        importing={modals.importing}
        handleImportMaterials={ops.handleImportMaterials}
        handlePickImportFile={ops.handlePickImportFile}
        mappingTemplates={data.mappingTemplates}
        selectedMappingId={modals.selectedMappingId}
        setSelectedMappingId={modals.setSelectedMappingId}
        conflictMode={modals.conflictMode}
        setConflictMode={modals.setConflictMode}
        addModalOpen={modals.addModalOpen}
        setAddModalOpen={modals.setAddModalOpen}
        insertPosition={modals.insertPosition}
        setInsertPosition={modals.setInsertPosition}
        selectedMaterialIds={selectedMaterialIds}
        scheduleItemsLength={data.scheduleItems.length}
        handleAddToSchedule={ops.handleAddToSchedule}
        exportModalOpen={modals.exportModalOpen}
        setExportModalOpen={modals.setExportModalOpen}
        exporting={modals.exporting}
        exportTemplates={data.exportTemplates}
        exportTemplateId={data.exportTemplateId}
        setExportTemplateId={data.setExportTemplateId}
        currentPlan={data.currentPlan}
        handleExportPlan={ops.handleExportPlan}
        priorityModalOpen={modals.priorityModalOpen}
        setPriorityModalOpen={modals.setPriorityModalOpen}
        priorityValue={modals.priorityValue}
        setPriorityValue={modals.setPriorityValue}
        handleBatchUpdatePriority={ops.handleBatchUpdatePriority}
        createModalOpen={modals.createModalOpen}
        setCreateModalOpen={modals.setCreateModalOpen}
        createModalMode={modals.createModalMode}
        setCreateModalMode={modals.setCreateModalMode}
        createForm={createForm}
        plans={data.plans}
        strategies={data.strategies}
        handleCreatePlan={ops.handleCreatePlan}
        materialDetailOpen={modals.materialDetailOpen}
        setMaterialDetailOpen={modals.setMaterialDetailOpen}
        materialDetail={modals.materialDetail}
        scheduleModalOpen={modals.scheduleModalOpen}
        setScheduleModalOpen={modals.setScheduleModalOpen}
        selectedStrategyId={modals.selectedStrategyId}
        setSelectedStrategyId={modals.setSelectedStrategyId}
        handleAutoSchedule={ops.handleAutoSchedule}
      />
    </Spin>
  );
}
