export interface ErrorLog {
  id: number;
  error_type: string;
  severity: string;
  message: string;
  stack_trace?: string;
  context?: string;
  user_agent?: string;
  url?: string;
  fingerprint: string;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved: boolean;
  resolved_at?: string;
}

export interface ErrorStats {
  total_errors: number;
  unresolved_errors: number;
  error_by_type: ErrorTypeCount[];
  error_by_severity: ErrorSeverityCount[];
  recent_errors: ErrorLog[];
}

export interface ErrorTypeCount {
  error_type: string;
  count: number;
}

export interface ErrorSeverityCount {
  severity: string;
  count: number;
}

export interface ErrorFilter {
  error_type?: string;
  severity?: string;
  resolved?: boolean;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export type ErrorType = 'frontend' | 'backend' | 'panic';
export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface LogErrorRequest {
  error_type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  user_agent?: string;
  url?: string;
}

export interface GetErrorsRequest {
  filter: ErrorFilter;
  page: number;
  page_size: number;
}

export interface GetErrorsResponse {
  errors: ErrorLog[];
  total: number;
}
