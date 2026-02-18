import { invoke } from '@tauri-apps/api/core';
import type {
  PerformanceStats,
  PerformanceBaseline,
  PerformanceAlert,
  RecordMetricRequest,
} from '../types/performance';

export const performanceApi = {
  /**
   * 记录性能指标
   */
  async recordMetric(request: RecordMetricRequest): Promise<void> {
    return invoke('record_performance_metric', { request });
  },

  /**
   * 获取性能统计数据
   */
  async getStats(
    metricType?: string,
    metricName?: string,
    hours?: number
  ): Promise<PerformanceStats[]> {
    return invoke('get_performance_stats', {
      metricType,
      metricName,
      hours,
    });
  },

  /**
   * 获取性能基线
   */
  async getBaselines(): Promise<PerformanceBaseline[]> {
    return invoke('get_performance_baselines');
  },

  /**
   * 检查性能告警
   */
  async checkAlerts(hours?: number): Promise<PerformanceAlert[]> {
    return invoke('check_performance_alerts', { hours });
  },

  /**
   * 清理旧的性能数据
   */
  async cleanupMetrics(days: number): Promise<number> {
    return invoke('cleanup_performance_metrics', { days });
  },
};

/**
 * 性能计时器工具类
 */
export class PerformanceTimer {
  private startTime: number;
  private metricType: RecordMetricRequest['metric_type'];
  private metricName: string;
  private metadata?: Record<string, unknown>;

  constructor(
    metricType: RecordMetricRequest['metric_type'],
    metricName: string,
    metadata?: Record<string, unknown>
  ) {
    this.startTime = performance.now();
    this.metricType = metricType;
    this.metricName = metricName;
    this.metadata = metadata;
  }

  /**
   * 结束计时并记录指标
   */
  async finish(): Promise<number> {
    const elapsed = performance.now() - this.startTime;

    await performanceApi.recordMetric({
      metric_type: this.metricType,
      metric_name: this.metricName,
      value: elapsed,
      unit: 'ms',
      metadata: this.metadata,
    });

    return elapsed;
  }

  /**
   * 获取已经过的时间（不记录）
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * 创建性能计时器
 */
export function createTimer(
  metricType: RecordMetricRequest['metric_type'],
  metricName: string,
  metadata?: Record<string, unknown>
): PerformanceTimer {
  return new PerformanceTimer(metricType, metricName, metadata);
}

/**
 * 记录页面渲染性能
 */
export async function recordPageRender(pageName: string): Promise<void> {
  // 使用 Performance API 获取页面加载时间
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (navigation) {
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;

    await performanceApi.recordMetric({
      metric_type: 'page_render',
      metric_name: pageName,
      value: loadTime,
      unit: 'ms',
    });
  }
}

/**
 * 记录内存使用情况
 */
export async function recordMemoryUsage(): Promise<void> {
  if ('memory' in performance) {
    const memory = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory;

    await performanceApi.recordMetric({
      metric_type: 'memory_usage',
      metric_name: 'heap_used',
      value: memory.usedJSHeapSize / 1024 / 1024, // 转换为 MB
      unit: 'MB',
    });
  }
}
