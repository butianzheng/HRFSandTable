export interface PerformanceMetric {
  id: number;
  metric_type: string;
  metric_name: string;
  value: number;
  unit: string;
  metadata?: string;
  created_at: string;
}

export interface PerformanceStats {
  metric_type: string;
  metric_name: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface PerformanceBaseline {
  metric_type: string;
  metric_name: string;
  baseline_avg: number;
  baseline_p95: number;
  warning_threshold: number;
  critical_threshold: number;
}

export interface PerformanceAlert {
  metric_type: string;
  metric_name: string;
  current_value: number;
  baseline_value: number;
  threshold_exceeded: number;
  severity: 'Warning' | 'Critical';
  timestamp: string;
}

export type MetricType =
  | 'app_startup'
  | 'page_render'
  | 'api_call'
  | 'algorithm_execution'
  | 'memory_usage'
  | 'database_query';

export interface RecordMetricRequest {
  metric_type: MetricType;
  metric_name: string;
  value: number;
  unit: string;
  metadata?: Record<string, unknown>;
}
