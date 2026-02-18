import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DeferredEChart from './DeferredEChart';

vi.mock('echarts-for-react/lib/core', () => ({
  default: () => <div data-testid="echart-core">mounted</div>,
}));

type ObserverInstance = {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
  trigger: (isIntersecting: boolean) => void;
};

function createObserverClass(instances: ObserverInstance[]) {
  return class MockIntersectionObserver {
    callback: IntersectionObserverCallback;

    options?: IntersectionObserverInit;

    observe = vi.fn();

    unobserve = vi.fn();

    disconnect = vi.fn();

    takeRecords = vi.fn(() => []);

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      instances.push(this as unknown as ObserverInstance);
    }

    trigger(isIntersecting: boolean) {
      const entry = { isIntersecting } as IntersectionObserverEntry;
      this.callback([entry], this as unknown as IntersectionObserver);
    }
  };
}

describe('DeferredEChart', () => {
  const originalObserver = globalThis.IntersectionObserver;
  const instances: ObserverInstance[] = [];

  beforeEach(() => {
    instances.length = 0;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalObserver;
  });

  it('在不支持 IntersectionObserver 时立即挂载图表', () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
    render(<DeferredEChart echarts={{}} option={{ title: 'x' }} />);
    expect(screen.getByTestId('echart-core')).toBeInTheDocument();
  });

  it('进入可视区后再挂载图表', () => {
    const MockObserver = createObserverClass(instances);
    globalThis.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;

    render(
      <DeferredEChart
        echarts={{}}
        option={{ title: 'x' }}
        rootMargin="24px 0px"
        placeholder={<div data-testid="chart-placeholder">loading</div>}
      />
    );

    expect(screen.getByTestId('chart-placeholder')).toBeInTheDocument();
    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledTimes(1);
    expect(instances[0].options?.rootMargin).toBe('24px 0px');

    act(() => {
      instances[0].trigger(true);
    });

    expect(screen.getByTestId('echart-core')).toBeInTheDocument();
  });
});
