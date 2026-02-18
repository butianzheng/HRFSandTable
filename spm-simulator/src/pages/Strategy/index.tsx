import { Form, Row, Col } from 'antd';

import { useStrategyData } from './useStrategyData';
import TemplateListPanel from './TemplateListPanel';
import StrategyDetailView from './StrategyDetailView';
import StrategyEditModal from './StrategyEditModal';

export default function Strategy() {
  const [form] = Form.useForm();
  const d = useStrategyData({ form });

  return (
    <Row gutter={16}>
      <Col span={6}>
        <TemplateListPanel
          templates={d.templates}
          loading={d.loading}
          selectedId={d.selectedId}
          onSelect={d.setSelectedId}
          onImport={d.handleImportTemplate}
          onExport={d.handleExportTemplate}
          onExportDisabled={!d.selected}
          onCreate={d.handleCreate}
          onEdit={d.handleEdit}
          onDelete={d.handleDelete}
          onDuplicate={d.handleDuplicate}
          onSetDefault={d.handleSetDefault}
        />
      </Col>

      <Col span={18}>
        <StrategyDetailView
          selected={d.selected}
          sortWeights={d.selectedSortWeights}
          hardConstraints={d.selectedHardConstraints}
          softConstraints={d.selectedSoftConstraints}
          evalWeights={d.selectedEvalWeights}
          temperRules={d.selectedTemperRules}
          onEdit={d.handleEdit}
        />
      </Col>

      <StrategyEditModal
        open={d.modalOpen}
        editingId={d.editingId}
        form={form}
        onOk={d.handleSave}
        onCancel={d.closeModal}
        sortWeights={d.sortWeights}
        setSortWeights={d.setSortWeights}
        hardConstraints={d.hardConstraints}
        setHardConstraints={d.setHardConstraints}
        softConstraints={d.softConstraints}
        setSoftConstraints={d.setSoftConstraints}
        evalWeights={d.evalWeights}
        setEvalWeights={d.setEvalWeights}
        temperRules={d.temperRules}
        setTemperRules={d.setTemperRules}
      />
    </Row>
  );
}
