import { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from 'react';
import {
  Card, Row, Col, Select, Table, Space, Tag, Statistic, Button,
  message, Spin, Input, Empty, Timeline, Segmented, DatePicker, Modal,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  FileTextOutlined, ReloadOutlined, SearchOutlined,
  PlusCircleOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
  UnorderedListOutlined, FieldTimeOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { save } from '@tauri-apps/plugin-dialog';

import { scheduleApi } from '../../services/scheduleApi';
import type { OperationLogEntry } from '../../types/schedule';
import { getErrorMessage } from '../../utils/error';
import { actionLabelMap } from '../../constants/logs';

const actionIconMap: Record<string, React.ReactNode> = {
  create: <PlusCircleOutlined style={{ color: '#52c41a' }} />,
  update: <EditOutlined style={{ color: '#1677ff' }} />,
  delete: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
  schedule: <SyncOutlined style={{ color: '#722ed1' }} />,
  import: <PlusCircleOutlined style={{ color: '#13c2c2' }} />,
  export: <DownloadOutlined style={{ color: '#13c2c2' }} />,
  export_logs: <DownloadOutlined style={{ color: '#13c2c2' }} />,
  export_logs_excel: <DownloadOutlined style={{ color: '#13c2c2' }} />,
  export_compare_sequence_csv: <DownloadOutlined style={{ color: '#13c2c2' }} />,
  export_compare_sequence_excel: <DownloadOutlined style={{ color: '#13c2c2' }} />,
  clear_logs: <DeleteOutlined style={{ color: '#fa8c16' }} />,
  clean_history_plans: <DeleteOutlined style={{ color: '#fa8c16' }} />,
  clear_undo_stack: <DeleteOutlined style={{ color: '#fa8c16' }} />,
  clean_materials: <DeleteOutlined style={{ color: '#fa8c16' }} />,
  delete_backup: <DeleteOutlined style={{ color: '#fa8c16' }} />,
};

const logTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'plan', label: '方案操作' },
  { value: 'material', label: '材料操作' },
  { value: 'schedule', label: '排程操作' },
  { value: 'system', label: '系统操作' },
];

const actionOptions = [
  { value: '', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'schedule', label: '排程' },
  { value: 'import', label: '导入' },
  { value: 'export', label: '导出' },
  { value: 'save', label: '保存' },
  { value: 'confirm', label: '确认' },
  { value: 'auto_schedule', label: '自动排程' },
  { value: 'apply_risk_suggestion', label: '应用风险建议' },
  { value: 'clear_logs', label: '清理日志' },
  { value: 'clean_history_plans', label: '清理历史方案' },
  { value: 'clear_undo_stack', label: '清理撤销栈' },
  { value: 'clean_materials', label: '清理材料' },
  { value: 'delete_backup', label: '删除备份' },
  { value: 'rollback_version', label: '版本回滚' },
  { value: 'export_history_report', label: '导出追溯报告' },
  { value: 'export_logs', label: '导出日志' },
  { value: 'export_logs_excel', label: '导出日志Excel' },
  { value: 'export_compare_sequence_csv', label: '导出顺序差异CSV' },
  { value: 'export_compare_sequence_excel', label: '导出顺序差异Excel' },
];

const timelineColor = (action: string) => {
  if (action === 'delete') return 'red';
  if (action === 'create' || action === 'import') return 'green';
  if (action === 'schedule' || action === 'auto_schedule') return 'purple';
  if (action === 'clear_logs' || action === 'clean_history_plans' || action === 'clear_undo_stack' || action === 'clean_materials' || action === 'delete_backup') return 'orange';
  return 'blue';
};

export default function Logs() {
  const [logs, setLogs] = useState<OperationLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<OperationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [logType, setLogType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [viewMode, setViewMode] = useState<string>('table');
  const [exporting, setExporting] = useState(false);
  const filterWorkerRef = useRef<Worker | null>(null);
  const latestFilterTaskIdRef = useRef(0);
  const [detailLog, setDetailLog] = useState<OperationLogEntry | null>(null);
  const [timelinePageSize, setTimelinePageSize] = useState(50);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await scheduleApi.getOperationLogs({
        log_type: logType || undefined,
        action: actionFilter || undefined,
        start_time: timeRange ? timeRange[0].startOf('day').toISOString() : undefined,
        end_time: timeRange ? timeRange[1].endOf('day').toISOString() : undefined,
        limit: 500,
      });
      setLogs(data);
    } catch (error: unknown) {
      message.error(`加载日志失败: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, logType, timeRange]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filterLogsSync = useCallback((rows: OperationLogEntry[], keywordLower: string) => {
    if (!keywordLower) return rows;
    return rows.filter((log) => (
      (log.detail || '').toLowerCase().includes(keywordLower)
      || (log.action || '').toLowerCase().includes(keywordLower)
      || (log.log_type || '').toLowerCase().includes(keywordLower)
    ));
  }, []);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const worker = new Worker(new URL('../../workers/logFilter.worker.ts', import.meta.url), { type: 'module' });
    filterWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ id: number; filteredLogs: OperationLogEntry[] }>) => {
      const { id, filteredLogs: nextRows } = event.data;
      if (id !== latestFilterTaskIdRef.current) return;
      setFilteredLogs(nextRows);
      setFiltering(false);
    };
    worker.onerror = () => {
      filterWorkerRef.current = null;
      setFiltering(false);
    };
    return () => {
      worker.terminate();
      filterWorkerRef.current = null;
    };
  }, []);

  const handleExportLogs = async (format: 'csv' | 'excel') => {
    try {
      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const filePath = await save({
        defaultPath: `操作日志_${dayjs().format('YYYYMMDD_HHmmss')}.${ext}`,
        filters: [{ name: format === 'excel' ? 'Excel' : 'CSV', extensions: [ext] }],
      });
      if (!filePath) return;
      setExporting(true);
      const count = format === 'excel'
        ? await scheduleApi.exportLogsExcel(filePath, {
          log_type: logType || undefined,
          action: actionFilter || undefined,
          start_time: timeRange ? timeRange[0].startOf('day').toISOString() : undefined,
          end_time: timeRange ? timeRange[1].endOf('day').toISOString() : undefined,
        })
        : await scheduleApi.exportLogs(filePath, {
        log_type: logType || undefined,
        action: actionFilter || undefined,
        start_time: timeRange ? timeRange[0].startOf('day').toISOString() : undefined,
        end_time: timeRange ? timeRange[1].endOf('day').toISOString() : undefined,
      });
      message.success(`导出${format === 'excel' ? 'Excel' : 'CSV'}成功: ${count} 条日志`);
    } catch (error: unknown) {
      message.error(`导出日志失败: ${getErrorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const keywordLower = deferredKeyword.trim().toLowerCase();
    if (!keywordLower) {
      setFilteredLogs(logs);
      setFiltering(false);
      return;
    }
    const worker = filterWorkerRef.current;
    if (!worker) {
      setFilteredLogs(filterLogsSync(logs, keywordLower));
      setFiltering(false);
      return;
    }
    const taskId = latestFilterTaskIdRef.current + 1;
    latestFilterTaskIdRef.current = taskId;
    setFiltering(true);
    worker.postMessage({ id: taskId, logs, keyword: keywordLower });
  }, [deferredKeyword, filterLogsSync, logs]);

  const enableLogTableVirtual = filteredLogs.length >= 200;

  // 统计 (memoized)
  const todayLogs = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    return logs.filter(l => l.created_at && l.created_at.startsWith(todayStr));
  }, [logs]);

  const cleanupLogs = useMemo(() => {
    return logs.filter(l => ['clear_logs', 'clean_history_plans', 'clear_undo_stack', 'clean_materials', 'delete_backup'].includes(l.action));
  }, [logs]);

  const changeLogs = useMemo(() => {
    return logs.filter(l => ['create', 'update', 'delete'].includes(l.action));
  }, [logs]);

  const scheduleLogs = useMemo(() => {
    return logs.filter(l => ['schedule', 'auto_schedule'].includes(l.action));
  }, [logs]);

  const columns = useMemo<TableColumnsType<OperationLogEntry>>(() => [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
      defaultSortOrder: 'descend',
    },
    {
      title: '日志类型',
      dataIndex: 'log_type',
      width: 100,
      render: (v: string) => {
        const color = v === 'plan' ? 'blue' : v === 'material' ? 'green'
          : v === 'schedule' ? 'purple' : 'default';
        return <Tag color={color}>{v}</Tag>;
      },
      filters: logTypeOptions.filter(o => o.value).map(o => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.log_type === value,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 120,
      render: (v: string) => (
        <Space size={4}>
          {actionIconMap[v] || <EditOutlined />}
          <span>{actionLabelMap[v] || v}</span>
        </Space>
      ),
      filters: actionOptions.filter(o => o.value).map(o => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.action === value,
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      width: 90,
      render: (v: string) => v || '-',
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      width: 80,
      align: 'center',
      render: (v: number) => v || '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
  ], []);

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="日志总数" value={logs.length} prefix={<FileTextOutlined />} styles={{ content: { fontSize: 22 } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="今日操作" value={todayLogs.length} styles={{ content: { fontSize: 22, color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="变更操作"
              value={changeLogs.length}
              styles={{ content: { fontSize: 22, color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="排程操作"
              value={scheduleLogs.length}
              styles={{ content: { fontSize: 22, color: '#722ed1' } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="系统清理"
              value={cleanupLogs.length}
              styles={{ content: { fontSize: 22, color: '#fa8c16' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤和控制 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            style={{ width: 140 }}
            value={logType}
            onChange={v => setLogType(v)}
            options={logTypeOptions}
            placeholder="日志类型"
          />
          <Select
            style={{ width: 140 }}
            value={actionFilter}
            onChange={v => setActionFilter(v)}
            options={actionOptions}
            placeholder="操作类型"
          />
          <DatePicker.RangePicker
            style={{ width: 260 }}
            value={timeRange}
            onChange={(value) => {
              if (!value || !value[0] || !value[1]) {
                setTimeRange(null);
                return;
              }
              setTimeRange([value[0], value[1]]);
            }}
            allowClear
          />
          <Input
            style={{ width: 200 }}
            placeholder="搜索关键字..."
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            allowClear
          />
          <Segmented
            value={viewMode}
            onChange={v => setViewMode(v as string)}
            options={[
              { label: '表格', value: 'table', icon: <UnorderedListOutlined /> },
              { label: '时间轴', value: 'timeline', icon: <FieldTimeOutlined /> },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={() => handleExportLogs('csv')} loading={exporting}>
            导出CSV
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => handleExportLogs('excel')} loading={exporting}>
            导出Excel
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadLogs}>刷新</Button>
          <span style={{ color: '#999', fontSize: 12 }}>
            共 {filteredLogs.length} 条记录
          </span>
        </Space>
      </Card>

      {/* 主内容 */}
      <Spin spinning={loading || filtering}>
        {filteredLogs.length === 0 ? (
          <Card>
            <Empty description="暂无日志记录" style={{ padding: 40 }} />
          </Card>
        ) : viewMode === 'table' ? (
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Table
              size="small"
              dataSource={filteredLogs}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 20, size: 'small', showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
              virtual={enableLogTableVirtual}
              scroll={{ y: 520 }}
              onRow={(record) => ({
                onClick: () => setDetailLog(record),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        ) : (
          <Card size="small">
            <div style={{ maxHeight: 600, overflow: 'auto', padding: '12px 0' }}>
              <Timeline
                items={filteredLogs.slice(0, timelinePageSize).map(log => ({
                  color: timelineColor(log.action),
                  children: (
                    <div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {log.created_at ? dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}
                        <Tag style={{ marginLeft: 8 }}>{log.log_type}</Tag>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Space size={4}>
                          {actionIconMap[log.action] || <EditOutlined />}
                          <Tag color="blue">{actionLabelMap[log.action] || log.action}</Tag>
                          {log.target_type && (
                            <span style={{ fontSize: 12, color: '#666' }}>
                              {log.target_type}#{log.target_id}
                            </span>
                          )}
                        </Space>
                      </div>
                      {log.detail && (
                        <div style={{ fontSize: 13, color: '#333', marginTop: 2 }}>
                          {log.detail}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
              {filteredLogs.length > timelinePageSize && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
                    已显示 {Math.min(timelinePageSize, filteredLogs.length)} / {filteredLogs.length} 条记录
                  </div>
                  <Button
                    size="small"
                    onClick={() => setTimelinePageSize(prev => prev + 50)}
                  >
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </Spin>

      {/* 日志详情弹窗 */}
      <Modal
        title={
          detailLog
            ? `${actionLabelMap[detailLog.action] || detailLog.action}${detailLog.target_type ? ` - ${detailLog.target_type}#${detailLog.target_id}` : ''}`
            : '日志详情'
        }
        open={!!detailLog}
        onCancel={() => setDetailLog(null)}
        footer={null}
        width={600}
      >
        {detailLog && (
          <div style={{ lineHeight: 2 }}>
            <Row gutter={[16, 8]}>
              <Col span={6} style={{ color: '#999', textAlign: 'right' }}>时间:</Col>
              <Col span={18}>
                {detailLog.created_at ? dayjs(detailLog.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Col>

              <Col span={6} style={{ color: '#999', textAlign: 'right' }}>日志类型:</Col>
              <Col span={18}>
                <Tag color={
                  detailLog.log_type === 'plan' ? 'blue'
                    : detailLog.log_type === 'material' ? 'green'
                    : detailLog.log_type === 'schedule' ? 'purple'
                    : 'default'
                }>
                  {detailLog.log_type}
                </Tag>
              </Col>

              <Col span={6} style={{ color: '#999', textAlign: 'right' }}>操作:</Col>
              <Col span={18}>
                <Space size={4}>
                  {actionIconMap[detailLog.action] || <EditOutlined />}
                  <span>{actionLabelMap[detailLog.action] || detailLog.action}</span>
                </Space>
              </Col>

              <Col span={6} style={{ color: '#999', textAlign: 'right' }}>目标类型:</Col>
              <Col span={18}>{detailLog.target_type || '-'}</Col>

              <Col span={6} style={{ color: '#999', textAlign: 'right' }}>目标ID:</Col>
              <Col span={18}>{detailLog.target_id || '-'}</Col>

              <Col span={6} style={{ color: '#999', textAlign: 'right' }}>详情:</Col>
              <Col span={18}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {detailLog.detail || '-'}
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
