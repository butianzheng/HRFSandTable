import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  LockOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import type { ScheduleRow, GanttGroupBy } from './types';

export interface GanttViewProps {
  scheduleItems: ScheduleRow[];
  selectedItemIds: number[];
  ganttZoom: number;
  setGanttZoom: React.Dispatch<React.SetStateAction<number>>;
  // Drag handlers
  dragOverScheduleItemId: number | null;
  dragOverSchedulePlacement: 'above' | 'below';
  onDragStart: (itemId: number, e: React.DragEvent) => void;
  onDragOver: (itemId: number, e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
  onDrop: (itemId: number, e: React.DragEvent) => void;
  onClick: (itemId: number, e: React.MouseEvent) => void;
  // Grouping (backward-compatible, ignored in swimlane mode)
  ganttGroupBy?: GanttGroupBy;
  onGroupByChange?: (v: GanttGroupBy) => void;
  /** Show current-time red indicator line. Default: true */
  showCurrentTime?: boolean;
}

/** Parse "HH:MM" to total minutes from midnight */
function timeToMinutes(t?: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

/** 排产日08:00起始。夜班跨零点时间 (<08:00) 加24h偏移，保证连续渲染。 */
function adjustedTimeToMinutes(t?: string, shiftType?: string): number {
  const base = timeToMinutes(t);
  if (shiftType === 'night' && base < 480) {
    return base + 1440;
  }
  return base;
}

const LABEL_WIDTH = 160;
const SWIMLANE_BAR_HEIGHT = 28;
const SWIMLANE_PADDING_Y = 6;
const SWIMLANE_HEIGHT = SWIMLANE_PADDING_Y * 2 + SWIMLANE_BAR_HEIGHT; // 40px
const BAR_TEXT_MIN_WIDTH = 60;
const BAR_SEQ_ONLY_MIN_WIDTH = 30;

const GRADE_COLORS = [
  '#1677ff', '#52c41a', '#722ed1', '#fa8c16', '#13c2c2',
  '#eb2f96', '#2f54eb', '#a0d911', '#faad14', '#f5222d',
];

interface Swimlane {
  shiftDate: string;
  items: ScheduleRow[];
  totalWeight: number;
  itemCount: number;
  rollChangeCount: number;
  earliestStart: string;
  latestEnd: string;
}

function computeSwimlanes(items: ScheduleRow[]): Swimlane[] {
  const dateMap = new Map<string, ScheduleRow[]>();

  for (const item of items) {
    const date = item.shift_date || '未知日期';
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)!.push(item);
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([shiftDate, dateItems]) => {
      const sorted = [...dateItems].sort(
        (a, b) =>
          adjustedTimeToMinutes(a.planned_start, a.shift_type) -
          adjustedTimeToMinutes(b.planned_start, b.shift_type),
      );

      const starts = sorted.map((r) => r.planned_start).filter(Boolean) as string[];
      const ends = sorted.map((r) => r.planned_end).filter(Boolean) as string[];

      return {
        shiftDate,
        items: sorted,
        totalWeight: sorted.reduce((sum, r) => sum + (r.material?.weight ?? 0), 0),
        itemCount: sorted.length,
        rollChangeCount: sorted.filter((r) => r.is_roll_change).length,
        earliestStart: starts.length ? starts.sort()[0] : '',
        latestEnd: ends.length ? ends.sort().reverse()[0] : '',
      };
    });
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${weekdays[d.getDay()]} ${mm}/${dd}`;
  } catch {
    return dateStr;
  }
}

function steelGradeColor(grade?: string): string {
  if (!grade) return 'transparent';
  let hash = 0;
  for (let i = 0; i < grade.length; i++) hash = (hash * 31 + grade.charCodeAt(i)) | 0;
  return GRADE_COLORS[Math.abs(hash) % GRADE_COLORS.length];
}

export default memo(function GanttView({
  scheduleItems,
  selectedItemIds,
  ganttZoom,
  setGanttZoom,
  dragOverScheduleItemId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onClick,
  showCurrentTime = true,
}: GanttViewProps) {
  const selectedItemSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Horizontal drag placement (before/after) ───
  const [barDragPlacement, setBarDragPlacement] = useState<'before' | 'after'>('after');

  // ─── Current time state ───
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    if (!showCurrentTime) return;
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(timer);
  }, [showCurrentTime]);

  // ─── Time axis range (排产日固定 08:00 → 次日 08:00) ───
  const { startMin, endMin, hours } = useMemo(() => {
    if (scheduleItems.length === 0) return { startMin: 480, endMin: 1920, hours: [] as number[] };
    const START = 480;   // 08:00
    const END = 1920;    // 次日08:00 (32 * 60)
    const hrs: number[] = [];
    for (let h = Math.floor(START / 60); h <= Math.ceil(END / 60); h++) {
      hrs.push(h);
    }
    return { startMin: START, endMin: END, hours: hrs };
  }, [scheduleItems.length]);

  const totalMinutes = endMin - startMin || 1;
  const timelineWidth = totalMinutes * 2 * ganttZoom;

  const ganttTimeRange = useMemo(() => {
    if (scheduleItems.length === 0) return null;
    return { start: '08:00', end: '08:00(+1)' };
  }, [scheduleItems.length]);

  // ─── Compute swimlanes ───
  const swimlanes = useMemo(() => computeSwimlanes(scheduleItems), [scheduleItems]);

  // ─── Wrap drag-over for horizontal placement detection ───
  const handleBarDragOver = useCallback(
    (itemId: number, e: React.DragEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setBarDragPlacement(e.clientX < rect.left + rect.width / 2 ? 'before' : 'after');
      onDragOver(itemId, e);
    },
    [onDragOver],
  );

  // ─── Grid lines ───
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];

    // Hour lines (solid)
    for (const h of hours) {
      const x = ((h * 60 - startMin) / totalMinutes) * timelineWidth;
      lines.push(
        <div
          key={`h-${h}`}
          style={{
            position: 'absolute',
            left: x,
            top: 0,
            bottom: 0,
            width: 1,
            background: '#e0e0e0',
          }}
        />,
      );
    }

    // Half-hour lines (dashed)
    for (const h of hours.slice(0, -1)) {
      const halfMin = h * 60 + 30;
      if (halfMin <= startMin || halfMin >= endMin) continue;
      const x = ((halfMin - startMin) / totalMinutes) * timelineWidth;
      lines.push(
        <div
          key={`hh-${h}`}
          className="gantt-gridline-half-hour"
          style={{
            position: 'absolute',
            left: x,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: '1px dashed #e8e8e8',
          }}
        />,
      );
    }

    // Quarter-hour lines (dotted)
    for (const h of hours.slice(0, -1)) {
      for (const q of [15, 45]) {
        const min = h * 60 + q;
        if (min <= startMin || min >= endMin) continue;
        const x = ((min - startMin) / totalMinutes) * timelineWidth;
        lines.push(
          <div
            key={`q-${h}-${q}`}
            className="gantt-gridline-quarter-hour"
            style={{
              position: 'absolute',
              left: x,
              top: 0,
              bottom: 0,
              width: 0,
              borderLeft: '1px dotted #f0f0f0',
            }}
          />,
        );
      }
    }

    return lines;
  }, [hours, startMin, endMin, totalMinutes, timelineWidth]);

  // ─── Current time indicator ───
  // 排产日偏移：08:00前的当前时间属于前一排产日的夜班区域
  const adjustedNowMinutes = useMemo(
    () => (nowMinutes < 480 ? nowMinutes + 1440 : nowMinutes),
    [nowMinutes],
  );

  const renderCurrentTimeIndicator = useCallback(() => {
    if (!showCurrentTime) return null;
    if (adjustedNowMinutes < startMin || adjustedNowMinutes > endMin) return null;
    const x = ((adjustedNowMinutes - startMin) / totalMinutes) * timelineWidth;
    return (
      <div
        className="gantt-current-time-line"
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          bottom: 0,
          width: 2,
          background: '#ff4d4f',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: -3,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ff4d4f',
          }}
        />
      </div>
    );
  }, [showCurrentTime, adjustedNowMinutes, startMin, endMin, totalMinutes, timelineWidth]);

  // ─── Render a single bar ───
  const renderBar = useCallback(
    (row: ScheduleRow) => {
      const s = adjustedTimeToMinutes(row.planned_start, row.shift_type);
      const e = adjustedTimeToMinutes(row.planned_end, row.shift_type);
      const barLeft = ((s - startMin) / totalMinutes) * timelineWidth;
      const barWidth = Math.max(((e - s) / totalMinutes) * timelineWidth, 4);
      const isSelected = selectedItemSet.has(row.id);
      const isDragTarget = dragOverScheduleItemId === row.id;

      let barColor = '#1677ff';
      if (row.is_roll_change) barColor = '#d9d9d9';
      else if (row.is_locked) barColor = '#faad14';

      const gradeColor = steelGradeColor(row.material?.steel_grade);

      // Text truncation logic
      let barText = '';
      if (barWidth >= BAR_TEXT_MIN_WIDTH) {
        barText = `#${row.sequence} ${row.material?.coil_id ?? ''}`;
      } else if (barWidth >= BAR_SEQ_ONLY_MIN_WIDTH) {
        barText = `#${row.sequence}`;
      }

      // Drag indicator class
      let dragClass = '';
      if (isDragTarget) {
        dragClass =
          barDragPlacement === 'before'
            ? ' gantt-swimlane-bar-drag-over-before'
            : ' gantt-swimlane-bar-drag-over-after';
      }

      return (
        <Tooltip
          key={row.id}
          title={
            <div style={{ fontSize: 12 }}>
              <div>
                <b>{row.material?.coil_id}</b> - {row.material?.steel_grade}
              </div>
              <div>
                宽 {row.material?.width}mm / 厚 {row.material?.thickness}mm / 重{' '}
                {row.material?.weight?.toFixed(1)}t
              </div>
              <div>
                时间: {row.planned_start} - {row.planned_end}
              </div>
              <div>
                班次: {row.shift_date} 第{row.shift_no}班
              </div>
              {row.is_locked && <div style={{ color: '#faad14' }}>已锁定</div>}
              {row.is_roll_change && <div style={{ color: '#bfbfbf' }}>换辊</div>}
            </div>
          }
          placement="top"
          mouseEnterDelay={0.3}
        >
          <div
            className={`gantt-swimlane-bar${isSelected ? ' gantt-swimlane-bar-selected' : ''}${dragClass}`}
            draggable={!row.is_locked}
            onClick={(ev) => {
              ev.stopPropagation();
              onClick(row.id, ev);
            }}
            onDragStart={(ev) => onDragStart(row.id, ev)}
            onDragOver={(ev) => handleBarDragOver(row.id, ev)}
            onDragLeave={onDragLeave}
            onDragEnd={onDragEnd}
            onDrop={(ev) => onDrop(row.id, ev)}
            style={{
              position: 'absolute',
              left: barLeft,
              top: SWIMLANE_PADDING_Y,
              width: barWidth,
              height: SWIMLANE_BAR_HEIGHT,
              background: barColor,
              borderLeft: `3px solid ${gradeColor}`,
              borderRadius: 3,
              opacity: row.is_roll_change ? 0.5 : 0.85,
              cursor: row.is_locked ? 'pointer' : 'grab',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
            }}
            onMouseEnter={(ev) => {
              (ev.currentTarget as HTMLDivElement).style.opacity = '1';
            }}
            onMouseLeave={(ev) => {
              (ev.currentTarget as HTMLDivElement).style.opacity = row.is_roll_change
                ? '0.5'
                : '0.85';
            }}
          >
            {barText && (
              <span className="gantt-swimlane-bar-text" style={{ padding: '0 4px', fontSize: 11, color: '#fff', fontWeight: 500, lineHeight: `${SWIMLANE_BAR_HEIGHT}px`, flex: 1 }}>
                {barText}
              </span>
            )}
            {row.is_locked && barWidth >= BAR_SEQ_ONLY_MIN_WIDTH && (
              <LockOutlined
                style={{
                  fontSize: 10,
                  color: '#fff',
                  marginRight: 3,
                  flexShrink: 0,
                  opacity: 0.85,
                }}
              />
            )}
          </div>
        </Tooltip>
      );
    },
    [
      startMin,
      totalMinutes,
      timelineWidth,
      selectedItemSet,
      dragOverScheduleItemId,
      barDragPlacement,
      handleBarDragOver,
      onDragStart,
      onDragLeave,
      onDragEnd,
      onDrop,
      onClick,
    ],
  );

  // ─── Render a swimlane ───
  const renderSwimlane = useCallback(
    (swimlane: Swimlane, index: number) => (
      <div
        key={swimlane.shiftDate}
        className="gantt-swimlane"
        style={{
          display: 'flex',
          height: SWIMLANE_HEIGHT,
          borderBottom: '2px solid #e8e8e8',
          background: index % 2 === 0 ? '#fff' : '#fafafa',
          transition: 'background 0.15s',
        }}
      >
        {/* Label area */}
        <div
          style={{
            width: LABEL_WIDTH,
            minWidth: LABEL_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 8px',
            fontSize: 12,
            borderRight: '1px solid #f0f0f0',
            background: index % 2 === 0 ? '#fafafa' : '#f5f5f5',
          }}
        >
          <div style={{ fontWeight: 600, color: '#262626' }}>
            {formatDateLabel(swimlane.shiftDate)}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
            {swimlane.itemCount}块 | {swimlane.totalWeight.toFixed(1)}t
            {swimlane.rollChangeCount > 0 && ` | 换辊${swimlane.rollChangeCount}`}
          </div>
        </div>

        {/* Timeline area */}
        <div style={{ position: 'relative', flex: 1, minWidth: timelineWidth }}>
          {gridLines}
          {swimlane.items.map((row) => renderBar(row))}
          {renderCurrentTimeIndicator()}
        </div>
      </div>
    ),
    [timelineWidth, gridLines, renderBar, renderCurrentTimeIndicator],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          borderRadius: '6px 6px 0 0',
          flexShrink: 0,
        }}
      >
        {ganttTimeRange && (
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            {ganttTimeRange.start} ~ {ganttTimeRange.end}
          </span>
        )}

        <span style={{ flex: 1 }} />
        <Space size={4}>
          <Button
            size="small"
            icon={<ZoomInOutlined />}
            onClick={() => setGanttZoom((z) => Math.min(3, Number((z + 0.2).toFixed(1))))}
          />
          <span style={{ fontSize: 12, color: '#595959', minWidth: 44, textAlign: 'center' }}>
            x{ganttZoom}
          </span>
          <Button
            size="small"
            icon={<ZoomOutOutlined />}
            onClick={() => setGanttZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(1))))}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={() => setGanttZoom(1)}>
            重置
          </Button>
        </Space>
      </div>

      {/* Gantt body */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#fafafa',
          borderRadius: '0 0 6px 6px',
          border: '1px solid #f0f0f0',
          borderTop: 0,
        }}
      >
        {/* Time axis header */}
        <div
          style={{
            display: 'flex',
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: '#fff',
            borderBottom: '1px solid #e8e8e8',
          }}
        >
          <div
            style={{
              width: LABEL_WIDTH,
              minWidth: LABEL_WIDTH,
              padding: '6px 8px',
              fontSize: 12,
              fontWeight: 500,
              color: '#595959',
              borderRight: '1px solid #f0f0f0',
              background: '#fafafa',
            }}
          >
            排产日期
          </div>
          <div style={{ position: 'relative', width: timelineWidth, height: 28 }}>
            {hours.map((h) => {
              const left = ((h * 60 - startMin) / totalMinutes) * timelineWidth;
              return (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    left,
                    top: 0,
                    height: '100%',
                    borderLeft: '1px solid #e8e8e8',
                    paddingLeft: 4,
                    fontSize: 11,
                    color: '#8c8c8c',
                    lineHeight: '28px',
                    userSelect: 'none',
                  }}
                >
                  {String(h % 24).padStart(2, '0')}:00
                </div>
              );
            })}
            {/* Half-hour tick marks in header */}
            {hours.slice(0, -1).map((h) => {
              const halfMin = h * 60 + 30;
              if (halfMin <= startMin || halfMin >= endMin) return null;
              const left = ((halfMin - startMin) / totalMinutes) * timelineWidth;
              return (
                <div
                  key={`hh-${h}`}
                  style={{
                    position: 'absolute',
                    left,
                    bottom: 0,
                    height: 8,
                    borderLeft: '1px solid #d9d9d9',
                  }}
                />
              );
            })}
            {/* Current time indicator in header */}
            {showCurrentTime && adjustedNowMinutes >= startMin && adjustedNowMinutes <= endMin && (
              <div
                style={{
                  position: 'absolute',
                  left: ((adjustedNowMinutes - startMin) / totalMinutes) * timelineWidth,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: '#ff4d4f',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* Swimlane rows */}
        {swimlanes.map((swimlane, index) => renderSwimlane(swimlane, index))}

        {scheduleItems.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#bfbfbf',
              fontSize: 14,
            }}
          >
            暂无排程数据
          </div>
        )}
      </div>
    </div>
  );
});
