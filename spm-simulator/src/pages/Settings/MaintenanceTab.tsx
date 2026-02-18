import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  message,
  Space,
  Table,
  Tag,
  Popconfirm,
  Modal,
  DatePicker,
  Form,
  Input,
  Switch,
  Card,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { configApi } from '../../services/configApi';
import type { MaintenancePlan } from '../../types/config';
import { getErrorMessage } from '../../utils/error';
import type { MaintenanceFormValues } from './types';
import { maintenanceTypeLabelMap } from './types';

export default function MaintenanceTab({ refreshTrigger }: { refreshTrigger: number }) {
  const [, setMaintenanceLoading] = useState(false);
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>([]);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [maintenanceForm] = Form.useForm<MaintenanceFormValues>();

  const fetchMaintenancePlans = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const data = await configApi.getMaintenancePlans();
      setMaintenancePlans(data);
    } catch (error: unknown) {
      message.error(`加载检修计划失败: ${getErrorMessage(error)}`);
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaintenancePlans();
  }, [fetchMaintenancePlans, refreshTrigger]);

  const handleOpenCreateMaintenance = () => {
    setEditingPlan(null);
    maintenanceForm.resetFields();
    maintenanceForm.setFieldsValue({
      maintenance_type: 'planned',
      is_active: true,
    });
    setMaintenanceModalOpen(true);
  };

  const handleOpenEditMaintenance = (plan: MaintenancePlan) => {
    setEditingPlan(plan);
    maintenanceForm.setFieldsValue({
      title: plan.title,
      time_range: [dayjs(plan.start_time), dayjs(plan.end_time)],
      maintenance_type: plan.maintenance_type,
      recurrence: plan.recurrence,
      is_active: plan.is_active ?? true,
      description: plan.description,
    });
    setMaintenanceModalOpen(true);
  };

  const handleSaveMaintenance = async () => {
    try {
      const values = await maintenanceForm.validateFields();
      const payload = {
        title: values.title.trim(),
        start_time: values.time_range[0].toISOString(),
        end_time: values.time_range[1].toISOString(),
        maintenance_type: values.maintenance_type,
        recurrence: values.recurrence?.trim() || undefined,
        is_active: values.is_active ?? true,
        description: values.description?.trim() || undefined,
      };

      if (editingPlan) {
        await configApi.updateMaintenancePlan(editingPlan.id, payload);
        message.success('检修计划已更新');
      } else {
        await configApi.createMaintenancePlan(payload);
        message.success('检修计划已创建');
      }

      setMaintenanceModalOpen(false);
      setEditingPlan(null);
      maintenanceForm.resetFields();
      fetchMaintenancePlans();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      message.error(`保存检修计划失败: ${getErrorMessage(error)}`);
    }
  };

  const handleToggleMaintenanceActive = async (plan: MaintenancePlan) => {
    try {
      await configApi.updateMaintenancePlan(plan.id, {
        is_active: !(plan.is_active ?? true),
      });
      message.success('状态更新成功');
      fetchMaintenancePlans();
    } catch (error: unknown) {
      message.error(`更新状态失败: ${getErrorMessage(error)}`);
    }
  };

  const handleDeleteMaintenance = async (id: number) => {
    try {
      await configApi.deleteMaintenancePlan(id);
      message.success('删除成功');
      fetchMaintenancePlans();
    } catch (error: unknown) {
      message.error(`删除失败: ${getErrorMessage(error)}`);
    }
  };

  const maintenanceColumns: TableColumnsType<MaintenancePlan> = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '时间范围',
      key: 'time',
      width: 280,
      render: (_: unknown, row: MaintenancePlan) =>
        `${dayjs(row.start_time).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(row.end_time).format('YYYY-MM-DD HH:mm')}`,
    },
    {
      title: '类型',
      dataIndex: 'maintenance_type',
      width: 110,
      render: (value: string) => maintenanceTypeLabelMap[value] ?? value,
    },
    {
      title: '周期',
      dataIndex: 'recurrence',
      width: 120,
      render: (value: string | undefined) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (value: boolean | undefined) =>
        value !== false ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
      render: (value: string | undefined) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 190,
      render: (_: unknown, row: MaintenancePlan) => (
        <Space size={8}>
          <Button type="link" size="small" onClick={() => handleOpenEditMaintenance(row)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleToggleMaintenanceActive(row)}>
            {row.is_active !== false ? '停用' : '启用'}
          </Button>
          <Popconfirm
            title="确认删除该检修计划？"
            onConfirm={() => handleDeleteMaintenance(row.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        size="small"
        extra={
          <Space>
            <Button type="primary" onClick={handleOpenCreateMaintenance}>
              新建检修计划
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchMaintenancePlans}>
              刷新列表
            </Button>
          </Space>
        }
      >
        <Table
          size="small"
          rowKey="id"
          dataSource={maintenancePlans}
          columns={maintenanceColumns}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        title={editingPlan ? '编辑检修计划' : '新建检修计划'}
        open={maintenanceModalOpen}
        onOk={handleSaveMaintenance}
        onCancel={() => {
          setMaintenanceModalOpen(false);
          setEditingPlan(null);
          maintenanceForm.resetFields();
        }}
        destroyOnClose
        width={560}
      >
        <Form
          form={maintenanceForm}
          layout="vertical"
          initialValues={{ maintenance_type: 'planned', is_active: true }}
        >
          <Form.Item
            name="title"
            label="计划标题"
            rules={[{ required: true, message: '请输入计划标题' }]}
          >
            <Input placeholder="如：2号机组月度检修" />
          </Form.Item>
          <Form.Item
            name="time_range"
            label="检修时间"
            rules={[{ required: true, message: '请选择检修时间范围' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="maintenance_type"
            label="检修类型"
            rules={[{ required: true, message: '请选择检修类型' }]}
          >
            <Input placeholder="planned / routine / emergency" />
          </Form.Item>
          <Form.Item name="recurrence" label="重复规则">
            <Input placeholder="如：每周一 02:00（可选）" />
          </Form.Item>
          <Form.Item name="is_active" label="启用状态" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
