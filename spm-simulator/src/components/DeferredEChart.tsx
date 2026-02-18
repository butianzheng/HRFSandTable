import { memo, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';

interface DeferredEChartProps {
  echarts: unknown;
  option: unknown;
  style?: CSSProperties;
  className?: string;
  onEvents?: unknown;
  rootMargin?: string;
  placeholder?: ReactNode;
  notMerge?: boolean;
  lazyUpdate?: boolean;
}

export default memo(function DeferredEChart({
  echarts,
  option,
  style,
  className,
  onEvents,
  rootMargin = '120px 0px',
  placeholder,
  notMerge,
  lazyUpdate,
}: DeferredEChartProps) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const canDefer = typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';
  const [mounted, setMounted] = useState(!canDefer);

  useEffect(() => {
    if (mounted) return;
    const target = holderRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div ref={holderRef} className={className} style={style}>
      {mounted ? (
        <ReactEChartsCore
          echarts={echarts as never}
          option={option as never}
          style={{ width: '100%', height: '100%' }}
          onEvents={onEvents as never}
          notMerge={notMerge}
          lazyUpdate={lazyUpdate}
        />
      ) : (
        (placeholder ?? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8c8c8c',
              fontSize: 12,
            }}
          >
            图表进入可视区后加载
          </div>
        ))
      )}
    </div>
  );
});
