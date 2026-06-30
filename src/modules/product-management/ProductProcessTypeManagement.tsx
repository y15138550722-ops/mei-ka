import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../../shared/i18n/config';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { getProductById, getProducts, updateProduct } from '../../services/mockDataService';
import type { AgentLevel, PriceTier, ProductProcessType } from '../../shared/types';
import { BUILT_IN_PROCESS_TYPE_KEYS, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import {
  PUSH_TIMELINESS_UNIT_OPTIONS,
  createPushTimelinessEntry,
  formatPushTimelinessEntry,
  getDraftPushTimelinessEntry,
  getStoredPushTimelinessConfig,
  normalizePushTimelinessConfig,
  persistPushTimelinessConfig,
  sanitizePushTimelinessUnit,
  sanitizePushTimelinessValue,
  type PushTimelinessConfig,
  type TimelinessUnit,
} from '../../shared/utils/pushTimeliness';
import './ProductProcessTypeManagement.css';

const AGENT_LEVELS: AgentLevel[] = ['self', 'l1', 'l2', 'l3'];

const PROCESS_TYPE_DEFAULTS = {
  estimatedDays: 3,
  weight: 0,
};

interface ProcessTypeEditorDraft {
  typeId: string;
  name: string;
  description: string;
  weight: string;
  defaultPrice: string;
}

const EMPTY_EDITOR_DRAFT: ProcessTypeEditorDraft = {
  typeId: '',
  name: '',
  description: '',
  weight: '0',
  defaultPrice: '',
};

const getCurrentTimestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

const normalizeTextValue = (value: string) => value.trim().replace(/\s+/g, ' ');

const getDefaultPrice = (processType: ProductProcessType) =>
  processType.pricing.find((pricing) => pricing.agentLevel === 'self')?.price || processType.pricing[0]?.price || 0;

const getProcessTypeDescription = (processType: ProductProcessType) => {
  if (processType.description?.trim()) {
    return processType.description.trim();
  }

  return `${processType.estimatedDays}个工作日`;
};

const getProcessTypeSortIndex = (value: string) => {
  const builtInIndex = BUILT_IN_PROCESS_TYPE_KEYS.indexOf(value as (typeof BUILT_IN_PROCESS_TYPE_KEYS)[number]);
  return builtInIndex === -1 ? BUILT_IN_PROCESS_TYPE_KEYS.length : builtInIndex;
};

const getEstimatedDaysByProcessTypeName = (name: string) => {
  if (name === 'normal') return 15;
  if (name === 'priority') return 7;
  if (name === 'urgent') return 3;
  return PROCESS_TYPE_DEFAULTS.estimatedDays;
};

const createPricingFromBasePrice = (basePrice: number, currentPricing?: PriceTier[]): PriceTier[] => {
  const fallbackGaps: Record<AgentLevel, number> = {
    self: 0,
    l1: 20,
    l2: 40,
    l3: 60,
  };

  if (!currentPricing || currentPricing.length === 0) {
    return AGENT_LEVELS.map((agentLevel) => ({
      agentLevel,
      price: Math.max(basePrice - fallbackGaps[agentLevel], 0),
    }));
  }

  const currentBasePrice = currentPricing.find((pricing) => pricing.agentLevel === 'self')?.price || basePrice;

  return AGENT_LEVELS.map((agentLevel) => {
    const tier = currentPricing.find((pricing) => pricing.agentLevel === agentLevel);
    const priceGap = currentBasePrice - (tier?.price ?? currentBasePrice);

    return {
      agentLevel,
      price: Math.max(basePrice - priceGap, 0),
    };
  });
};

const ProductProcessTypeManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [version, setVersion] = useState(0);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorDraft, setEditorDraft] = useState<ProcessTypeEditorDraft>(EMPTY_EDITOR_DRAFT);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductProcessType | null>(null);
  const [isPushTimelinessModalOpen, setIsPushTimelinessModalOpen] = useState(false);
  const [pushTimelinessConfig, setPushTimelinessConfig] = useState<PushTimelinessConfig>(() =>
    getStoredPushTimelinessConfig(getProducts()),
  );
  const [draftPushTimelinessConfig, setDraftPushTimelinessConfig] = useState<PushTimelinessConfig>(() =>
    getStoredPushTimelinessConfig(getProducts()),
  );

  const allProducts = useMemo(() => getProducts(), [version]);
  const product = useMemo(() => (id ? getProductById(id) : undefined), [id, version]);
  const normalizedPushTimelinessConfig = useMemo(
    () => normalizePushTimelinessConfig(pushTimelinessConfig, allProducts),
    [allProducts, pushTimelinessConfig],
  );

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const processTypes = useMemo(() => {
    if (!product) return [];

    const sourceOrder = new Map(product.processTypes.map((processType, index) => [processType.typeId, index]));

    return [...product.processTypes].sort((a, b) => {
      const weightDiff = (a.weight ?? 0) - (b.weight ?? 0);
      if (weightDiff !== 0) return weightDiff;

      const sortIndexDiff = getProcessTypeSortIndex(a.name) - getProcessTypeSortIndex(b.name);
      if (sortIndexDiff !== 0) return sortIndexDiff;

      const sourceOrderDiff = (sourceOrder.get(a.typeId) ?? 0) - (sourceOrder.get(b.typeId) ?? 0);
      if (sourceOrderDiff !== 0) return sourceOrderDiff;

      return getProductProcessTypeLabel(a.name, t).localeCompare(getProductProcessTypeLabel(b.name, t), 'zh-CN');
    });
  }, [product, t]);

  const filteredProcessTypes = useMemo(() => {
    const keyword = filterKeyword.trim().toLowerCase();
    if (!keyword) return processTypes;

    return processTypes.filter((processType) =>
      [
        getProductProcessTypeLabel(processType.name, t),
        getProcessTypeDescription(processType),
        String(processType.weight ?? 0),
        String(getDefaultPrice(processType)),
        product ? formatPushTimelinessEntry(getDraftPushTimelinessEntry(normalizedPushTimelinessConfig, product.productId, processType.typeId)) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [filterKeyword, normalizedPushTimelinessConfig, processTypes, product, t]);

  const paginatedProcessTypes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProcessTypes.slice(start, start + pageSize);
  }, [currentPage, filteredProcessTypes, pageSize]);

  const pushTimelinessRows = useMemo(
    () =>
      processTypes.map((processType) => ({
        key: processType.typeId,
        label: getProductProcessTypeLabel(processType.name, t),
      })),
    [processTypes, t],
  );

  const getProcessTypePushTimelinessDisplay = (processType: ProductProcessType) => {
    if (!product) {
      return '--';
    }

    return formatPushTimelinessEntry(
      getDraftPushTimelinessEntry(normalizedPushTimelinessConfig, product.productId, processType.typeId),
    );
  };

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditorMode('create');
    setEditorDraft(EMPTY_EDITOR_DRAFT);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteTarget(null);
  };

  const handleOpenPushTimelinessModal = () => {
    setDraftPushTimelinessConfig(normalizedPushTimelinessConfig);
    setIsPushTimelinessModalOpen(true);
  };

  const handleClosePushTimelinessModal = () => {
    setIsPushTimelinessModalOpen(false);
  };

  const handleEditorFieldChange = <K extends keyof ProcessTypeEditorDraft>(field: K, value: ProcessTypeEditorDraft[K]) => {
    setEditorDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumericFieldChange = (field: 'weight' | 'defaultPrice', value: string) => {
    handleEditorFieldChange(field, value.replace(/[^\d]/g, ''));
  };

  const handleOpenCreate = () => {
    if (!product) return;

    const basePrice = product.defaultPrice || product.processTypes[0]?.pricing[0]?.price || 50;

    setEditorMode('create');
    setEditorDraft({
      typeId: '',
      name: '',
      description: '',
      weight: String(PROCESS_TYPE_DEFAULTS.weight),
      defaultPrice: String(basePrice),
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (processType: ProductProcessType) => {
    setEditorMode('edit');
    setEditorDraft({
      typeId: processType.typeId,
      name: processType.name,
      description: getProcessTypeDescription(processType),
      weight: String(processType.weight ?? 0),
      defaultPrice: String(getDefaultPrice(processType)),
    });
    setIsEditorOpen(true);
  };

  const handleOpenDeleteConfirm = (processType: ProductProcessType) => {
    setDeleteTarget(processType);
  };

  const handleSave = () => {
    if (!product) return;

    const normalizedName = normalizeTextValue(editorDraft.name);
    const normalizedDescription = normalizeTextValue(editorDraft.description);
    const weight = Number(editorDraft.weight);
    const defaultPrice = Number(editorDraft.defaultPrice);

    if (!normalizedName || !normalizedDescription || !Number.isFinite(weight) || weight < 0 || !Number.isFinite(defaultPrice) || defaultPrice <= 0) {
      showToast('error', '请完整填写办理类型名称、描述、默认价格和权重');
      return;
    }

    const hasDuplicateName = product.processTypes.some((processType) => {
      if (editorMode === 'edit' && processType.typeId === editorDraft.typeId) return false;
      return normalizeTextValue(processType.name).toLowerCase() === normalizedName.toLowerCase();
    });

    if (hasDuplicateName) {
      showToast('error', '办理类型名称已存在，请修改后再保存');
      return;
    }

    const nextProcessTypes =
      editorMode === 'edit'
        ? product.processTypes.map((processType) =>
            processType.typeId === editorDraft.typeId
              ? {
                  ...processType,
                  name: normalizedName,
                  description: normalizedDescription,
                  weight,
                  pricing: createPricingFromBasePrice(defaultPrice, processType.pricing),
                }
              : processType,
          )
        : [
            ...product.processTypes,
            {
              typeId: `PT-${product.productId}-${Date.now()}`,
              name: normalizedName,
              description: normalizedDescription,
              weight,
              estimatedDays: getEstimatedDaysByProcessTypeName(normalizedName),
              pricing: createPricingFromBasePrice(defaultPrice),
            },
          ];

    updateProduct(product.productId, {
      processTypes: nextProcessTypes,
      updatedAt: getCurrentTimestamp(),
    });

    setVersion((prev) => prev + 1);
    setCurrentPage(1);
    handleCloseEditor();
    showToast('success', editorMode === 'edit' ? '办理类型已更新' : '办理类型已新增');
  };

  const handleDelete = () => {
    if (!product || !deleteTarget) return;

    const nextProcessTypes = product.processTypes.filter((processType) => processType.typeId !== deleteTarget.typeId);

    updateProduct(product.productId, {
      processTypes: nextProcessTypes,
      updatedAt: getCurrentTimestamp(),
    });

    setVersion((prev) => prev + 1);
    setCurrentPage(1);
    handleCloseDeleteConfirm();
    showToast('success', '办理类型已删除');
  };

  const handleSavePushTimeliness = () => {
    const nextConfig = normalizePushTimelinessConfig(draftPushTimelinessConfig, allProducts);
    setPushTimelinessConfig(nextConfig);
    setDraftPushTimelinessConfig(nextConfig);
    persistPushTimelinessConfig(nextConfig);
    setIsPushTimelinessModalOpen(false);
    showToast('success', '推送时效配置已保存');
  };

  const handlePushConfigChange = (processTypeId: string, value: string) => {
    if (!product) return;

    const sanitizedValue = sanitizePushTimelinessValue(value, { allowIncompleteDecimal: true });

    setDraftPushTimelinessConfig((prev) => ({
      ...prev,
      [product.productId]: {
        ...prev[product.productId],
        [processTypeId]: {
          ...createPushTimelinessEntry(),
          ...prev[product.productId]?.[processTypeId],
          value: sanitizedValue,
        },
      },
    }));
  };

  const handlePushConfigUnitChange = (processTypeId: string, unit: TimelinessUnit) => {
    if (!product) return;

    setDraftPushTimelinessConfig((prev) => ({
      ...prev,
      [product.productId]: {
        ...prev[product.productId],
        [processTypeId]: {
          ...createPushTimelinessEntry(),
          ...prev[product.productId]?.[processTypeId],
          unit,
        },
      },
    }));
  };

  if (!product) {
    return (
      <div className="app-main animate-fadeIn process-type-page">
        <div className="process-type-shell">
          <section className="card process-type-card process-type-card--empty">
            <h1 className="process-type-card__title">办理类型管理</h1>
            <p className="process-type-card__empty-text">未找到对应产品，请返回产品列表重新选择。</p>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/products')}>
              返回产品列表
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main animate-fadeIn process-type-page">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <div className="app-topbar">
        <div className="process-type-topbar">
          <div className="process-type-breadcrumb">
            <button type="button" className="process-type-breadcrumb__link" onClick={() => navigate('/products')}>
              产品列表
            </button>
            <span>/</span>
            <span>{product.title}</span>
            <span>/</span>
            <span>办理类型管理</span>
          </div>
        </div>
      </div>

      <div className="process-type-shell">
        <section className="card process-type-card">
          <div className="process-type-card__header">
            <h1 className="process-type-card__title">办理类型管理</h1>
          </div>

          <div className="process-type-toolbar">
            <div className="process-type-toolbar__search">
              <span className="process-type-toolbar__search-icon">⌕</span>
              <input
                className="process-type-toolbar__search-input"
                value={filterKeyword}
                onChange={(event) => setFilterKeyword(event.target.value)}
                placeholder="搜索办理类型名称、描述、价格、权重"
              />
            </div>

            <div className="process-type-toolbar__actions">
              <button type="button" className="btn btn--secondary process-type-toolbar__btn" onClick={handleSearch}>
                搜索
              </button>
              <button
                type="button"
                className="btn btn--warning process-type-toolbar__btn process-type-toolbar__btn--push"
                onClick={handleOpenPushTimelinessModal}
                disabled={pushTimelinessRows.length === 0}
              >
                推送时效设置
              </button>
              <button type="button" className="btn btn--primary process-type-toolbar__btn process-type-toolbar__btn--add" onClick={handleOpenCreate}>
                新增办理类型
              </button>
            </div>
          </div>

          <div className="table-wrapper process-type-table-wrapper">
            <table className="data-table process-type-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>权重</th>
                  <th style={{ minWidth: 220 }}>办理类型名称</th>
                  <th style={{ minWidth: 320 }}>描述</th>
                  <th style={{ width: 160 }}>推送时效</th>
                  <th style={{ width: 160 }}>默认价格</th>
                  <th style={{ width: 140 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProcessTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <div className="empty-state__icon">暂无</div>
                      <div className="empty-state__text">{t('common.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedProcessTypes.map((processType) => (
                    <tr key={processType.typeId}>
                      <td className="process-type-table__weight">{processType.weight ?? 0}</td>
                      <td>{getProductProcessTypeLabel(processType.name, t)}</td>
                      <td className="process-type-table__description">{getProcessTypeDescription(processType)}</td>
                      <td className="process-type-table__timeliness">{getProcessTypePushTimelinessDisplay(processType)}</td>
                      <td className="process-type-table__price">￥{getDefaultPrice(processType).toFixed(2)}</td>
                      <td>
                        <div className="process-type-table__actions">
                          <button type="button" className="process-type-table__action" onClick={() => handleOpenEdit(processType)}>
                            编辑
                          </button>
                          <button
                            type="button"
                            className="process-type-table__action process-type-table__action--danger"
                            onClick={() => handleOpenDeleteConfirm(processType)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="process-type-pagination">
            <ListUnifiedPagination
              total={filteredProcessTypes.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        </section>
      </div>

      {isEditorOpen && (
        <div className="modal-overlay" onClick={handleCloseEditor}>
          <div className="modal process-type-editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header process-type-editor-modal__header">
              <div>
                <h3 className="modal__title">{editorMode === 'edit' ? '编辑办理类型' : '新增办理类型'}</h3>
                <p className="process-type-editor-modal__subtitle">请填写完整的办理类型信息，保存后将同步到当前产品。</p>
              </div>
              <button type="button" className="process-type-editor-modal__close" onClick={handleCloseEditor} aria-label="关闭">
                ×
              </button>
            </div>

            <div className="modal__body process-type-editor-modal__body">
              <div className="process-type-editor-modal__grid">
                <div className="form-group">
                  <label className="form-label form-label--required">办理类型名称</label>
                  <input
                    className="form-input"
                    value={editorDraft.name}
                    onChange={(event) => handleEditorFieldChange('name', event.target.value)}
                    placeholder="请输入办理类型名称"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label form-label--required">权重</label>
                  <input
                    className="form-input"
                    value={editorDraft.weight}
                    onChange={(event) => handleNumericFieldChange('weight', event.target.value)}
                    placeholder="请输入权重"
                  />
                </div>

                <div className="form-group process-type-editor-modal__field--full">
                  <label className="form-label form-label--required">描述</label>
                  <textarea
                    className="form-textarea process-type-editor-modal__textarea"
                    value={editorDraft.description}
                    onChange={(event) => handleEditorFieldChange('description', event.target.value)}
                    placeholder="请输入办理类型描述"
                    rows={4}
                  />
                </div>

                <div className="form-group process-type-editor-modal__field--full">
                  <label className="form-label form-label--required">默认价格</label>
                  <div className="process-type-editor-modal__input-group">
                    <input
                      className="form-input process-type-editor-modal__input"
                      value={editorDraft.defaultPrice}
                      onChange={(event) => handleNumericFieldChange('defaultPrice', event.target.value)}
                      placeholder="请输入默认价格"
                    />
                    <span className="process-type-editor-modal__suffix">元</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal__footer process-type-editor-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={handleCloseEditor}>
                取消
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={handleCloseDeleteConfirm}>
          <div className="modal process-type-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">删除办理类型</h3>
              <button type="button" className="process-type-editor-modal__close" onClick={handleCloseDeleteConfirm} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="modal__body">
              <p className="process-type-delete-modal__text">
                确认删除“{getProductProcessTypeLabel(deleteTarget.name, t)}”吗？删除后刷新页面，该办理类型不会再保留。
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={handleCloseDeleteConfirm}>
                取消
              </button>
              <button type="button" className="btn btn--danger" onClick={handleDelete}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {isPushTimelinessModalOpen && (
        <div className="modal-overlay" onClick={handleClosePushTimelinessModal}>
          <div className="modal order-push-modal order-push-modal--sheet" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="order-push-modal__close" onClick={handleClosePushTimelinessModal} aria-label="关闭">
              ×
            </button>

            <div className="order-push-modal__intro">
              <h3 className="order-push-modal__title">推送时效设置</h3>
            </div>

            <div className="order-push-modal__selector">
              <div className="form-group order-push-modal__selector-field">
                <label className="form-label">当前产品</label>
                <div className="process-type-push-modal__product">{product.title}</div>
              </div>
            </div>

            {pushTimelinessRows.length > 0 ? (
              <div className="order-push-modal__table">
                <div className="order-push-modal__row order-push-modal__row--head">
                  <div className="order-push-modal__cell order-push-modal__cell--type">办理类型</div>
                  <div className="order-push-modal__cell order-push-modal__cell--limit">收单后推送时效</div>
                </div>

                {pushTimelinessRows.map((row) => {
                  const entry = getDraftPushTimelinessEntry(draftPushTimelinessConfig, product.productId, row.key);

                  return (
                    <div key={`${product.productId}-${row.key}`} className="order-push-modal__row">
                      <div className="order-push-modal__cell order-push-modal__cell--type">
                        <div className="order-push-modal__type-name">{row.label}</div>
                      </div>
                      <div className="order-push-modal__cell order-push-modal__cell--limit">
                        <div className="order-push-modal__input-wrap">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="order-push-modal__input"
                            aria-label={`${row.label} limit`}
                            placeholder="请填写"
                            value={entry.value}
                            onChange={(event) => handlePushConfigChange(row.key, event.target.value)}
                          />
                          <select
                            className="order-push-modal__unit-select"
                            aria-label={`${row.label} unit`}
                            value={entry.unit}
                            onChange={(event) => handlePushConfigUnitChange(row.key, sanitizePushTimelinessUnit(event.target.value))}
                          >
                            {PUSH_TIMELINESS_UNIT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="order-push-modal__empty">暂无可配置办理类型，请先新增办理类型。</div>
            )}

            <div className="order-push-modal__actions">
              <button type="button" className="btn btn--secondary order-push-modal__cancel" onClick={handleClosePushTimelinessModal}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary order-push-modal__save"
                onClick={handleSavePushTimeliness}
                disabled={pushTimelinessRows.length === 0}
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductProcessTypeManagement;
