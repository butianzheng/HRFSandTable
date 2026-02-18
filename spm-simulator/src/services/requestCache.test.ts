import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invokeDeduped, clearInvokeCache } from './requestCache';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('requestCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInvokeCache();
  });

  afterEach(() => {
    clearInvokeCache();
  });

  describe('invokeDeduped', () => {
    it('应该调用 Tauri invoke 并返回结果', async () => {
      const mockResult = { id: 1, name: 'test' };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await invokeDeduped('test_command', { arg: 'value' });

      expect(invoke).toHaveBeenCalledWith('test_command', { arg: 'value' });
      expect(result).toEqual(mockResult);
    });

    it('应该缓存带 TTL 的请求结果', async () => {
      const mockResult = { id: 1, name: 'test' };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      // 第一次调用
      const result1 = await invokeDeduped('test_command', { arg: 'value' }, 5000);
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockResult);

      // 第二次调用应该使用缓存
      const result2 = await invokeDeduped('test_command', { arg: 'value' }, 5000);
      expect(invoke).toHaveBeenCalledTimes(1); // 仍然是 1 次
      expect(result2).toEqual(mockResult);
    });

    it('应该在 TTL 过期后重新请求', async () => {
      const mockResult1 = { id: 1, name: 'test1' };
      const mockResult2 = { id: 2, name: 'test2' };
      vi.mocked(invoke).mockResolvedValueOnce(mockResult1).mockResolvedValueOnce(mockResult2);

      // 第一次调用
      const result1 = await invokeDeduped('test_command', { arg: 'value' }, 10);
      expect(result1).toEqual(mockResult1);

      // 等待 TTL 过期
      await new Promise((resolve) => setTimeout(resolve, 20));

      // 第二次调用应该重新请求
      const result2 = await invokeDeduped('test_command', { arg: 'value' }, 10);
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(result2).toEqual(mockResult2);
    });

    it('应该对相同请求去重（inflight deduplication）', async () => {
      const mockResult = { id: 1, name: 'test' };
      let resolveInvoke: (value: unknown) => void;
      const invokePromise = new Promise((resolve) => {
        resolveInvoke = resolve;
      });
      vi.mocked(invoke).mockReturnValue(invokePromise);

      // 同时发起两个相同的请求
      const promise1 = invokeDeduped('test_command', { arg: 'value' });
      const promise2 = invokeDeduped('test_command', { arg: 'value' });

      // 应该只调用一次 invoke
      expect(invoke).toHaveBeenCalledTimes(1);

      // 解析请求
      resolveInvoke!(mockResult);
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(mockResult);
      expect(result2).toEqual(mockResult);
    });

    it('应该为不同参数创建不同的缓存键', async () => {
      const mockResult1 = { id: 1 };
      const mockResult2 = { id: 2 };
      vi.mocked(invoke).mockResolvedValueOnce(mockResult1).mockResolvedValueOnce(mockResult2);

      const result1 = await invokeDeduped('test_command', { arg: 'value1' }, 5000);
      const result2 = await invokeDeduped('test_command', { arg: 'value2' }, 5000);

      expect(invoke).toHaveBeenCalledTimes(2);
      expect(result1).toEqual(mockResult1);
      expect(result2).toEqual(mockResult2);
    });

    it('应该在 TTL 为 0 时不缓存', async () => {
      const mockResult1 = { id: 1 };
      const mockResult2 = { id: 2 };
      vi.mocked(invoke).mockResolvedValueOnce(mockResult1).mockResolvedValueOnce(mockResult2);

      const result1 = await invokeDeduped('test_command', { arg: 'value' }, 0);
      const result2 = await invokeDeduped('test_command', { arg: 'value' }, 0);

      expect(invoke).toHaveBeenCalledTimes(2);
      expect(result1).toEqual(mockResult1);
      expect(result2).toEqual(mockResult2);
    });
  });

  describe('clearInvokeCache', () => {
    it('应该清除所有缓存', async () => {
      const mockResult = { id: 1 };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      // 创建缓存
      await invokeDeduped('test_command', { arg: 'value' }, 5000);
      expect(invoke).toHaveBeenCalledTimes(1);

      // 清除缓存
      clearInvokeCache();

      // 再次调用应该重新请求
      await invokeDeduped('test_command', { arg: 'value' }, 5000);
      expect(invoke).toHaveBeenCalledTimes(2);
    });

    it('应该只清除指定前缀的缓存', async () => {
      const mockResult = { id: 1 };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      // 创建多个缓存
      await invokeDeduped('get_plan', { id: 1 }, 5000);
      await invokeDeduped('get_material', { id: 1 }, 5000);
      expect(invoke).toHaveBeenCalledTimes(2);

      // 只清除 get_plan 前缀的缓存
      clearInvokeCache('get_plan');

      // get_plan 应该重新请求
      await invokeDeduped('get_plan', { id: 1 }, 5000);
      expect(invoke).toHaveBeenCalledTimes(3);

      // get_material 应该使用缓存
      await invokeDeduped('get_material', { id: 1 }, 5000);
      expect(invoke).toHaveBeenCalledTimes(3); // 仍然是 3 次
    });
  });
});
