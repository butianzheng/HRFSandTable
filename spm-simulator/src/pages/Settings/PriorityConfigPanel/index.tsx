import { Tabs, Button, Space, Spin, Table } from 'antd';
import { SaveOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';

import { nextSortOrder } from '../types';
import { usePriorityData } from './usePriorityData';
import { usePriorityColumns } from './usePriorityColumns';
import PriorityToolbar from './PriorityToolbar';

export default function PriorityConfigPanel({
  focusKey,
  onClearFocus,
}: {
  focusKey: string;
  onClearFocus: () => void;
}) {
  const d = usePriorityData({ focusKey, onClearFocus });
  const cols = usePriorityColumns({
    setWeightRows: d.setWeightRows,
    setDimensionRows: d.setDimensionRows,
    setCustomerRows: d.setCustomerRows,
    setBatchRows: d.setBatchRows,
    setProductRows: d.setProductRows,
    handleDeleteDimensionRow: d.handleDeleteDimensionRow,
    handleDeleteCustomerRow: d.handleDeleteCustomerRow,
    handleDeleteBatchRow: d.handleDeleteBatchRow,
    handleDeleteProductRow: d.handleDeleteProductRow,
  });

  return (
    <Spin spinning={d.loading || d.saving}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <PriorityToolbar
          saving={d.saving}
          loading={d.loading}
          focusKey={focusKey}
          onClearFocus={onClearFocus}
          onImport={d.handleImportPriorityConfigs}
          onExportTemplate={d.handleExportPriorityTemplate}
          onExportConfigs={d.handleExportPriorityConfigs}
          onRefresh={d.fetchPriorityConfigs}
        />
        <Tabs
          activeKey={d.activeSubTab}
          onChange={d.setActiveSubTab}
          items={[
            {
              key: 'weights',
              label: '权重配置',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={d.handleSaveWeights}
                      loading={d.saving}
                    >
                      保存权重
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={d.fetchPriorityConfigs}
                      loading={d.loading}
                    >
                      刷新
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={d.shownWeightRows}
                    columns={cols.weightColumns}
                    pagination={false}
                    scroll={{ x: 900 }}
                  />
                </Space>
              ),
            },
            {
              key: 'dimensions',
              label: '交期/合同维度',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        d.setDimensionRows((prev) => [
                          ...prev,
                          {
                            key: d.createTempKey('dimension'),
                            dimension_type: 'delivery',
                            dimension_code: '',
                            dimension_name: '',
                            score: 0,
                            enabled: true,
                            sort_order: nextSortOrder(prev),
                            rule_config: '',
                            description: '',
                          },
                        ]);
                      }}
                    >
                      新增
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={d.handleSaveDimensions}
                      loading={d.saving}
                    >
                      保存
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={d.fetchPriorityConfigs}
                      loading={d.loading}
                    >
                      刷新
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={d.shownDimensionRows}
                    columns={cols.dimensionColumns}
                    pagination={false}
                    scroll={{ x: 1400 }}
                  />
                </Space>
              ),
            },
            {
              key: 'customers',
              label: '客户优先级',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        d.setCustomerRows((prev) => [
                          ...prev,
                          {
                            key: d.createTempKey('customer'),
                            customer_code: '',
                            customer_name: '',
                            priority_level: 'normal',
                            priority_score: 50,
                            enabled: true,
                            remarks: '',
                          },
                        ]);
                      }}
                    >
                      新增
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={d.handleSaveCustomers}
                      loading={d.saving}
                    >
                      保存
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={d.fetchPriorityConfigs}
                      loading={d.loading}
                    >
                      刷新
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={d.shownCustomerRows}
                    columns={cols.customerColumns}
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </Space>
              ),
            },
            {
              key: 'batches',
              label: '集批优先级',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        d.setBatchRows((prev) => [
                          ...prev,
                          {
                            key: d.createTempKey('batch'),
                            batch_code: '',
                            batch_name: '',
                            priority_type: 'normal',
                            priority_score: 0,
                            enabled: true,
                            remarks: '',
                          },
                        ]);
                      }}
                    >
                      新增
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={d.handleSaveBatches}
                      loading={d.saving}
                    >
                      保存
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={d.fetchPriorityConfigs}
                      loading={d.loading}
                    >
                      刷新
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={d.shownBatchRows}
                    columns={cols.batchColumns}
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </Space>
              ),
            },
            {
              key: 'products',
              label: '产品大类优先级',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        d.setProductRows((prev) => [
                          ...prev,
                          {
                            key: d.createTempKey('product'),
                            product_type: '',
                            product_name: '',
                            priority_level: 'normal',
                            priority_score: 0,
                            enabled: true,
                            remarks: '',
                          },
                        ]);
                      }}
                    >
                      新增
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={d.handleSaveProducts}
                      loading={d.saving}
                    >
                      保存
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={d.fetchPriorityConfigs}
                      loading={d.loading}
                    >
                      刷新
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={d.shownProductRows}
                    columns={cols.productColumns}
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Spin>
  );
}
