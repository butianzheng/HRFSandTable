import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // 性能优化配置
    pool: 'forks',
    maxConcurrency: 10,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'dist/coverage',
      reporter: ['text', 'json-summary'],
      include: [
        'src/pages/*/index.tsx',
        'src/pages/Workbench/useScheduleOperations.ts',
        'src/pages/Workbench/useDragDrop.ts',
        'src/pages/Workbench/GanttView.tsx',
        'src/pages/FieldMapping/helpers.ts',
        'src/utils/priorityHit.ts',
        'src/utils/riskConfig.ts',
        'src/components/DeferredEChart.tsx',
        'src/components/ErrorBoundary.tsx',
        'src/components/MaterialTable.tsx',
        'src/services/*.ts',
        'src/stores/*.ts',
        'src/hooks/*.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }
          if (
            id.includes('/node_modules/echarts/') ||
            id.includes('/node_modules/zrender/') ||
            id.includes('/node_modules/echarts-for-react/')
          ) {
            if (id.includes('/node_modules/echarts-for-react/')) {
              return 'vendor-echarts-react';
            }
            if (id.includes('/node_modules/zrender/')) {
              return 'vendor-zrender';
            }
            if (id.includes('/node_modules/echarts/charts/')) {
              return 'vendor-echarts-charts';
            }
            if (id.includes('/node_modules/echarts/components/')) {
              return 'vendor-echarts-components';
            }
            if (id.includes('/node_modules/echarts/core')) {
              return 'vendor-echarts-core';
            }
            return 'vendor-echarts';
          }
          if (
            id.includes('/node_modules/@ant-design/icons/') ||
            id.includes('/node_modules/@ant-design/icons-svg/')
          ) {
            return 'vendor-ant-icons';
          }
          return undefined;
        },
      },
    },
  },
});
