import { useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Space,
  Tag,
  Statistic,
  Button,
  Select,
  Spin,
  Input,
  Empty,
  Popconfirm,
  Modal,
  Tooltip,
  InputNumber,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  DatabaseOutlined,
  ReloadOutlined,
  SearchOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExportOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import type { Material } from '../../types/material';
import type { BackupFileInfo, ExportTemplate, SchedulePlan } from '../../types/schedule';
import {
  materialStatusLabelMap as statusLabelMap,
  materialStatusColorMap as statusColorMap,
  tempStatusLabelMap as tempLabelMap,
  tempStatusColorMap as tempColorMap,
  scheduleStatusLabelMap,
  scheduleStatusColorMap,
} from '../../constants/material';
import { planStatusLabelMap, planStatusColorMap } from '../../constants/schedule';
import { useDataManage } from './useDataManage';
import ExportTemplateFormModal from './ExportTemplateFormModal';

export default function DataManage() {
  const dm = useDataManage();

  const { handleRestoreBackup, handleDeleteBackup } = dm;
  const { handleSetDefaultTemplate, openEditTemplateForm, handleDeleteTemplate } = dm;

  const columns = useMemo<TableColumnsType<Material>>(() => {
    const baseCols: TableColumnsType<Material> = [
      {
        title: '钢卷号',
        dataIndex: 'coil_id',
        width: 140,
        fixed: 'left',
        ellipsis: true,
      },
      {
        title: '钢种',
        dataIndex: 'steel_grade',
        width: 110,
        ellipsis: true,
      },
      {
        title: '厚度',
        dataIndex: 'thickness',
        width: 70,
        align: 'right',
        render: (v: number) => v.toFixed(2),
        sorter: (a, b) => a.thickness - b.thickness,
      },
      {
        title: '宽度',
        dataIndex: 'width',
        width: 70,
        align: 'right',
        render: (v: number) => v.toFixed(0),
        sorter: (a, b) => a.width - b.width,
      },
      {
        title: '重量',
        dataIndex: 'weight',
        width: 70,
        align: 'right',
        render: (v: number) => v.toFixed(1),
        sorter: (a, b) => a.weight - b.weight,
      },
      {
        title: '客户',
        dataIndex: 'customer_name',
        width: 120,
        ellipsis: true,
        render: (v: string) => v || '-',
      },
      {
        title: '适温',
        dataIndex: 'temp_status',
        width: 80,
        align: 'center',
        render: (v: string) => (
          <Tag color={tempColorMap[v] || 'default'}>{tempLabelMap[v] || v || '-'}</Tag>
        ),
      },
      {
        title: '等温天数',
        dataIndex: 'temp_wait_days',
        width: 80,
        align: 'center',
        render: (v: number) => v ?? '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 80,
        align: 'center',
        render: (v: string) => (
          <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v || '-'}</Tag>
        ),
      },
    ];

    // 方案筛选时插入「排程状态」列
    if (dm.planFilterId) {
      baseCols.push({
        title: '排程状态',
        key: 'schedule_status',
        width: 90,
        align: 'center',
        render: (_: unknown, record: Material) => {
          const isInPlan = dm.scheduledMaterialIds.has(record.id);
          const key = isInPlan ? 'in_plan' : 'not_in_plan';
          return (
            <Tag color={scheduleStatusColorMap[key]} style={{ margin: 0 }}>
              {scheduleStatusLabelMap[key]}
            </Tag>
          );
        },
      });
    }

    baseCols.push(
      {
        title: '优先级',
        dataIndex: 'priority_final',
        width: 70,
        align: 'center',
        sorter: (a, b) => (a.priority_final || 0) - (b.priority_final || 0),
        render: (v: number) => v || 0,
      },
      {
        title: '交期',
        dataIndex: 'due_date',
        width: 100,
        render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
      },
      {
        title: '卷取时间',
        dataIndex: 'coiling_time',
        width: 140,
        render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '产品大类',
        dataIndex: 'product_type',
        width: 100,
        ellipsis: true,
        render: (v: string) => v || '-',
      },
    );

    return baseCols;
  }, [dm.planFilterId, dm.scheduledMaterialIds]);

  const backupColumns = useMemo<TableColumnsType<BackupFileInfo>>(
    () => [
      {
        title: '文件名',
        dataIndex: 'file_name',
        ellipsis: true,
      },
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 160,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '大小',
        dataIndex: 'file_size',
        width: 90,
        align: 'right',
        render: (value: number) => `${(value / 1024 / 1024).toFixed(2)} MB`,
      },
      {
        title: '操作',
        width: 160,
        render: (_: unknown, row: BackupFileInfo) => (
          <Space size={4}>
            <Popconfirm
              title={`恢复该备份(${(row.file_size / 1024 / 1024).toFixed(2)}MB)将覆盖当前数据库，确认继续？`}
              onConfirm={() => handleRestoreBackup(row.file_path)}
            >
              <Button type="link" size="small">
                恢复
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认删除该备份文件？"
              onConfirm={() => handleDeleteBackup(row.file_path)}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleRestoreBackup, handleDeleteBackup]
  );

  const templateColumns = useMemo<TableColumnsType<ExportTemplate>>(
    () => [
      {
        title: '模板名称',
        dataIndex: 'name',
        width: 180,
        render: (value: string, row: ExportTemplate) => (
          <Space size={6}>
            <span>{value}</span>
            {row.is_default && <Tag color="gold">默认</Tag>}
          </Space>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        ellipsis: true,
        render: (value: string | undefined) => value || '-',
      },
      {
        title: '列配置',
        dataIndex: 'columns',
        width: 100,
        align: 'center',
        render: (value: string) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return `${parsed.length} 列`;
            return 'JSON';
          } catch {
            return <Tag color="error">无效JSON</Tag>;
          }
        },
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 170,
        render: (value: string | undefined) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
      },
      {
        title: '操作',
        width: 220,
        render: (_: unknown, row: ExportTemplate) => (
          <Space size={4}>
            <Button type="link" size="small" onClick={() => openEditTemplateForm(row)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.is_default}
              onClick={() => handleSetDefaultTemplate(row)}
            >
              设默认
            </Button>
            <Popconfirm title="确认删除该导出模板？" onConfirm={() => handleDeleteTemplate(row.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleSetDefaultTemplate, openEditTemplateForm, handleDeleteTemplate]
  );

  const planColumns = useMemo<TableColumnsType<SchedulePlan>>(
    () => [
      {
        title: '方案编号',
        dataIndex: 'plan_no',
        width: 150,
        ellipsis: true,
      },
      {
        title: '方案名称',
        dataIndex: 'name',
        width: 180,
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        align: 'center',
        render: (value: string | undefined) => {
          const key = value || 'draft';
          return (
            <Tag color={planStatusColorMap[key] || 'default'} style={{ margin: 0 }}>
              {planStatusLabelMap[key] || key}
            </Tag>
          );
        },
      },
      {
        title: '版本',
        dataIndex: 'version',
        width: 70,
        align: 'center',
        render: (value: number | undefined) => value ?? 1,
      },
      {
        title: '子版本',
        key: 'children',
        width: 80,
        align: 'center',
        render: (_: unknown, row: SchedulePlan) => dm.planChildCountMap.get(row.id) ?? 0,
      },
      {
        title: '排程块数',
        dataIndex: 'total_count',
        width: 90,
        align: 'right',
        render: (value: number | undefined) => value ?? 0,
      },
      {
        title: '总重量(t)',
        dataIndex: 'total_weight',
        width: 95,
        align: 'right',
        render: (value: number | undefined) => Number(value ?? 0).toFixed(1),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 160,
        render: (value: string | undefined) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 160,
        render: (value: string | undefined) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        align: 'center',
        render: (_: unknown, row: SchedulePlan) => {
          const childCount = dm.planChildCountMap.get(row.id) ?? 0;
          const deleting = dm.deletingPlanIds.includes(row.id);
          if (childCount > 0) {
            return (
              <Tooltip title={`该方案存在 ${childCount} 个子版本，请先删除子版本`}>
                <Button size="small" danger type="link" disabled style={{ padding: 0 }}>
                  删除方案
                </Button>
              </Tooltip>
            );
          }
          return (
            <Popconfirm
              title={`确认删除方案 ${row.plan_no}？`}
              description="删除后不可恢复"
              okText="确认删除"
              cancelText="取消"
              onConfirm={() => dm.handleDeletePlan(row.id)}
            >
              <Button
                size="small"
                danger
                type="link"
                loading={deleting}
                disabled={dm.deletingPlanBatch}
                style={{ padding: 0 }}
              >
                删除方案
              </Button>
            </Popconfirm>
          );
        },
      },
    ],
    [dm]
  );

  return (
    <div>
      {/* 统计概览 */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="材料总数"
              value={dm.stats?.total || 0}
              prefix={<DatabaseOutlined />}
              styles={{ content: { fontSize: 22 } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="待排"
              value={dm.stats?.pending || 0}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { fontSize: 22, color: '#999' } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="冻结"
              value={dm.stats?.frozen || 0}
              prefix={<WarningOutlined />}
              styles={{ content: { fontSize: 22, color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={dm.stats?.completed || 0}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { fontSize: 22, color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="已适温"
              value={dm.stats?.tempered || 0}
              prefix={<ThunderboltOutlined />}
              styles={{ content: { fontSize: 22, color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="等待适温"
              value={dm.stats?.waiting || 0}
              prefix={<WarningOutlined />}
              styles={{ content: { fontSize: 22, color: '#faad14' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 方案筛选信息条 */}
      {dm.planFilterId && dm.planFilteredPlan && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Space>
            <span>当前筛选方案:</span>
            <Tag color={planStatusColorMap[dm.planFilteredPlan.status ?? 'draft']}>
              {dm.planFilteredPlan.name} ({planStatusLabelMap[dm.planFilteredPlan.status ?? 'draft']})
            </Tag>
            <span>方案内材料: <b>{dm.planStats?.inPlan ?? 0}</b> 块</span>
          </Space>
        </Card>
      )}

      {/* 过滤和操作栏 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            style={{ width: 220 }}
            value={dm.planFilterId}
            onChange={(v) => {
              dm.setPlanFilterId(v ?? null);
              dm.setPage(1);
            }}
            placeholder="按方案筛选"
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={dm.plans.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.plan_no})`,
            }))}
          />
          {dm.planFilterId && (
            <Select
              style={{ width: 120 }}
              value={dm.scheduleStatusFilter}
              onChange={(v) => {
                dm.setScheduleStatusFilter(v);
                dm.setPage(1);
              }}
              options={[
                { value: '', label: '全部排程' },
                { value: 'in_plan', label: '已排程' },
                { value: 'not_in_plan', label: '未排程' },
              ]}
            />
          )}
          <Select
            style={{ width: 120 }}
            value={dm.statusFilter}
            onChange={(v) => {
              dm.setStatusFilter(v);
              dm.setPage(1);
            }}
            options={[
              { value: '', label: '全部状态' },
              { value: 'pending', label: '待排' },
              { value: 'completed', label: '已完成' },
              { value: 'frozen', label: '冻结' },
            ]}
          />
          <Select
            style={{ width: 120 }}
            value={dm.tempFilter}
            onChange={(v) => {
              dm.setTempFilter(v);
              dm.setPage(1);
            }}
            options={[
              { value: '', label: '全部适温' },
              { value: 'ready', label: '已适温' },
              { value: 'waiting', label: '等待中' },
            ]}
          />
          <Input
            style={{ width: 180 }}
            placeholder="搜索..."
            prefix={<SearchOutlined />}
            value={dm.keyword}
            onChange={(e) => {
              dm.setKeyword(e.target.value);
              dm.setPage(1);
            }}
            onPressEnter={() => {
              dm.setPage(1);
              dm.loadMaterials(dm.keyword);
            }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              dm.loadMaterials(dm.keyword);
              dm.loadStats();
              dm.loadCleanupEstimate(dm.cleanupDays);
            }}
          >
            刷新
          </Button>
          <Tooltip title="重新计算所有材料的适温状态">
            <Button icon={<ThunderboltOutlined />} onClick={dm.handleRefreshTemper}>
              刷新适温
            </Button>
          </Tooltip>

          <span style={{ borderLeft: '1px solid #d9d9d9', height: 20, margin: '0 4px' }} />

          {dm.selectedIds.length > 0 && (
            <Popconfirm
              title={`确认删除 ${dm.selectedIds.length} 条材料？`}
              onConfirm={dm.handleDelete}
              okText="确认"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                删除选中 ({dm.selectedIds.length})
              </Button>
            </Popconfirm>
          )}

          <Button
            icon={<DownloadOutlined />}
            onClick={dm.handleExportMaterials}
            loading={dm.exporting}
          >
            导出材料
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => dm.setExportModalOpen(true)}>
            导出排程
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => dm.setTemplateModalOpen(true)}>
            导出模板
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={dm.backupLoading}
            onClick={dm.handleBackupDatabase}
          >
            立即备份
          </Button>
          <Button icon={<UploadOutlined />} onClick={dm.handleRestoreFromFile}>
            恢复备份
          </Button>
          <Button onClick={() => dm.setBackupModalOpen(true)}>备份列表</Button>
          <Space size={4}>
            <span style={{ color: '#595959', fontSize: 12 }}>清理天数</span>
            <InputNumber
              min={0}
              max={3650}
              value={dm.cleanupDays}
              onChange={(value) =>
                dm.setCleanupDays(typeof value === 'number' ? Math.max(0, value) : 30)
              }
              style={{ width: 96 }}
            />
            <Tag color="blue" style={{ margin: 0 }}>
              预计日志 {dm.cleanupEstimateLoading ? '...' : (dm.cleanupEstimate?.logs ?? '-')}
            </Tag>
            <Tag color="gold" style={{ margin: 0 }}>
              预计历史{' '}
              {dm.cleanupEstimateLoading ? '...' : (dm.cleanupEstimate?.history_plans ?? '-')}
            </Tag>
            <Tag color="purple" style={{ margin: 0 }}>
              预计材料 {dm.cleanupEstimateLoading ? '...' : (dm.cleanupEstimate?.materials ?? '-')}
            </Tag>
          </Space>
          <Popconfirm
            title={`清理 ${dm.cleanupDays} 天前日志？预计 ${dm.cleanupEstimate?.logs ?? '...'} 条`}
            onConfirm={dm.handleClearLogs}
          >
            <Button danger ghost>
              清理日志
            </Button>
          </Popconfirm>
          <Popconfirm
            title={`清理 ${dm.cleanupDays} 天前已归档方案？预计 ${dm.cleanupEstimate?.history_plans ?? '...'} 条`}
            onConfirm={dm.handleCleanHistoryPlans}
          >
            <Button danger ghost>
              清理历史方案
            </Button>
          </Popconfirm>
          <Popconfirm
            title={`清理 ${dm.cleanupDays} 天前已完成/冻结材料？预计 ${dm.cleanupEstimate?.materials ?? '...'} 条`}
            onConfirm={dm.handleCleanMaterials}
          >
            <Button danger ghost>
              清理材料
            </Button>
          </Popconfirm>
          <Popconfirm title="清空所有撤销/重做历史？" onConfirm={dm.handleClearUndoStack}>
            <Button danger ghost>
              清理撤销栈
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      {/* 方案管理 */}
      <Card size="small" title="方案管理" style={{ marginBottom: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 220 }}
            placeholder="搜索方案编号/名称/备注"
            prefix={<SearchOutlined />}
            value={dm.planManageKeyword}
            onChange={(e) => dm.setPlanManageKeyword(e.target.value)}
            allowClear
          />
          <Select
            style={{ width: 130 }}
            value={dm.planManageStatusFilter}
            onChange={dm.setPlanManageStatusFilter}
            options={[
              { value: '', label: '全部状态' },
              { value: 'draft', label: '草稿' },
              { value: 'saved', label: '已保存' },
              { value: 'confirmed', label: '已确认' },
              { value: 'archived', label: '已归档' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={dm.loadPlans}>
            刷新方案
          </Button>
          {dm.selectedPlanIds.length > 0 && (
            <Popconfirm
              title={`确认删除选中 ${dm.selectedPlanIds.length} 个方案？`}
              description="删除后不可恢复"
              okText="确认删除"
              cancelText="取消"
              onConfirm={dm.handleBatchDeletePlans}
            >
              <Button danger icon={<DeleteOutlined />} loading={dm.deletingPlanBatch}>
                删除选中方案 ({dm.selectedPlanIds.length})
              </Button>
            </Popconfirm>
          )}
          <Tag color="blue" style={{ margin: 0 }}>
            当前 {dm.filteredPlans.length} 个方案
          </Tag>
        </Space>
        <Table
          size="small"
          dataSource={dm.filteredPlans}
          columns={planColumns}
          rowKey="id"
          pagination={{ pageSize: 8, size: 'small', showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1250, y: 300 }}
          rowSelection={{
            selectedRowKeys: dm.selectedPlanIds,
            onChange: (keys) => dm.setSelectedPlanIds(keys as number[]),
            getCheckboxProps: (record) => ({
              disabled: (dm.planChildCountMap.get(record.id) ?? 0) > 0,
            }),
          }}
        />
      </Card>

      {/* 材料表格 */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Spin spinning={dm.loading}>
          {dm.total === 0 && !dm.loading ? (
            <Empty description="暂无材料数据" style={{ padding: 40 }} />
          ) : (
            <Table
              size="small"
              dataSource={dm.displayMaterials}
              columns={columns}
              rowKey="id"
              scroll={{ x: 1400, y: 480 }}
              rowSelection={{
                selectedRowKeys: dm.selectedIds,
                onChange: (keys) => dm.setSelectedIds(keys as number[]),
              }}
              pagination={{
                current: dm.page,
                pageSize: dm.pageSize,
                total: dm.total,
                size: 'small',
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100'],
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p, ps) => {
                  dm.setPage(p);
                  dm.setPageSize(ps);
                },
              }}
            />
          )}
        </Spin>
      </Card>

      {/* 导出排程方案对话框 */}
      <Modal
        title="导出排程方案"
        open={dm.exportModalOpen}
        onCancel={() => dm.setExportModalOpen(false)}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>选择方案:</div>
          <Select
            style={{ width: '100%' }}
            value={dm.exportPlanId}
            onChange={(v) => dm.setExportPlanId(v)}
            placeholder="选择要导出的排程方案"
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={dm.plans.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.plan_no})`,
            }))}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>导出模板:</div>
          <Select
            style={{ width: '100%' }}
            value={dm.exportTemplateId}
            onChange={(v) => dm.setExportTemplateId(v ?? null)}
            placeholder="默认模板（不选择时使用系统默认列）"
            allowClear
            options={dm.templates.map((t) => ({
              value: t.id,
              label: `${t.name}${t.is_default ? ' (默认)' : ''}`,
            }))}
          />
        </div>
        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => dm.handleExportPlan('excel')}
            loading={dm.exporting}
            disabled={!dm.exportPlanId}
          >
            导出 Excel
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => dm.handleExportPlan('csv')}
            loading={dm.exporting}
            disabled={!dm.exportPlanId}
          >
            导出 CSV
          </Button>
        </Space>
      </Modal>

      <Modal
        title="数据库备份列表"
        open={dm.backupModalOpen}
        onCancel={() => dm.setBackupModalOpen(false)}
        footer={null}
        width={760}
      >
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={dm.loadBackups} icon={<ReloadOutlined />} loading={dm.backupLoading}>
            刷新
          </Button>
          <Button
            onClick={dm.handleBackupDatabase}
            icon={<DownloadOutlined />}
            loading={dm.backupLoading}
          >
            新建备份
          </Button>
        </Space>
        <Table
          size="small"
          rowKey="file_path"
          dataSource={dm.backups}
          columns={backupColumns}
          loading={dm.backupLoading}
          pagination={{ pageSize: 8 }}
        />
      </Modal>

      <Modal
        title="导出模板管理"
        open={dm.templateModalOpen}
        onCancel={() => dm.setTemplateModalOpen(false)}
        footer={null}
        width={900}
      >
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={dm.loadTemplates} icon={<ReloadOutlined />} loading={dm.templateLoading}>
            刷新
          </Button>
          <Button type="primary" onClick={dm.openCreateTemplateForm}>
            新建模板
          </Button>
        </Space>
        <Table
          size="small"
          rowKey="id"
          dataSource={dm.templates}
          columns={templateColumns}
          loading={dm.templateLoading}
          pagination={{ pageSize: 8 }}
        />
      </Modal>

      <ExportTemplateFormModal
        open={dm.templateFormOpen}
        editingTemplate={dm.editingTemplate}
        templateForm={dm.templateForm}
        templateSubmitting={dm.templateSubmitting}
        dragColumnIndex={dm.dragColumnIndex}
        dragOverColumnIndex={dm.dragOverColumnIndex}
        dragRuleIndex={dm.dragRuleIndex}
        dragOverRuleIndex={dm.dragOverRuleIndex}
        columnsPreview={dm.columnsPreview}
        formatFieldOptions={dm.formatFieldOptions}
        formatRulesPreview={dm.formatRulesPreview}
        columnConflictMessages={dm.columnConflictMessages}
        ruleConflictMessages={dm.ruleConflictMessages}
        onClose={dm.closeTemplateForm}
        onSave={dm.handleSaveTemplate}
        setDragColumnIndex={dm.setDragColumnIndex}
        setDragOverColumnIndex={dm.setDragOverColumnIndex}
        setDragRuleIndex={dm.setDragRuleIndex}
        setDragOverRuleIndex={dm.setDragOverRuleIndex}
      />
    </div>
  );
}
