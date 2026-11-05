import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import { getOrders, ORDER_DATA_CHANGED_EVENT } from '../../services/mockDataService';
import { getKlookOrders, getHelloOrders, type KlookOrder } from '../order-management/klookOrderService';
import type { Order } from '../../shared/types';
import { buildProductionDailyRows, getProductionTimestamp } from './productionActivity';
import { PRODUCTION_EMPLOYEE_ACCOUNTS } from './productionEmployeeAccounts';
import SmallbookStatisticsPanel from './SmallbookStatisticsPanel';
import './ChineseTranslationOrders.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTab = 'translation-production' | 'smallbook-data' | 'shipment-data';

interface ShipmentRow {
  label: string;
  count: number;
}

interface ShipmentCustomerRow {
  label: ShipmentCustomer;
  totalCount: number;
  smallbookCount: number;
  notaryCount: number;
  swornCount: number;
  hongKongNotaryCount: number;
}

interface TranslationProductionRow {
  account: string;
  translationCount: number;
  productionCount: number;
}

interface ShipmentPieChartItem {
  label: string;
  count: number;
}

interface ShipmentPieChartProps {
  items: ShipmentPieChartItem[];
  variant?: 'donut' | 'pie';
  title?: string;
  onItemClick?: (label: string) => void;
  onBack?: () => void;
}

// 发货订单统计映射
// ---------------------------------------------------------------------------

const SHIPMENT_CUSTOMERS = ['携程', 'klook', '哈啰', '自营'] as const;
const SHIPMENT_LINES = ['小白本', '宣誓翻译件', '国内公证', '香港公证件', '换国内驾照'] as const;
const REPORT_SAMPLE_SHIPMENTS = [
  { customer: '携程', productName: '驾照翻译国际认证件（小白本）', productCategory: 'translation' },
  { customer: '携程', productName: '携程公证单号', productCategory: 'notary' },
  { customer: '携程', productName: '携程宣誓翻译件', productCategory: 'translation' },
  { customer: '携程', productName: '携程香港当地语言公证件', productCategory: 'local_language_notary' },
  { customer: 'klook', productName: 'klook驾照翻译国际认证件（小白本）', productCategory: 'translation' },
  { customer: 'klook', productName: '西班牙语言宣誓翻译（电子版）', productCategory: 'translation' },
  { customer: 'klook', productName: 'klook公证单号', productCategory: 'notary' },
  { customer: 'klook', productName: 'klook香港当地语言公证件', productCategory: 'local_language_notary' },
  { customer: '哈啰', productName: '哈啰驾照翻译国际认证件（小白本）', productCategory: 'translation' },
  { customer: '哈啰', productName: '哈啰宣誓翻译件', productCategory: 'translation' },
  { customer: '哈啰', productName: '哈啰公证单号', productCategory: 'notary' },
  { customer: '哈啰', productName: '香港当地语言公证件', productCategory: 'local_language_notary' },
  { customer: '自营', productName: '自营驾照翻译国际认证件（小白本）', productCategory: 'translation' },
  { customer: '自营', productName: '自营宣誓翻译件', productCategory: 'translation' },
  { customer: '自营', productName: '公证单号', productCategory: 'notary' },
  { customer: '自营', productName: '自营香港当地语言公证件', productCategory: 'local_language_notary' },
  { customer: '自营', productName: '换国内驾照翻译件', productCategory: 'domestic_license' },
] as const;

type ShipmentCustomer = typeof SHIPMENT_CUSTOMERS[number];
type ShipmentLine = typeof SHIPMENT_LINES[number];

const getDatePart = (value?: string) => {
  if (!value) return '';
  const normalized = getProductionTimestamp(value);
  return normalized ? normalized.slice(0, 10) : value.replace(/\//g, '-').slice(0, 10);
};

const getTodayDate = () => getDatePart(new Date().toISOString());

const getLogDate = (logs: ReadonlyArray<{ action: string; time: string }>, action: string) =>
  getDatePart(logs.find((log) => log.action.includes(action))?.time);

const getOrderShipmentDate = (order: Order) =>
  getDatePart(order.shippedAt) || getLogDate(order.logs, '已发货');

const getApiShipmentDate = (order: KlookOrder) =>
  order.status === 'shipped' || order.orderRecordLabel?.includes('已发货') || order.logs.some((log) => log.action.includes('已发货'))
    ? getDatePart(order.orderRecordAt) || getLogDate(order.logs, '已发货')
    : '';

const getShipmentCustomer = (order: Order): ShipmentCustomer =>
  order.channel === 'ctrip' ? '携程' : '自营';

const getShipmentLine = (productName: string, productCategory?: string): ShipmentLine | null => {
  if (productCategory === 'domestic_license' || productName.includes('换国内驾照')) return '换国内驾照';
  if (productCategory === 'local_language_notary' || productName.includes('香港') && productName.includes('公证')) return '香港公证件';
  if (productCategory === 'notary' || productName.includes('公证')) return '国内公证';
  if (productName.includes('小白本')) return '小白本';
  if (productName.includes('宣誓')) return '宣誓翻译件';
  return null;
};

const SHIPMENT_CHART_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'];
const formatReportCount = (count: number) => (count === 0 ? '-' : count);

const filterShipmentRecordsByDate = <T extends { date: string }>(records: T[], startDate: string, endDate: string) =>
  records.filter(({ date }) => Boolean(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate));

const getChartPoint = (centerX: number, centerY: number, radius: number, angle: number) => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: centerX + Math.cos(radians) * radius,
    y: centerY + Math.sin(radians) * radius,
  };
};

const buildPieSlicePath = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
  const startPoint = getChartPoint(centerX, centerY, radius, startAngle);
  const endPoint = getChartPoint(centerX, centerY, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${centerX} ${centerY} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y} Z`;
};

const ShipmentPieChart: React.FC<ShipmentPieChartProps> = ({
  items, variant = 'donut', title = '发货数量占比', onItemClick, onBack,
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const centerShadowId = useId();
  const chartCenterX = 190;
  const chartCenterY = 130;
  const pieRadius = 90;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const chartItems = items.filter((item) => item.count > 0);
  let offset = 0;
  const segments = chartItems.map((item, index) => {
    const percentage = total > 0 ? (item.count / total) * 100 : 0;
    const start = offset;
    offset += percentage;
    const gapPercentage = chartItems.length > 1 ? Math.min(1.2, percentage * 0.18) : 0;
    const visiblePercentage = Math.max(percentage - gapPercentage, 0);
    const startAngle = start * 3.6 - 90;
    const endAngle = (start + percentage) * 3.6 - 90;
    const middleAngle = (startAngle + endAngle) / 2;
    const angleRadians = (middleAngle * Math.PI) / 180;
    const labelX = chartCenterX + Math.cos(angleRadians) * 116;
    const labelY = chartCenterY + Math.sin(angleRadians) * 116;
    const lineX = chartCenterX + Math.cos(angleRadians) * 88;
    const lineY = chartCenterY + Math.sin(angleRadians) * 88;
    const valueX = chartCenterX + Math.cos(angleRadians) * 55;
    const valueY = chartCenterY + Math.sin(angleRadians) * 55;
    const activeOffsetX = Math.cos(angleRadians) * 6;
    const activeOffsetY = Math.sin(angleRadians) * 6;
    const piePath = buildPieSlicePath(chartCenterX, chartCenterY, pieRadius, startAngle, endAngle);
    return {
      item,
      index,
      percentage,
      start,
      gapPercentage,
      visiblePercentage,
      piePath,
      labelX,
      labelY,
      lineX,
      lineY,
      valueX,
      valueY,
      activeOffsetX,
      activeOffsetY,
    };
  });
  const activeLabel = hoveredLabel || selectedLabel;
  const activeItem = activeLabel ? chartItems.find((item) => item.label === activeLabel) : null;
  const activeIndex = activeItem ? chartItems.indexOf(activeItem) : -1;
  const activePercentage = activeItem && total > 0 ? (activeItem.count / total) * 100 : 0;

  const updateTooltipPosition = (event: React.MouseEvent<SVGElement>) => {
    const bounds = visualRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const cursorX = event.clientX - bounds.left;
    const cursorY = event.clientY - bounds.top;
    const tooltipWidth = 170;
    const proposedX = cursorX + tooltipWidth + 28 < bounds.width
      ? cursorX + 16
      : cursorX - tooltipWidth - 16;
    setTooltipPosition({
      x: Math.max(8, Math.min(proposedX, bounds.width - tooltipWidth - 8)),
      y: Math.max(8, Math.min(cursorY - 24, bounds.height - 62)),
    });
  };

  const handleSegmentEnter = (event: React.MouseEvent<SVGElement>, label: string) => {
    setHoveredLabel(label);
    updateTooltipPosition(event);
  };

  const handleSegmentLeave = () => {
    setHoveredLabel(null);
    setTooltipPosition(null);
  };

  const selectItem = (label: string) => {
    if (onItemClick) onItemClick(label);
    else setSelectedLabel((current) => current === label ? null : label);
  };

  const handleSegmentClick = (event: React.MouseEvent<SVGElement>, label: string) => {
    event.stopPropagation();
    selectItem(label);
  };

  const handleSegmentKeyDown = (event: React.KeyboardEvent<SVGElement>, label: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectItem(label);
    }
  };

  return (
    <div className={`report-shipment-chart report-shipment-chart--${variant}`} aria-label={title}>
      <div className="report-shipment-chart__heading">
        <span className="report-shipment-chart__title">
          <span className="report-shipment-chart__title-mark" aria-hidden="true" />
          {title}
        </span>
        {onBack && <button type="button" className="report-shipment-chart__back" onClick={onBack}>← 返回</button>}
      </div>
      {onItemClick && <p className="report-shipment-chart__hint">点击客户查看各产线发货数量</p>}
      <div className="report-shipment-chart__body">
        <div className="report-shipment-chart__visual" ref={visualRef}>
          <svg
            className="report-shipment-chart__svg"
            viewBox="0 0 360 260"
            role="group"
            aria-label={`发货总数 ${total}`}
            onClick={() => setSelectedLabel(null)}
          >
            <defs>
              <filter id={centerShadowId} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.12" />
              </filter>
            </defs>
            {variant === 'donut' && (
              <circle className="report-shipment-chart__track" cx={chartCenterX} cy={chartCenterY} r="80" pathLength="100" transform={`rotate(-90 ${chartCenterX} ${chartCenterY})`} />
            )}
            {variant === 'donut' && segments.map(({ item, index, start, gapPercentage, visiblePercentage }) => {
              const isActive = activeLabel === item.label;
              const isMuted = Boolean(activeLabel) && !isActive;
              return (
                <circle
                  key={item.label}
                  className={`report-shipment-chart__segment ${isActive ? 'report-shipment-chart__segment--active' : ''} ${isMuted ? 'report-shipment-chart__segment--muted' : ''}`}
                  cx={chartCenterX}
                  cy={chartCenterY}
                  r="80"
                  pathLength="100"
                  stroke={SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length]}
                  strokeDasharray={`${visiblePercentage} ${100 - visiblePercentage}`}
                  strokeDashoffset={-(start + gapPercentage / 2)}
                  transform={`rotate(-90 ${chartCenterX} ${chartCenterY})`}
                  style={{ animationDelay: `${index * 80}ms` }}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(event) => handleSegmentKeyDown(event, item.label)}
                  aria-label={`${item.label}，${item.count} 单`}
                  onMouseEnter={(event) => handleSegmentEnter(event, item.label)}
                  onMouseMove={updateTooltipPosition}
                  onMouseLeave={handleSegmentLeave}
                  onClick={(event) => handleSegmentClick(event, item.label)}
                  onFocus={() => setHoveredLabel(item.label)}
                  onBlur={handleSegmentLeave}
                />
              );
            })}
            {variant === 'pie' && segments.map(({ item, index, piePath, activeOffsetX, activeOffsetY }) => {
              const isActive = activeLabel === item.label;
              const isMuted = Boolean(activeLabel) && !isActive;
              return (
                <path
                  key={item.label}
                  d={piePath}
                  fill={SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length]}
                  className={`report-shipment-chart__pie-segment ${isActive ? 'report-shipment-chart__pie-segment--active' : ''} ${isMuted ? 'report-shipment-chart__pie-segment--muted' : ''}`}
                  style={{
                    animationDelay: `${index * 80}ms`,
                    '--pie-offset-x': `${activeOffsetX}px`,
                    '--pie-offset-y': `${activeOffsetY}px`,
                  } as React.CSSProperties}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(event) => handleSegmentKeyDown(event, item.label)}
                  aria-label={`${item.label}，${item.count} 单`}
                  onMouseEnter={(event) => handleSegmentEnter(event, item.label)}
                  onMouseMove={updateTooltipPosition}
                  onMouseLeave={handleSegmentLeave}
                  onClick={(event) => handleSegmentClick(event, item.label)}
                  onFocus={() => setHoveredLabel(item.label)}
                  onBlur={handleSegmentLeave}
                />
              );
            })}
            {segments.map(({ item, percentage, labelX, labelY, lineX, lineY, index }) => {
              const textAnchor = labelX < chartCenterX ? 'end' : 'start';
              const elbowEndX = labelX + (textAnchor === 'start' ? 12 : 0);
              const textX = elbowEndX + (textAnchor === 'start' ? 5 : -5);
              return (
                <g key={`${item.label}-label`} className="report-shipment-chart__label-group">
                  <polyline points={`${lineX},${lineY} ${labelX},${labelY} ${elbowEndX},${labelY}`} stroke={SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length]} />
                  <circle cx={lineX} cy={lineY} r="2.5" fill={SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length]} />
                  <text x={textX} y={variant === 'pie' ? labelY + 4 : labelY - 2} textAnchor={textAnchor} className="report-shipment-chart__label-name">{item.label}</text>
                  {variant === 'donut' && (
                    <text x={textX} y={labelY + 13} textAnchor={textAnchor} className="report-shipment-chart__label-percent">{percentage.toFixed(1)}%</text>
                  )}
                </g>
              );
            })}
            {variant === 'pie' && segments.map(({ item, percentage, valueX, valueY }) => (
              <text
                key={`${item.label}-value`}
                x={valueX}
                y={valueY + 4}
                textAnchor="middle"
                className="report-shipment-chart__pie-value"
              >
                {percentage.toFixed(1)}%
              </text>
            ))}
            {variant === 'donut' && (
              <>
                <circle className="report-shipment-chart__center" cx={chartCenterX} cy={chartCenterY} r="57" filter={`url(#${centerShadowId})`} />
                <text x={chartCenterX} y="124" textAnchor="middle" className="report-shipment-chart__total-value">{total > 0 ? total : '-'}</text>
                <text x={chartCenterX} y="145" textAnchor="middle" className="report-shipment-chart__total-label">发货总量</text>
              </>
            )}
          </svg>
          {activeItem && (
            <div
              className="report-shipment-chart__tooltip"
              style={tooltipPosition ? { left: tooltipPosition.x, right: 'auto', top: tooltipPosition.y } : undefined}
            >
              <span className="report-shipment-chart__tooltip-dot" style={{ backgroundColor: SHIPMENT_CHART_COLORS[activeIndex % SHIPMENT_CHART_COLORS.length] }} />
              <span>
                <strong>{activeItem.label}</strong>
                <small>{activeItem.count} 单，占比 {activePercentage.toFixed(1)}%</small>
              </span>
            </div>
          )}
        </div>
        <div className="report-shipment-chart__legend">
          {chartItems.map((item, index) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <button
                type="button"
                className={`report-shipment-chart__legend-item ${activeLabel === item.label ? 'report-shipment-chart__legend-item--active' : ''}`}
                key={item.label}
                style={{
                  '--legend-color': SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length],
                } as React.CSSProperties}
                aria-pressed={selectedLabel === item.label}
                aria-label={`${item.label}，${item.count} 单，占比 ${percentage.toFixed(1)}%`}
                onMouseEnter={() => {
                  setHoveredLabel(item.label);
                  setTooltipPosition(null);
                }}
                onMouseLeave={handleSegmentLeave}
                onFocus={() => setHoveredLabel(item.label)}
                onBlur={handleSegmentLeave}
                onClick={() => selectItem(item.label)}
              >
                <span
                  className="report-shipment-chart__legend-dot"
                />
                <span className="report-shipment-chart__legend-label">{item.label}</span>
                {variant === 'donut' && <span className="report-shipment-chart__detail-value">{item.count} 单 · {percentage.toFixed(1)}%</span>}
                <strong>{formatReportCount(item.count)}</strong>
                <span className="report-shipment-chart__legend-percent">{percentage.toFixed(1)}%</span>
              </button>
            );
          })}
          {chartItems.length === 0 && <div className="report-shipment-chart__empty">暂无发货数据</div>}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ReportListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('translation-production');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerStartDateInput, setCustomerStartDateInput] = useState(getTodayDate);
  const [customerEndDateInput, setCustomerEndDateInput] = useState(getTodayDate);
  const [customerStartDate, setCustomerStartDate] = useState(getTodayDate);
  const [customerEndDate, setCustomerEndDate] = useState(getTodayDate);
  const [lineStartDateInput, setLineStartDateInput] = useState(getTodayDate);
  const [lineEndDateInput, setLineEndDateInput] = useState(getTodayDate);
  const [lineStartDate, setLineStartDate] = useState(getTodayDate);
  const [lineEndDate, setLineEndDate] = useState(getTodayDate);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [detailCustomer, setDetailCustomer] = useState<ShipmentCustomer | null>(null);

  useEffect(() => {
    const refresh = () => setOrdersVersion((version) => version + 1);
    window.addEventListener(ORDER_DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ORDER_DATA_CHANGED_EVENT, refresh);
  }, []);

  // All orders from the system
  const allOrders = useMemo(() => getOrders(), [ordersVersion]);

  // ---- Tab 1: 翻译及制作数量 ----
  const dailyProductionRows = useMemo(() => buildProductionDailyRows(allOrders), [allOrders]);
  const translationProductionRows = useMemo((): TranslationProductionRow[] => {
    const rowMap = new Map<string, TranslationProductionRow>();
    PRODUCTION_EMPLOYEE_ACCOUNTS.forEach((account) => {
      rowMap.set(account, { account, translationCount: 0, productionCount: 0 });
    });

    dailyProductionRows.forEach((row) => {
      if (startDate && row.actionDate < startDate) return;
      if (endDate && row.actionDate > endDate) return;
      const current = rowMap.get(row.account) || {
        account: row.account,
        translationCount: 0,
        productionCount: 0,
      };
      current.translationCount += row.translationCount;
      current.productionCount += row.productionCount;
      rowMap.set(row.account, current);
    });

    return Array.from(rowMap.values());
  }, [dailyProductionRows, endDate, startDate]);

  const shipmentRecords = useMemo(() => {
    const records = [
      ...allOrders.map((order) => ({
        customer: getShipmentCustomer(order),
        productName: order.productName,
        productCategory: order.productCategory,
        date: getOrderShipmentDate(order),
      })),
      ...getKlookOrders().map((order) => ({
        customer: 'klook' as const,
        productName: order.productName,
        date: getApiShipmentDate(order),
      })),
      ...getHelloOrders().map((order) => ({
        customer: '哈啰' as const,
        productName: order.productName,
        date: getApiShipmentDate(order),
      })),
      ...REPORT_SAMPLE_SHIPMENTS.map((shipment) => ({
        ...shipment,
        date: getDatePart(new Date().toISOString()),
      })),
    ];
    return records;
  }, [allOrders]);

  const customerFilteredShipments = useMemo(
    () => filterShipmentRecordsByDate(shipmentRecords, customerStartDate, customerEndDate),
    [customerEndDate, customerStartDate, shipmentRecords],
  );

  const lineFilteredShipments = useMemo(
    () => filterShipmentRecordsByDate(shipmentRecords, lineStartDate, lineEndDate),
    [lineEndDate, lineStartDate, shipmentRecords],
  );

  const shipmentCustomerRows = useMemo((): ShipmentCustomerRow[] => {
    const rows = new Map<ShipmentCustomer, ShipmentCustomerRow>(
      SHIPMENT_CUSTOMERS.map((label) => [label, {
        label,
        totalCount: 0,
        smallbookCount: 0,
        notaryCount: 0,
        swornCount: 0,
        hongKongNotaryCount: 0,
      }]),
    );
    const addShipment = (customer: ShipmentCustomer, productName: string, productCategory?: string) => {
      const row = rows.get(customer);
      if (!row) return;
      row.totalCount += 1;
      const line = getShipmentLine(productName, productCategory);
      if (line === '小白本') row.smallbookCount += 1;
      if (line === '国内公证') row.notaryCount += 1;
      if (line === '宣誓翻译件') row.swornCount += 1;
      if (line === '香港公证件') row.hongKongNotaryCount += 1;
    };

    customerFilteredShipments.forEach((shipment) => {
      addShipment(shipment.customer, shipment.productName, 'productCategory' in shipment ? shipment.productCategory : undefined);
    });

    return Array.from(rows.values());
  }, [customerFilteredShipments]);

  const shipmentLineRows = useMemo((): ShipmentRow[] => {
    const rows = new Map<ShipmentLine, number>(SHIPMENT_LINES.map((line) => [line, 0]));
    lineFilteredShipments.forEach((shipment) => {
      const line = getShipmentLine(shipment.productName, 'productCategory' in shipment ? shipment.productCategory : undefined);
      if (line) rows.set(line, (rows.get(line) || 0) + 1);
    });
    return SHIPMENT_LINES.map((label) => ({ label, count: rows.get(label) || 0 }));
  }, [lineFilteredShipments]);

  const customerLineRows = useMemo((): ShipmentRow[] => {
    const counts = new Map<ShipmentLine, number>(SHIPMENT_LINES.map((line) => [line, 0]));
    customerFilteredShipments.forEach((shipment) => {
      if (shipment.customer !== detailCustomer) return;
      const line = getShipmentLine(shipment.productName, 'productCategory' in shipment ? shipment.productCategory : undefined);
      if (line) counts.set(line, (counts.get(line) || 0) + 1);
    });
    return SHIPMENT_LINES
      .filter((label) => label !== '换国内驾照')
      .map((label) => ({ label, count: counts.get(label) || 0 }))
      .filter((row) => row.count > 0);
  }, [customerFilteredShipments, detailCustomer]);

  // ---- Handlers ----
  const handleSearch = () => {
    setStartDate(startDateInput);
    setEndDate(endDateInput);
  };

  const handleReset = () => {
    setStartDateInput('');
    setEndDateInput('');
    setStartDate('');
    setEndDate('');
  };

  const handleCustomerShipmentSearch = () => {
    setCustomerStartDate(customerStartDateInput);
    setCustomerEndDate(customerEndDateInput);
  };

  const handleCustomerShipmentReset = () => {
    setDetailCustomer(null);
    const today = getTodayDate();
    setCustomerStartDateInput(today);
    setCustomerEndDateInput(today);
    setCustomerStartDate(today);
    setCustomerEndDate(today);
  };

  const handleLineShipmentSearch = () => {
    setLineStartDate(lineStartDateInput);
    setLineEndDate(lineEndDateInput);
  };

  const handleLineShipmentReset = () => {
    const today = getTodayDate();
    setLineStartDateInput(today);
    setLineEndDateInput(today);
    setLineStartDate(today);
    setLineEndDate(today);
  };

  // ---- Render helpers ----
  const tabClass = (tab: ReportTab) =>
    `report-list-toolbar__tab ${activeTab === tab ? 'report-list-toolbar__tab--active' : ''}`;

  const renderCount = formatReportCount;

  const renderTranslationProductionTable = () => (
    <div className="license-translation-table-wrap report-statistics-table-wrap">
      <table className="license-translation-table report-statistics-table report-statistics-table--employee">
        <thead>
          <tr>
            <th>员工账号</th>
            <th>翻译数量</th>
            <th>制作数量</th>
          </tr>
        </thead>
        <tbody>
          {translationProductionRows.map((row) => (
            <tr key={row.account}>
              <td>{row.account}</td>
              <td>{renderCount(row.translationCount)}</td>
              <td>{renderCount(row.productionCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderShipmentTable = (firstColumnLabel: string, secondColumnLabel: string, rows: ShipmentRow[]) => {
    return (
      <div className="report-shipment-statistics report-shipment-statistics--single">
        <section className="report-shipment-statistics__section" aria-labelledby="shipment-line-heading">
          <div className="report-shipment-statistics__section-header">
            <h2 id="shipment-line-heading">各产线发货统计</h2>
            <div className="report-shipment-section-filter" aria-label="各产线发货统计时间区间筛选">
              <div className="license-translation-linked-selects report-shipment-section-filter__dates">
                <DatePickerInput ariaLabel="各产线发货统计开始时间" placeholder="开始时间" value={lineStartDateInput} onChange={setLineStartDateInput} />
                <DatePickerInput ariaLabel="各产线发货统计结束时间" placeholder="结束时间" value={lineEndDateInput} onChange={setLineEndDateInput} />
              </div>
              <div className="report-shipment-section-filter__actions">
                <button type="button" className="license-translation-button license-translation-button--primary" onClick={handleLineShipmentSearch}>搜索</button>
                <button type="button" className="license-translation-button" onClick={handleLineShipmentReset}>重置</button>
              </div>
            </div>
          </div>
          <div className="report-shipment-visual report-shipment-visual--line">
            <div className="license-translation-table-wrap report-statistics-table-wrap">
              <table className="license-translation-table report-statistics-table report-statistics-table--shipment">
                <thead>
                  <tr>
                    <th>{firstColumnLabel}</th>
                    <th>{secondColumnLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.label}
                      style={{
                        '--report-row-color': SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length],
                      } as React.CSSProperties}
                    >
                      <td>
                        <span className="report-shipment-table__label">
                          <span className="report-shipment-table__dot" aria-hidden="true" />
                          {row.label}
                        </span>
                      </td>
                      <td>
                        <span className="report-shipment-table__metric">
                          <span className="report-shipment-table__metric-value">{renderCount(row.count)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ShipmentPieChart items={rows} />
          </div>
        </section>
      </div>
    );
  };

  const renderShipmentCustomerTable = () => {
    return (
      <div className="report-shipment-statistics report-shipment-statistics--single">
        <section className="report-shipment-statistics__section" aria-labelledby="shipment-customer-heading">
          <div className="report-shipment-statistics__section-header">
            <h2 id="shipment-customer-heading">重要客户发货统计</h2>
            <div className="report-shipment-section-filter" aria-label="重要客户发货统计时间区间筛选">
              <div className="license-translation-linked-selects report-shipment-section-filter__dates">
                <DatePickerInput ariaLabel="重要客户发货统计开始时间" placeholder="开始时间" value={customerStartDateInput} onChange={setCustomerStartDateInput} />
                <DatePickerInput ariaLabel="重要客户发货统计结束时间" placeholder="结束时间" value={customerEndDateInput} onChange={setCustomerEndDateInput} />
              </div>
              <div className="report-shipment-section-filter__actions">
                <button type="button" className="license-translation-button license-translation-button--primary" onClick={handleCustomerShipmentSearch}>搜索</button>
                <button type="button" className="license-translation-button" onClick={handleCustomerShipmentReset}>重置</button>
              </div>
            </div>
          </div>
          <div className="report-shipment-visual report-shipment-visual--customer">
            <div className="license-translation-table-wrap report-statistics-table-wrap">
              <table className="license-translation-table report-statistics-table report-statistics-table--shipment report-statistics-table--shipment-customer">
                <thead>
                  <tr>
                    <th>重要客户</th>
                    <th>发货订单数量</th>
                    <th>小白本</th>
                    <th>国内公证</th>
                    <th>宣誓翻译件</th>
                    <th>香港公证件</th>
                  </tr>
                </thead>
                <tbody>
                  {shipmentCustomerRows.map((row, index) => (
                    <tr
                      key={row.label}
                      style={{
                        '--report-row-color': SHIPMENT_CHART_COLORS[index % SHIPMENT_CHART_COLORS.length],
                      } as React.CSSProperties}
                    >
                      <td>
                        <span className="report-shipment-table__label">
                          <span className="report-shipment-table__dot" aria-hidden="true" />
                          {row.label}
                        </span>
                      </td>
                      <td>
                        <span className="report-shipment-table__metric">
                          <span className="report-shipment-table__metric-value">{renderCount(row.totalCount)}</span>
                        </span>
                      </td>
                      <td>{renderCount(row.smallbookCount)}</td>
                      <td>{renderCount(row.notaryCount)}</td>
                      <td>{renderCount(row.swornCount)}</td>
                      <td>{renderCount(row.hongKongNotaryCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detailCustomer ? (
              <ShipmentPieChart
                key={`${detailCustomer}-${customerStartDate}-${customerEndDate}`}
                variant="donut"
                title={`${detailCustomer} · 产线发货`}
                items={customerLineRows}
                onBack={() => setDetailCustomer(null)}
              />
            ) : (
              <ShipmentPieChart
                key={`customer-overview-${customerStartDate}-${customerEndDate}`}
                variant="pie"
                items={shipmentCustomerRows.map((row) => ({ label: row.label, count: row.totalCount }))}
                onItemClick={(label) => setDetailCustomer(label as ShipmentCustomer)}
              />
            )}
          </div>
        </section>
      </div>
    );
  };

  // ---- Main render ----
  return (
    <div className="license-translation-page animate-fadeIn">
      <header className={`license-translation-topbar${activeTab === 'shipment-data' ? ' report-list-topbar--compact' : ''}`}>
        <div>
          <div className="license-translation-breadcrumb">
            驾照官后台
            <span>/</span>
            报表
            <span>/</span>
            报表
          </div>
          {activeTab !== 'shipment-data' && <h1>报表</h1>}
        </div>
      </header>

      <section className="report-list-controls" aria-label="报表筛选与类型">
        <div className="report-list-toolbar" role="tablist" aria-label="报表类型">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'translation-production'}
            className={tabClass('translation-production')}
            onClick={() => setActiveTab('translation-production')}
          >
            翻译及制作数量
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'smallbook-data'}
            className={tabClass('smallbook-data')}
            onClick={() => setActiveTab('smallbook-data')}
          >
            小白本数据统计
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shipment-data'}
            className={tabClass('shipment-data')}
            onClick={() => setActiveTab('shipment-data')}
          >
            发货统计
          </button>
        </div>

        {activeTab === 'translation-production' && <div className="report-list-time-filter">
          <span className="report-list-time-filter__label">
            {activeTab === 'translation-production' ? '日期' : '时间区间'}
          </span>
          <div className="license-translation-linked-selects report-list-time-filter__dates">
            <DatePickerInput ariaLabel="开始时间" placeholder="开始时间" value={startDateInput} onChange={setStartDateInput} />
            <DatePickerInput ariaLabel="结束时间" placeholder="结束时间" value={endDateInput} onChange={setEndDateInput} />
          </div>
          <div className="report-list-time-filter__actions">
            <button type="button" className="license-translation-button license-translation-button--primary" onClick={handleSearch}>
              搜索
            </button>
            <button type="button" className="license-translation-button" onClick={handleReset}>
              重置
            </button>
          </div>
        </div>}
      </section>

      <section className={`license-translation-card report-statistics-card ${activeTab !== 'translation-production' ? 'report-statistics-card--visual' : ''}`}>
        {activeTab === 'translation-production' && renderTranslationProductionTable()}
        {activeTab === 'smallbook-data' && <SmallbookStatisticsPanel />}
        {activeTab === 'shipment-data' && (
          <div className="report-shipment-overview">
            {renderShipmentCustomerTable()}
            {renderShipmentTable('产线', '发货数量', shipmentLineRows)}
          </div>
        )}
      </section>
    </div>
  );
};

export default ReportListPage;
