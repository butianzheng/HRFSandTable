import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  message,
  Space,
  Typography,
  Table,
  Tag,
  Alert,
  Descriptions,
  Select,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type {
  PerfSummaryFile,
  RouteMetricRow,
  RiskChipBenchmarkCase,
  RiskChipBenchmarkFile,
  RouteRenderMetric,
} from './types';
import { calcP95 } from './types';
import { usePerformanceStore } from '../../stores/performanceStore';
import type { PerformanceStats, PerformanceAlert } from '../../types/performance';

const { Text } = Typography;

export default function PerformanceTab({ refreshTrigger }: { refreshTrigger: number }) {
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfSummary, setPerfSummary] = useState<PerfSummaryFile | null>(null);
  const [perfSummaryError, setPerfSummaryError] = useState('');
  const [riskChipBenchmarkLoading, setRiskChipBenchmarkLoading] = useState(false);
  const [riskChipBenchmark, setRiskChipBenchmark] = useState<RiskChipBenchmarkFile | null>(null);
  const [riskChipBenchmarkError, setRiskChipBenchmarkError] = useState('');
  const [routeMetricRows, setRouteMetricRows] = useState<RouteMetricRow[]>([]);
  const [routeMetricTotal, setRouteMetricTotal] = useState(0);

  // 性能监控 Store
  const {
    stats,
    alerts,
    loading: perfStatsLoading,
    hours,
    setHours,
    cleanupMetrics,
    refreshAll,
  } = usePerformanceStore();

  const fetchPerfSummary = useCallback(async () => {
    setPerfLoading(true);
    try {
      const response = await fetch(`/perf-summary.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as PerfSummaryFile;
      setPerfSummary(data);
      setPerfSummaryError('');
    } catch {
      setPerfSummary(null);
      setPerfSummaryError(
        '未读取到构建性能报告，请先执行 npm run check:workflow 生成 dist/perf-summary.json。'
      );
    } finally {
      setPerfLoading(false);
    }
  }, []);

  const fetchRiskChipBenchmark = useCallback(async () => {
    setRiskChipBenchmarkLoading(true);
    try {
      const response = await fetch(`/perf-risk-chip-benchmark.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as RiskChipBenchmarkFile;
      setRiskChipBenchmark(data);
      setRiskChipBenchmarkError('');
    } catch {
      setRiskChipBenchmark(null);
      setRiskChipBenchmarkError(
        '未读取到风险命中基准报告，请先执行 npm run perf:risk-benchmark 或 npm run check:workflow。'
      );
    } finally {
      setRiskChipBenchmarkLoading(false);
    }
  }, []);

  const loadRouteMetrics = useCallback(() => {
    if (typeof window === 'undefined') {
      setRouteMetricRows([]);
      setRouteMetricTotal(0);
      return;
    }
    const raw = localStorage.getItem('spm_perf_metrics');
    if (!raw) {
      setRouteMetricRows([]);
      setRouteMetricTotal(0);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown[];
      const metrics: RouteRenderMetric[] = parsed.filter((item): item is RouteRenderMetric => {
        if (typeof item !== 'object' || item === null) return false;
        const obj = item as Partial<RouteRenderMetric>;
        return (
          obj.type === 'route-render' &&
          typeof obj.path === 'string' &&
          typeof obj.costMs === 'number' &&
          typeof obj.ts === 'number'
        );
      });
      const grouped = new Map<string, number[]>();
      const lastTsMap = new Map<string, number>();
      metrics.forEach((item) => {
        const arr = grouped.get(item.path) ?? [];
        arr.push(item.costMs);
        grouped.set(item.path, arr);
        const prevTs = lastTsMap.get(item.path) ?? 0;
        if (item.ts > prevTs) {
          lastTsMap.set(item.path, item.ts);
        }
      });
      const rows: RouteMetricRow[] = Array.from(grouped.entries())
        .map(([path, values]) => {
          const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
          const p95 = calcP95(values);
          const max = Math.max(...values);
          const lastTs = lastTsMap.get(path) ?? 0;
          return {
            key: path,
            path,
            count: values.length,
            avgMs: Number(avg.toFixed(2)),
            p95Ms: Number(p95.toFixed(2)),
            maxMs: Number(max.toFixed(2)),
            lastAt: lastTs > 0 ? dayjs(lastTs).format('YYYY-MM-DD HH:mm:ss') : '-',
          };
        })
        .sort((a, b) => b.p95Ms - a.p95Ms);
      setRouteMetricRows(rows);
      setRouteMetricTotal(metrics.length);
    } catch {
      setRouteMetricRows([]);
      setRouteMetricTotal(0);
    }
  }, []);

  const handleClearRouteMetrics = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('spm_perf_metrics');
    setRouteMetricRows([]);
    setRouteMetricTotal(0);
    message.success('路由渲染指标已清空');
  };

  useEffect(() => {
    fetchPerfSummary();
    fetchRiskChipBenchmark();
    loadRouteMetrics();
    refreshAll(); // 加载运行时性能数据
  }, [fetchPerfSummary, fetchRiskChipBenchmark, loadRouteMetrics, refreshAll]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchPerfSummary();
      fetchRiskChipBenchmark();
      loadRouteMetrics();
      refreshAll(); // 刷新运行时性能数据
    }
  }, [refreshTrigger, fetchPerfSummary, fetchRiskChipBenchmark, loadRouteMetrics, refreshAll]);

  const perfChunkColumns: TableColumnsType<{ name: string; kb: number; bytes: number }> = [
    {
      title: 'Chunk',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: '大小(KB)',
      dataIndex: 'kb',
      width: 110,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
  ];

  const routeMetricColumns: TableColumnsType<RouteMetricRow> = [
    {
      title: '路由',
      dataIndex: 'path',
      width: 150,
    },
    {
      title: '样本数',
      dataIndex: 'count',
      width: 80,
      align: 'right',
    },
    {
      title: '平均耗时(ms)',
      dataIndex: 'avgMs',
      width: 120,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'P95(ms)',
      dataIndex: 'p95Ms',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '最大(ms)',
      dataIndex: 'maxMs',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '最近记录',
      dataIndex: 'lastAt',
      width: 170,
    },
  ];

  const riskChipBenchmarkColumns: TableColumnsType<RiskChipBenchmarkCase> = [
    {
      title: '数据规模',
      dataIndex: 'label',
      width: 120,
    },
    {
      title: '样本数',
      dataIndex: 'sampleCount',
      width: 90,
      align: 'right',
    },
    {
      title: '均值(ms)',
      dataIndex: 'avgMs',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(3),
    },
    {
      title: 'P95(ms)',
      dataIndex: 'p95Ms',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(3),
    },
    {
      title: '最大(ms)',
      dataIndex: 'maxMs',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(3),
    },
    {
      title: '分组数',
      dataIndex: 'entryCount',
      width: 80,
      align: 'right',
    },
  ];

  // 运行时性能统计表格列
  const runtimeStatsColumns: TableColumnsType<PerformanceStats> = [
    {
      title: '指标类型',
      dataIndex: 'metric_type',
      width: 140,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          app_startup: '应用启动',
          page_render: '页面渲染',
          api_call: 'API调用',
          algorithm_execution: '算法执行',
          memory_usage: '内存使用',
          database_query: '数据库查询',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '指标名称',
      dataIndex: 'metric_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '样本数',
      dataIndex: 'count',
      width: 80,
      align: 'right',
    },
    {
      title: '平均值',
      dataIndex: 'avg',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'P50',
      dataIndex: 'p50',
      width: 90,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'P95',
      dataIndex: 'p95',
      width: 90,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'P99',
      dataIndex: 'p99',
      width: 90,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '最大值',
      dataIndex: 'max',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
  ];

  // 性能告警表格列
  const alertColumns: TableColumnsType<PerformanceAlert> = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={severity === 'Critical' ? 'error' : 'warning'} icon={<WarningOutlined />}>
          {severity === 'Critical' ? '严重' : '警告'}
        </Tag>
      ),
    },
    {
      title: '指标类型',
      dataIndex: 'metric_type',
      width: 120,
    },
    {
      title: '指标名称',
      dataIndex: 'metric_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '当前值',
      dataIndex: 'current_value',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '基线值',
      dataIndex: 'baseline_value',
      width: 100,
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '超出倍数',
      dataIndex: 'threshold_exceeded',
      width: 100,
      align: 'right',
      render: (v: number) => `${v.toFixed(2)}x`,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 170,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const handleCleanupMetrics = async () => {
    try {
      await cleanupMetrics(30); // 清理30天前的数据
      message.success('已清理30天前的性能数据');
    } catch {
      message.error('清理失败');
    }
  };

  return (
    <Card
      size="small"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchPerfSummary} loading={perfLoading}>
            刷新构建报告
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchRiskChipBenchmark}
            loading={riskChipBenchmarkLoading}
          >
            刷新风险基准
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadRouteMetrics}>
            刷新路由指标
          </Button>
          <Button onClick={handleClearRouteMetrics}>清空路由指标</Button>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {perfSummaryError ? (
          <Alert type="warning" showIcon message={perfSummaryError} />
        ) : perfSummary ? (
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Space size={12} wrap>
              <Tag color={perfSummary.violations.length === 0 ? 'success' : 'error'}>
                {perfSummary.violations.length === 0
                  ? '预算通过'
                  : `预算告警 ${perfSummary.violations.length}`}
              </Tag>
              <Text type="secondary">
                生成时间：{dayjs(perfSummary.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </Space>
            {perfSummary.violations.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {perfSummary.violations.map((item) => (
                  <div key={item} style={{ color: '#ff4d4f', fontSize: 12 }}>
                    {item}
                  </div>
                ))}
              </div>
            )}
            <Descriptions size="small" column={3} style={{ marginTop: 8 }}>
              <Descriptions.Item label="总 JS(KB)">
                {perfSummary.stats.totalJsKB.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="最大 Chunk(KB)">
                {perfSummary.stats.largestJsKB.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Chunk 数">{perfSummary.stats.chunkCount}</Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              style={{ marginTop: 8 }}
              rowKey="name"
              dataSource={perfSummary.stats.topChunks}
              columns={perfChunkColumns}
              pagination={false}
              scroll={{ y: 220 }}
            />
          </Card>
        ) : (
          <Text type="secondary">未读取到构建报告</Text>
        )}
        {riskChipBenchmarkError ? (
          <Alert type="warning" showIcon message={riskChipBenchmarkError} />
        ) : riskChipBenchmark ? (
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Space size={12} wrap>
              <Tag color={riskChipBenchmark.regressions.length === 0 ? 'success' : 'error'}>
                {riskChipBenchmark.regressions.length === 0
                  ? '风险命中基准通过'
                  : `风险命中回归 ${riskChipBenchmark.regressions.length}`}
              </Tag>
              <Text type="secondary">
                生成时间：{dayjs(riskChipBenchmark.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
              {riskChipBenchmark.baseline ? (
                <Text type="secondary">基线：{riskChipBenchmark.baseline.source}</Text>
              ) : null}
            </Space>
            {riskChipBenchmark.regressions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {riskChipBenchmark.regressions.map((item) => (
                  <div key={item} style={{ color: '#ff4d4f', fontSize: 12 }}>
                    {item}
                  </div>
                ))}
              </div>
            )}
            <Table
              size="small"
              style={{ marginTop: 8 }}
              rowKey="key"
              dataSource={riskChipBenchmark.cases}
              columns={riskChipBenchmarkColumns}
              pagination={false}
              scroll={{ x: 700 }}
            />
          </Card>
        ) : (
          <Text type="secondary">未读取到风险命中基准报告</Text>
        )}
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Space size={8} wrap>
            <Tag color="blue">路由渲染样本 {routeMetricTotal}</Tag>
            <Text type="secondary">数据来源：localStorage(spm_perf_metrics)</Text>
          </Space>
          <Table
            size="small"
            style={{ marginTop: 8 }}
            rowKey="key"
            dataSource={routeMetricRows}
            columns={routeMetricColumns}
            pagination={{ pageSize: 8, size: 'small' }}
            scroll={{ x: 760 }}
          />
        </Card>

        {/* 运行时性能监控 */}
        <Card
          size="small"
          title="运行时性能监控"
          styles={{ body: { padding: '8px 12px' } }}
          extra={
            <Space>
              <Select
                value={hours}
                onChange={setHours}
                style={{ width: 120 }}
                options={[
                  { label: '最近1小时', value: 1 },
                  { label: '最近6小时', value: 6 },
                  { label: '最近24小时', value: 24 },
                  { label: '最近7天', value: 168 },
                ]}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refreshAll()}
                loading={perfStatsLoading}
              >
                刷新
              </Button>
              <Button icon={<DeleteOutlined />} onClick={handleCleanupMetrics}>
                清理旧数据
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* 性能告警 */}
            {alerts.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`发现 ${alerts.length} 个性能告警`}
                description={
                  <Table
                    size="small"
                    dataSource={alerts}
                    columns={alertColumns}
                    pagination={false}
                    rowKey={(record) => `${record.metric_type}-${record.metric_name}`}
                  />
                }
              />
            )}

            {/* 性能统计概览 */}
            {stats.length > 0 && (
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="总样本数" value={stats.reduce((sum, s) => sum + s.count, 0)} />
                </Col>
                <Col span={6}>
                  <Statistic title="监控指标数" value={stats.length} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="平均响应时间"
                    value={
                      stats.length > 0
                        ? (stats.reduce((sum, s) => sum + s.avg, 0) / stats.length).toFixed(2)
                        : 0
                    }
                    suffix="ms"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="P95响应时间"
                    value={
                      stats.length > 0
                        ? (stats.reduce((sum, s) => sum + s.p95, 0) / stats.length).toFixed(2)
                        : 0
                    }
                    suffix="ms"
                  />
                </Col>
              </Row>
            )}

            {/* 性能统计表格 */}
            <Table
              size="small"
              loading={perfStatsLoading}
              dataSource={stats}
              columns={runtimeStatsColumns}
              pagination={{ pageSize: 10, size: 'small' }}
              rowKey={(record) => `${record.metric_type}-${record.metric_name}`}
              scroll={{ x: 1000 }}
              locale={{ emptyText: '暂无性能数据' }}
            />
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
