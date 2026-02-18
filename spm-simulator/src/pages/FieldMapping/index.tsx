import { useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Select,
  AutoComplete,
  Popconfirm,
  Tag,
  Typography,
  Row,
  Col,
  Divider,
  Alert,
  Switch,
  Tooltip,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import type { FieldMapping as FieldMappingType, FieldMappingItem } from '../../types/fieldMapping';
import {
  useFieldMappingData,
  targetFields,
  getRulePresetOptions,
  DATE_FORMAT_PRESET_OPTIONS,
  type TempPreviewRow,
} from './useFieldMappingData';
import TestResultModal from './TestResultModal';
import MappingDetailModal from './MappingDetailModal';

const { Text } = Typography;

export default function FieldMapping() {
  const fm = useFieldMappingData();

  const {
    copyingId,
    settingDefaultId,
    handleDetail,
    handleEdit,
    handleDuplicate,
    handleSetDefault,
    handleDelete,
  } = fm;

  const columns = useMemo(
    () => [
      { title: '模板名称', dataIndex: 'template_name', key: 'template_name' },
      {
        title: '数据源类型',
        dataIndex: 'source_type',
        key: 'source_type',
        render: (v: string) => (
          <Tag color={v === 'excel' ? 'blue' : 'green'}>{v === 'excel' ? 'Excel' : 'CSV'}</Tag>
        ),
      },
      {
        title: '默认',
        dataIndex: 'is_default',
        key: 'is_default',
        render: (v: boolean) => (v ? <Tag color="gold">默认</Tag> : '-'),
      },
      {
        title: '映射字段数',
        key: 'field_count',
        render: (_: unknown, record: FieldMappingType) => {
          try {
            const items = JSON.parse(record.mappings);
            return Array.isArray(items) ? items.length : 0;
          } catch {
            return 0;
          }
        },
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        key: 'updated_at',
        render: (v: string) => v?.slice(0, 19).replace('T', ' ') || '-',
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: unknown, record: FieldMappingType) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleDetail(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              loading={copyingId === record.id}
              onClick={() => handleDuplicate(record)}
            >
              复制
            </Button>
            {!record.is_default && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={settingDefaultId === record.id}
                onClick={() => handleSetDefault(record)}
              >
                设为默认
              </Button>
            )}
            <Popconfirm title="确定删除此映射模板？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      copyingId,
      settingDefaultId,
      handleDetail,
      handleEdit,
      handleDuplicate,
      handleSetDefault,
      handleDelete,
    ]
  );

  return (
    <Card
      title="数据映射配置"
      size="small"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={fm.handleCreate}>
          新建映射模板
        </Button>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={fm.mappings}
        loading={fm.loading}
        pagination={{ pageSize: 10 }}
        size="small"
      />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={fm.editingId ? '编辑映射模板' : '新建映射模板'}
        open={fm.modalOpen}
        onOk={fm.handleSave}
        onCancel={() => fm.setModalOpen(false)}
        width={800}
        destroyOnClose
      >
        <Form form={fm.form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="template_name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="如：MES导出格式" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source_type" label="数据源类型" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'excel', label: 'Excel (.xlsx)' },
                    { value: 'csv', label: 'CSV (.csv)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="is_default"
                label="设为默认模板"
                valuePropName="checked"
                style={{ marginBottom: 8 }}
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider titlePlacement="left" plain>
          字段映射配置
        </Divider>

        <Card size="small" style={{ marginBottom: 12 }}>
          <Space wrap>
            <Button onClick={fm.handlePreviewFile} loading={fm.previewLoading}>
              选择源文件并预览
            </Button>
            <Button type="dashed" onClick={fm.handleApplyPreviewMapping} disabled={!fm.previewData}>
              按表头自动匹配
            </Button>
            <Button
              type="primary"
              ghost
              loading={fm.testImporting}
              onClick={fm.handleTestImport}
              disabled={!fm.previewFilePath}
            >
              测试导入（沙盒）
            </Button>
            {fm.previewFilePath && <Text type="secondary">当前文件：{fm.previewFilePath}</Text>}
          </Space>
          {fm.previewData && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                检测到 {fm.previewData.headers.length} 列，共 {fm.previewData.total_rows}{' '}
                行数据（展示前 {fm.previewData.sample_rows.length} 行）
              </Text>
              <div style={{ marginTop: 8 }}>
                <Space size={[4, 4]} wrap>
                  {fm.previewData.headers.map((header) => (
                    <Tag key={header}>{header}</Tag>
                  ))}
                </Space>
              </div>
              {fm.previewData.sample_rows.length > 0 && (
                <Table
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  scroll={{ x: true }}
                  dataSource={fm.previewData.sample_rows.map((row, rowIndex) => {
                    const record: Record<string, string> = { _key: String(rowIndex) };
                    row.forEach((value, index) => {
                      record[String(index)] = value;
                    });
                    return record;
                  })}
                  rowKey="_key"
                  columns={fm.previewData.headers.map((header, index) => ({
                    title: header || `列${index + 1}`,
                    dataIndex: String(index),
                    width: 120,
                    render: (value: string) => value || '-',
                  }))}
                />
              )}

              <div style={{ marginTop: 12 }}>
                <Space size={[6, 6]} wrap>
                  <Tag color="blue">映射字段: {fm.mappingDiagnosis.mappedCount}</Tag>
                  <Tag color="green">
                    源列匹配: {fm.mappingDiagnosis.matchedSourceCount}/
                    {fm.mappingDiagnosis.sourceCount}
                  </Tag>
                  <Tag color={fm.tempPreview.headerName ? 'cyan' : 'orange'}>
                    适温预览列: {fm.tempPreview.headerName || '未识别'}
                  </Tag>
                </Space>
              </div>

              {/* 诊断告警 */}
              {fm.mappingDiagnosis.missingRequired.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="error"
                  showIcon
                  message={`缺少必填目标字段映射: ${fm.mappingDiagnosis.missingRequired.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.duplicateTargets.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`存在重复目标字段映射: ${fm.mappingDiagnosis.duplicateTargets.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.sourceMissingInPreview.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`以下源列在预览文件中未找到: ${fm.mappingDiagnosis.sourceMissingInPreview.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.transformMissingRule.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`以下值转换字段缺少规则: ${fm.mappingDiagnosis.transformMissingRule.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.transformInvalidRule.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="error"
                  showIcon
                  message={`以下值转换规则无法解析: ${fm.mappingDiagnosis.transformInvalidRule.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.calculateInvalidRule.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="error"
                  showIcon
                  message={`以下计算规则无效: ${fm.mappingDiagnosis.calculateInvalidRule.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.defaultMissingValue.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="error"
                  showIcon
                  message={`以下默认值映射缺少默认值: ${fm.mappingDiagnosis.defaultMissingValue.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.combineRuleWarning.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`以下组合规则需关注: ${fm.mappingDiagnosis.combineRuleWarning.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.dateFormatWarning.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`以下日期映射未配置格式，将使用自动识别: ${fm.mappingDiagnosis.dateFormatWarning.join(', ')}`}
                />
              )}
              {fm.mappingDiagnosis.sourceMissingForType.length > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`以下映射缺少源列名: ${fm.mappingDiagnosis.sourceMissingForType.join(', ')}`}
                />
              )}
              {fm.tempPreview.invalidCount > 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={`适温预览中有 ${fm.tempPreview.invalidCount} 行时间格式无法识别`}
                />
              )}

              {/* 适温预览表 */}
              <Table
                size="small"
                pagination={false}
                style={{ marginTop: 8 }}
                dataSource={fm.tempPreview.rows}
                rowKey="key"
                columns={[
                  { title: '行号', dataIndex: 'row_no', width: 70, align: 'center' },
                  { title: '卷取时间原值', dataIndex: 'raw_value', width: 220, ellipsis: true },
                  {
                    title: '适温状态',
                    dataIndex: 'status',
                    width: 110,
                    render: (value: TempPreviewRow['status']) => {
                      if (value === 'ready') return <Tag color="green">已适温</Tag>;
                      if (value === 'waiting') return <Tag color="orange">待温</Tag>;
                      if (value === 'invalid') return <Tag color="red">无法解析</Tag>;
                      return <Tag color="default">缺少映射</Tag>;
                    },
                  },
                  {
                    title: '待温天数',
                    dataIndex: 'wait_days',
                    width: 90,
                    align: 'right',
                    render: (value: number | undefined, row: TempPreviewRow) =>
                      row.status === 'ready' || row.status === 'waiting' ? value : '-',
                  },
                  {
                    title: '阈值',
                    dataIndex: 'threshold_days',
                    width: 70,
                    align: 'right',
                    render: (value: number | undefined, row: TempPreviewRow) =>
                      row.status === 'ready' || row.status === 'waiting' ? value : '-',
                  },
                  {
                    title: '还需天数',
                    dataIndex: 'remain_days',
                    width: 90,
                    align: 'right',
                    render: (value: number | undefined, row: TempPreviewRow) =>
                      row.status === 'ready' || row.status === 'waiting' ? value : '-',
                  },
                  { title: '说明', dataIndex: 'note', ellipsis: true },
                ]}
              />
            </div>
          )}
        </Card>

        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">配置源文件列名与系统字段的对应关系。带 * 号为必填字段。</Text>
          <br />
          <Text type="secondary">
            规则示例：`transform` 用 `bool_yn` 或 `是=true,否=false`；`calculate` 用 `/1000` 或
            `x*1.1`；`combine` 用 `CONCAT(合同号,'-',钢卷号)` 或 {'{contract_no}-{coil_id}'}；`date`
            可配置 `source_format`（如 `YYYYMMDD`）。
          </Text>
        </div>

        {/* 编辑区诊断告警 */}
        {fm.mappingDiagnosis.transformMissingRule.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="warning"
            showIcon
            message={`以下值转换字段缺少规则: ${fm.mappingDiagnosis.transformMissingRule.join(', ')}`}
          />
        )}
        {fm.mappingDiagnosis.transformInvalidRule.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="error"
            showIcon
            message={`以下值转换规则无法解析: ${fm.mappingDiagnosis.transformInvalidRule.join(', ')}`}
          />
        )}
        {fm.mappingDiagnosis.calculateInvalidRule.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="error"
            showIcon
            message={`以下计算规则无效: ${fm.mappingDiagnosis.calculateInvalidRule.join(', ')}`}
          />
        )}
        {fm.mappingDiagnosis.defaultMissingValue.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="error"
            showIcon
            message={`以下默认值映射缺少默认值: ${fm.mappingDiagnosis.defaultMissingValue.join(', ')}`}
          />
        )}
        {fm.mappingDiagnosis.combineRuleWarning.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="warning"
            showIcon
            message={`以下组合规则需关注: ${fm.mappingDiagnosis.combineRuleWarning.join(', ')}`}
          />
        )}
        {fm.mappingDiagnosis.dateFormatWarning.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="warning"
            showIcon
            message={`以下日期映射未配置格式，将使用自动识别: ${fm.mappingDiagnosis.dateFormatWarning.join(', ')}`}
          />
        )}
        {fm.mappingDiagnosis.sourceMissingForType.length > 0 && (
          <Alert
            style={{ marginBottom: 8 }}
            type="warning"
            showIcon
            message={`以下映射缺少源列名: ${fm.mappingDiagnosis.sourceMissingForType.join(', ')}`}
          />
        )}

        {/* 映射行表格 */}
        <Table
          size="small"
          pagination={false}
          dataSource={fm.mappingRows.map((r, i) => ({ ...r, _key: i }))}
          rowKey="_key"
          columns={[
            {
              title: '校验',
              width: 88,
              align: 'center' as const,
              render: (_: unknown, row: FieldMappingItem & { _key: number }) => {
                const issues = fm.mappingDiagnosis.rowIssues[row._key] ?? [];
                if (issues.length === 0) return <Tag color="success">通过</Tag>;
                const errorCount = issues.filter((item) => item.level === 'error').length;
                const warningCount = issues.filter((item) => item.level === 'warning').length;
                const hasError = errorCount > 0;
                const title = issues.map((item, idx) => `${idx + 1}. ${item.text}`).join('\n');
                return (
                  <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{title}</span>}>
                    <Tag color={hasError ? 'error' : 'warning'} style={{ margin: 0 }}>
                      {hasError ? `错误${errorCount}` : `警告${warningCount}`}
                    </Tag>
                  </Tooltip>
                );
              },
            },
            {
              title: '源列名',
              dataIndex: 'source_field',
              width: 200,
              render: (v: string, _: FieldMappingItem & { _key: number }) => (
                <AutoComplete
                  size="small"
                  value={v}
                  options={fm.sourceFieldOptions}
                  placeholder="Excel/CSV 中的列名"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={(value) => fm.updateMappingRow(_._key, 'source_field', value)}
                />
              ),
            },
            {
              title: '目标字段',
              dataIndex: 'target_field',
              width: 200,
              render: (v: string, _: FieldMappingItem & { _key: number }) => (
                <Select
                  size="small"
                  value={v || undefined}
                  placeholder="选择目标字段"
                  style={{ width: '100%' }}
                  onChange={(val) => fm.updateMappingRow(_._key, 'target_field', val)}
                  options={targetFields.map((f) => ({
                    value: f.field,
                    label: `${f.label}${f.required ? ' *' : ''} (${f.field})`,
                  }))}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              ),
            },
            {
              title: '映射类型',
              dataIndex: 'mapping_type',
              width: 130,
              render: (v: string, _: FieldMappingItem & { _key: number }) => (
                <Select
                  size="small"
                  value={v}
                  style={{ width: '100%' }}
                  onChange={(val) => fm.updateMappingRow(_._key, 'mapping_type', val)}
                  options={[
                    { value: 'direct', label: '直接映射' },
                    { value: 'transform', label: '值转换' },
                    { value: 'calculate', label: '计算映射' },
                    { value: 'combine', label: '组合映射' },
                    { value: 'date', label: '日期解析' },
                    { value: 'default', label: '默认值' },
                  ]}
                />
              ),
            },
            {
              title: '规则',
              dataIndex: 'transform_rule',
              width: 280,
              render: (v: string | undefined, row: FieldMappingItem & { _key: number }) => (
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    size="small"
                    value={v}
                    placeholder={
                      row.mapping_type === 'calculate'
                        ? '如: /1000 或 x*1.1'
                        : row.mapping_type === 'combine'
                          ? "如: CONCAT(A,'-',B) 或 {A}-{B}"
                          : row.mapping_type === 'transform'
                            ? '如: bool_yn 或 是=true,否=false'
                            : '-'
                    }
                    disabled={
                      !(
                        row.mapping_type === 'calculate' ||
                        row.mapping_type === 'combine' ||
                        row.mapping_type === 'transform'
                      )
                    }
                    onChange={(e) =>
                      fm.updateMappingRow(row._key, 'transform_rule', e.target.value)
                    }
                  />
                  {getRulePresetOptions(row.mapping_type).length > 0 && (
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: getRulePresetOptions(row.mapping_type).map((item) => ({
                          key: item.value,
                          label: item.label,
                        })),
                        onClick: ({ key }) =>
                          fm.updateMappingRow(row._key, 'transform_rule', String(key)),
                      }}
                    >
                      <Button size="small">预设</Button>
                    </Dropdown>
                  )}
                </Space.Compact>
              ),
            },
            {
              title: '日期格式',
              dataIndex: 'source_format',
              width: 170,
              render: (v: string | undefined, row: FieldMappingItem & { _key: number }) => (
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    size="small"
                    value={v}
                    placeholder={row.mapping_type === 'date' ? '如: YYYY-MM-DD HH:mm:ss' : '-'}
                    disabled={row.mapping_type !== 'date'}
                    onChange={(e) => fm.updateMappingRow(row._key, 'source_format', e.target.value)}
                  />
                  {row.mapping_type === 'date' && (
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: DATE_FORMAT_PRESET_OPTIONS.map((item) => ({
                          key: item.value,
                          label: item.label,
                        })),
                        onClick: ({ key }) =>
                          fm.updateMappingRow(row._key, 'source_format', String(key)),
                      }}
                    >
                      <Button size="small">预设</Button>
                    </Dropdown>
                  )}
                </Space.Compact>
              ),
            },
            {
              title: '默认值',
              dataIndex: 'default_value',
              width: 120,
              render: (v: string | undefined, _: FieldMappingItem & { _key: number }) => (
                <Input
                  size="small"
                  value={v}
                  placeholder="-"
                  onChange={(e) => fm.updateMappingRow(_._key, 'default_value', e.target.value)}
                />
              ),
            },
            {
              title: '',
              width: 60,
              render: (_v: unknown, _r: FieldMappingItem & { _key: number }) => (
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => fm.removeMappingRow(_r._key)}
                >
                  删除
                </Button>
              ),
            },
          ]}
        />
        <Space style={{ marginTop: 8 }} wrap>
          <Button type="dashed" onClick={fm.addMappingRow} icon={<PlusOutlined />}>
            添加映射行
          </Button>
          <Button onClick={fm.handleEnsureRequiredMappings} icon={<CheckSquareOutlined />}>
            补齐必填字段
          </Button>
        </Space>
      </Modal>

      <TestResultModal
        open={fm.testModalOpen}
        testResult={fm.testResult}
        testErrorSummary={fm.testErrorSummary}
        exportingTestResult={fm.exportingTestResult}
        onClose={() => fm.setTestModalOpen(false)}
        onExport={fm.handleExportTestResult}
      />

      <MappingDetailModal
        open={fm.detailOpen}
        detailData={fm.detailData}
        onClose={() => fm.setDetailOpen(false)}
      />
    </Card>
  );
}
