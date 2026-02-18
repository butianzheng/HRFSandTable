import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Tabs, Button, message, Spin, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { configApi } from '../../services/configApi';
import { useSearchParams } from 'react-router-dom';
import type { SystemConfig, ShiftConfig } from '../../types/config';
import { getErrorMessage } from '../../utils/error';
import { configGroups } from './types';
import ConfigPanel from './ConfigPanel';
import PriorityConfigPanel from './PriorityConfigPanel';
import PerformanceTab from './PerformanceTab';
import MaintenanceTab from './MaintenanceTab';
import ErrorLogsTab from './ErrorLogsTab';

const { Text } = Typography;

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState<string>('temp');
  const [refreshCounter, setRefreshCounter] = useState(0);
  const priorityFocusKey = searchParams.get('priorityKey') ?? '';
  const initialTabRef = useRef(searchParams.get('tab'));

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [data, shiftRows] = await Promise.all([
        configApi.getSystemConfig(),
        configApi.getShiftConfig(),
      ]);
      if (shiftRows.length > 0) {
        const shiftGroup = data.shift ?? {};
        shiftRows.forEach((item: ShiftConfig) => {
          shiftGroup[item.key] = {
            value: item.value,
            value_type: 'string',
            description: shiftGroup[item.key]?.description,
          };
        });
        data.shift = shiftGroup;
      }
      setConfig(data);
    } catch (error: unknown) {
      message.error(`加载配置失败: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const prefetchMaintenancePlans = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      await configApi.getMaintenancePlans();
    } catch {
      // MaintenanceTab handles its own error display
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    // Skip prefetch when maintenance tab is already active — MaintenanceTab handles its own loading
    if (initialTabRef.current !== 'maintenance') {
      prefetchMaintenancePlans();
    }
  }, [fetchConfig, prefetchMaintenancePlans]);

  const handleSaveConfig = async (group: string, key: string, value: string) => {
    if (group === 'shift') {
      const payload: ShiftConfig[] = [{ key, value }];
      await configApi.updateShiftConfig(payload);
      return;
    }
    await configApi.updateSystemConfig(group, key, value);
  };

  const tabItems = useMemo(
    () => [
      { key: 'temp', label: '适温参数' },
      { key: 'capacity', label: '产能参数' },
      { key: 'shift', label: '班次设置' },
      { key: 'roll', label: '换辊参数' },
      { key: 'scheduler', label: '调度算法' },
      { key: 'constraint', label: '约束阈值' },
      { key: 'warning', label: '预警设置' },
      { key: 'undo', label: '撤销设置' },
      { key: 'backup', label: '备份设置' },
      { key: 'priority', label: '优先级配置' },
      { key: 'maintenance', label: '检修计划' },
      { key: 'performance', label: '性能验收' },
      { key: 'error_logs', label: '错误日志' },
    ],
    []
  );

  useEffect(() => {
    const queryTab = searchParams.get('tab');
    if (queryTab && tabItems.some((item) => item.key === queryTab)) {
      setActiveTabKey(queryTab);
      return;
    }
    if (priorityFocusKey) {
      setActiveTabKey('priority');
    }
  }, [priorityFocusKey, searchParams, tabItems]);

  const handleRefresh = () => {
    fetchConfig();
    prefetchMaintenancePlans();
    setRefreshCounter((prev) => prev + 1);
  };

  const handleClearPriorityFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('priorityKey');
    if (!next.get('tab')) {
      next.set('tab', 'priority');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <Card
      title="设置中心"
      size="small"
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading || maintenanceLoading}
        >
          刷新
        </Button>
      }
    >
      <Spin spinning={loading || maintenanceLoading}>
        <Tabs
          tabPosition="left"
          activeKey={activeTabKey}
          onChange={(nextKey) => setActiveTabKey(nextKey)}
          items={tabItems.map((tab) => ({
            key: tab.key,
            label: tab.label,
            children:
              tab.key === 'performance' ? (
                <PerformanceTab refreshTrigger={refreshCounter} />
              ) : tab.key === 'error_logs' ? (
                <ErrorLogsTab refreshTrigger={refreshCounter} />
              ) : tab.key === 'priority' ? (
                <Card size="small">
                  <PriorityConfigPanel
                    focusKey={priorityFocusKey}
                    onClearFocus={handleClearPriorityFocus}
                  />
                </Card>
              ) : tab.key === 'maintenance' ? (
                <MaintenanceTab refreshTrigger={refreshCounter} />
              ) : configGroups[tab.key] ? (
                <ConfigPanel
                  group={tab.key}
                  fields={configGroups[tab.key]}
                  config={config?.[tab.key]}
                  onSave={handleSaveConfig}
                />
              ) : (
                <Text type="secondary">配置加载中...</Text>
              ),
          }))}
        />
      </Spin>
    </Card>
  );
}
