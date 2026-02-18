import { memo } from 'react';
import { Button, Space, Typography, Alert } from 'antd';
import { UploadOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface PriorityToolbarProps {
  saving: boolean;
  loading: boolean;
  focusKey: string;
  onClearFocus: () => void;
  onImport: (dryRun: boolean) => Promise<void>;
  onExportTemplate: (format: 'excel' | 'csv') => Promise<void>;
  onExportConfigs: (format: 'excel' | 'csv') => Promise<void>;
  onRefresh: () => Promise<void>;
}

export default memo(function PriorityToolbar({
  saving,
  loading,
  focusKey,
  onClearFocus,
  onImport,
  onExportTemplate,
  onExportConfigs,
  onRefresh,
}: PriorityToolbarProps) {
  return (
    <>
      <Space wrap>
        <Button icon={<UploadOutlined />} onClick={() => onImport(true)} loading={saving}>
          预检导入
        </Button>
        <Button icon={<UploadOutlined />} onClick={() => onImport(false)} loading={saving}>
          执行导入
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => onExportTemplate('excel')}
          loading={saving}
        >
          模板 Excel
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => onExportTemplate('csv')}
          loading={saving}
        >
          模板 CSV
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => onExportConfigs('excel')}
          loading={saving}
        >
          导出 Excel
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => onExportConfigs('csv')} loading={saving}>
          导出 CSV
        </Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Text type="secondary">
          建议先预检再导入；Excel 多
          Sheet：`weight_config`/`dimension_config`/`customer_config`/`batch_config`/`product_type_config`
        </Text>
      </Space>
      {focusKey && (
        <Alert
          type="info"
          showIcon
          message={
            <Space size={8} wrap>
              <span>已定位配置项：{focusKey}</span>
              <Button type="link" size="small" onClick={onClearFocus}>
                清除定位
              </Button>
            </Space>
          }
        />
      )}
    </>
  );
});
