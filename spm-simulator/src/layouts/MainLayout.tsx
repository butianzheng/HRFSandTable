import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Layout, Menu, Spin } from 'antd';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  ScheduleOutlined,
  SettingOutlined,
  DashboardOutlined,
  SwapOutlined,
  HistoryOutlined,
  LinkOutlined,
  ToolOutlined,
  FileTextOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const routeLoaders = {
  '/': () => import('../pages/Workbench'),
  '/strategy': () => import('../pages/Strategy'),
  '/risk': () => import('../pages/RiskOverview'),
  '/compare': () => import('../pages/Compare'),
  '/history': () => import('../pages/History'),
  '/mapping': () => import('../pages/FieldMapping'),
  '/settings': () => import('../pages/Settings'),
  '/logs': () => import('../pages/Logs'),
  '/data': () => import('../pages/DataManage'),
} as const;

type RoutePath = keyof typeof routeLoaders;

const Workbench = lazy(routeLoaders['/']);
const Strategy = lazy(routeLoaders['/strategy']);
const RiskOverview = lazy(routeLoaders['/risk']);
const Compare = lazy(routeLoaders['/compare']);
const History = lazy(routeLoaders['/history']);
const FieldMapping = lazy(routeLoaders['/mapping']);
const Settings = lazy(routeLoaders['/settings']);
const Logs = lazy(routeLoaders['/logs']);
const DataManage = lazy(routeLoaders['/data']);

const { Sider, Content, Header } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  {
    key: '/',
    icon: <ScheduleOutlined />,
    label: '计划工作台',
  },
  {
    key: '/strategy',
    icon: <SettingOutlined />,
    label: '策略配置',
  },
  {
    key: '/risk',
    icon: <DashboardOutlined />,
    label: '风险概览',
  },
  {
    key: '/compare',
    icon: <SwapOutlined />,
    label: '方案对比',
  },
  {
    key: '/history',
    icon: <HistoryOutlined />,
    label: '历史追溯',
  },
  {
    key: '/mapping',
    icon: <LinkOutlined />,
    label: '数据映射',
  },
  {
    key: '/settings',
    icon: <ToolOutlined />,
    label: '设置中心',
  },
  {
    key: '/logs',
    icon: <FileTextOutlined />,
    label: '日志管理',
  },
  {
    key: '/data',
    icon: <DatabaseOutlined />,
    label: '数据管理',
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const prefetchRoute = useCallback((path: string) => {
    const loader = routeLoaders[path as RoutePath];
    if (!loader) return;
    void loader();
  }, []);

  const prefetchHeavyRoutes = useCallback(() => {
    prefetchRoute('/risk');
    prefetchRoute('/compare');
    prefetchRoute('/history');
  }, [prefetchRoute]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(prefetchHeavyRoutes, { timeout: 1500 });
      return () => {
        if (typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleId);
        }
      };
    }
    const timer = window.setTimeout(prefetchHeavyRoutes, 400);
    return () => window.clearTimeout(timer);
  }, [prefetchHeavyRoutes]);

  const recordRouteRenderCost = useCallback((path: string, costMs: number) => {
    const metric = {
      type: 'route-render',
      path,
      costMs: Number(costMs.toFixed(2)),
      ts: Date.now(),
    };
    try {
      const key = 'spm_perf_metrics';
      const raw = localStorage.getItem(key);
      const history = raw ? (JSON.parse(raw) as Array<typeof metric>) : [];
      localStorage.setItem(key, JSON.stringify([metric, ...history].slice(0, 200)));
    } catch {
      // ignore localStorage failures
    }
    if (import.meta.env.DEV) {
      console.info(`[perf] route-render ${path}: ${metric.costMs}ms`);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    const start = performance.now();
    const raf = window.requestAnimationFrame(() => {
      recordRouteRenderCost(location.pathname, performance.now() - start);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname, recordRouteRenderCost]);

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    prefetchRoute(key);
    navigate(key);
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={200}
        style={{
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 600,
            fontSize: collapsed ? 14 : 16,
            color: '#1677ff',
          }}
        >
          {collapsed ? 'SPM' : '排程沙盘'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={onMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            height: 48,
            lineHeight: '48px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500 }}>热轧平整机组排程沙盘模拟系统</span>
          <span style={{ color: '#999', fontSize: 12 }}>v0.1.0</span>
        </Header>
        <Content
          style={{
            margin: 0,
            padding: 16,
            background: '#f5f5f5',
            overflow: 'auto',
            flex: 1,
          }}
        >
          <ErrorBoundary>
            <Suspense
              fallback={
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Spin size="large" />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Workbench />} />
                <Route path="/strategy" element={<Strategy />} />
                <Route path="/risk" element={<RiskOverview />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/history" element={<History />} />
                <Route path="/mapping" element={<FieldMapping />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/data" element={<DataManage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
