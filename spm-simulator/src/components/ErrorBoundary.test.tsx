import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ErrorBoundary from './ErrorBoundary';

// 创建一个会抛出错误的组件
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>正常内容</div>;
};

describe('ErrorBoundary', () => {
  // 抑制 console.error 输出，因为 React 会在错误边界捕获错误时输出
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('应该正常渲染子组件', () => {
    render(
      <ErrorBoundary>
        <div>测试内容</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('测试内容')).toBeInTheDocument();
  });

  it('应该捕获子组件抛出的错误', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // 应该显示错误 UI
    expect(screen.getByText('页面渲染出错')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    const retryButton = screen.getByRole('button');
    expect(retryButton).toBeInTheDocument();
  });

  it('应该在 componentDidCatch 中记录错误', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // 验证 console.error 被调用
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error),
      expect.any(String)
    );
  });

  it('应该在点击重试按钮后重置错误状态', async () => {
    const user = userEvent.setup();

    // 使用一个可以外部控制的变量
    let throwError = true;
    const ControlledThrowError = () => {
      if (throwError) {
        throw new Error('Test error message');
      }
      return <div>正常内容</div>;
    };

    const { rerender } = render(
      <ErrorBoundary key="test-1">
        <ControlledThrowError />
      </ErrorBoundary>
    );

    // 验证错误 UI 显示
    expect(screen.getByText('页面渲染出错')).toBeInTheDocument();

    // 修改控制变量，使组件不再抛出错误
    throwError = false;

    // 点击重试按钮
    const retryButton = screen.getByRole('button');
    await user.click(retryButton);

    // 重新渲染，使用新的 key 强制重新挂载
    rerender(
      <ErrorBoundary key="test-2">
        <ControlledThrowError />
      </ErrorBoundary>
    );

    // 应该显示正常内容
    expect(screen.getByText('正常内容')).toBeInTheDocument();
    expect(screen.queryByText('页面渲染出错')).not.toBeInTheDocument();
  });

  it('应该显示未知错误消息当错误对象没有 message 时', () => {
    // 创建一个抛出非标准错误的组件
    const ThrowNonStandardError = () => {
      throw { code: 'UNKNOWN' };
    };

    render(
      <ErrorBoundary>
        <ThrowNonStandardError />
      </ErrorBoundary>
    );

    expect(screen.getByText('页面渲染出错')).toBeInTheDocument();
    expect(screen.getByText('未知错误')).toBeInTheDocument();
  });

  it('应该在多次错误后仍能正常工作', async () => {
    const user = userEvent.setup();

    // 使用一个可以外部控制的变量
    let throwError = true;
    const ControlledThrowError = () => {
      if (throwError) {
        throw new Error('Test error message');
      }
      return <div>正常内容</div>;
    };

    // 第一次错误
    const { rerender } = render(
      <ErrorBoundary key="test-1">
        <ControlledThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('页面渲染出错')).toBeInTheDocument();

    // 重试 - 修复错误
    throwError = false;
    await user.click(screen.getByRole('button', { name: /重.*试/ }));
    rerender(
      <ErrorBoundary key="test-2">
        <ControlledThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();

    // 第二次错误
    throwError = true;
    rerender(
      <ErrorBoundary key="test-3">
        <ControlledThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('页面渲染出错')).toBeInTheDocument();

    // 再次重试 - 再次修复
    throwError = false;
    await user.click(screen.getByRole('button'));
    rerender(
      <ErrorBoundary key="test-4">
        <ControlledThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });
});
