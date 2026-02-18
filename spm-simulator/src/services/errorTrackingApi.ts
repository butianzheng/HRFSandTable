import { invoke } from '@tauri-apps/api/core';
import type {
  LogErrorRequest,
  GetErrorsRequest,
  GetErrorsResponse,
  ErrorStats,
} from '../types/error';

export const errorTrackingApi = {
  /**
   * 记录错误
   */
  async logError(request: LogErrorRequest): Promise<void> {
    return invoke('log_error', { request });
  },

  /**
   * 获取错误列表
   */
  async getErrors(request: GetErrorsRequest): Promise<GetErrorsResponse> {
    return invoke('get_errors', { request });
  },

  /**
   * 获取错误统计
   */
  async getStats(): Promise<ErrorStats> {
    return invoke('get_error_stats');
  },

  /**
   * 标记错误为已解决
   */
  async resolveError(errorId: number): Promise<void> {
    return invoke('resolve_error', { errorId });
  },

  /**
   * 删除错误
   */
  async deleteError(errorId: number): Promise<void> {
    return invoke('delete_error', { errorId });
  },

  /**
   * 清理旧错误
   */
  async cleanupOldErrors(days: number): Promise<number> {
    return invoke('cleanup_old_errors', { days });
  },
};

/**
 * 全局错误处理器
 */
export function setupGlobalErrorHandler(): void {
  // 捕获未处理的错误
  window.addEventListener('error', (event) => {
    errorTrackingApi
      .logError({
        error_type: 'frontend',
        severity: 'error',
        message: event.message,
        stack_trace: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        user_agent: navigator.userAgent,
        url: window.location.href,
      })
      .catch((err) => {
        console.error('Failed to log error:', err);
      });
  });

  // 捕获未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    errorTrackingApi
      .logError({
        error_type: 'frontend',
        severity: 'error',
        message: event.reason?.message || String(event.reason),
        stack_trace: event.reason?.stack,
        context: {
          type: 'unhandledrejection',
        },
        user_agent: navigator.userAgent,
        url: window.location.href,
      })
      .catch((err) => {
        console.error('Failed to log promise rejection:', err);
      });
  });
}

/**
 * 手动记录错误
 */
export async function logError(
  message: string,
  error?: Error,
  context?: Record<string, unknown>
): Promise<void> {
  await errorTrackingApi.logError({
    error_type: 'frontend',
    severity: 'error',
    message,
    stack_trace: error?.stack,
    context,
    user_agent: navigator.userAgent,
    url: window.location.href,
  });
}

/**
 * 记录警告
 */
export async function logWarning(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await errorTrackingApi.logError({
    error_type: 'frontend',
    severity: 'warning',
    message,
    context,
    user_agent: navigator.userAgent,
    url: window.location.href,
  });
}
