// ============================================
// ProductList - Product Management
// ============================================
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../shared/i18n/config';
import { addProduct, deleteProduct, getNextProductId, getProducts, updateProduct } from '../../services/mockDataService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import ResolvedImage from '../../shared/components/ResolvedImage';
import type { AgentLevel, Product, ProductCategory, ProductProcessType } from '../../shared/types';
import { saveLocalImageSource } from '../../shared/utils/localImageStore';
import { getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import './ProductList.css';

const PRICE_MATRIX_AGENT_LEVELS: AgentLevel[] = ['l1', 'l2', 'l3', 'self'];
const PRODUCT_STATUS_PRIORITY: Record<Product['status'], number> = {
  active: 1,
  inactive: 0,
};

type ProductEditorMode = 'create' | 'edit';

interface ProductEditorDraft {
  productId: string;
  title: string;
  description: string;
  category: ProductCategory | '';
  coverImage: string;
  defaultPrice: string;
  weight: string;
  status: Product['status'];
}

interface PriceMatrixEditorDraft {
  typeId: string;
  pricing: ProductProcessType['pricing'];
}

const EMPTY_PRODUCT_EDITOR: ProductEditorDraft = {
  productId: '',
  title: '',
  description: '',
  category: '',
  coverImage: '',
  defaultPrice: '',
  weight: '0',
  status: 'active',
};

const getCurrentTimestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

const getProductDisplayId = (productId: string) => productId.split('-')[1] || productId;

const getProductDefaultPrice = (product: Product) => {
  if (typeof product.defaultPrice === 'number' && Number.isFinite(product.defaultPrice)) {
    return product.defaultPrice;
  }

  return product.processTypes[0]?.pricing[0]?.price || 0;
};

const cloneProcessTypesPricing = (processTypes: ProductProcessType[]): PriceMatrixEditorDraft[] =>
  processTypes.map((processType) => ({
    typeId: processType.typeId,
    pricing: PRICE_MATRIX_AGENT_LEVELS.map((agentLevel) => {
      const tier = processType.pricing.find((pricing) => pricing.agentLevel === agentLevel);

      return {
        agentLevel,
        price: tier?.price || 0,
      };
    }),
  }));

const getProductDefaultPriceFromProcessTypes = (processTypes: ProductProcessType[]) =>
  processTypes[0]?.pricing.find((pricing) => pricing.agentLevel === 'self')?.price || 0;

const getProcessTypePriceByAgentLevel = (processType: ProductProcessType, agentLevel: AgentLevel) =>
  processType.pricing.find((pricing) => pricing.agentLevel === agentLevel)?.price || 0;

const formatPriceValue = (price: number) => price.toFixed(2);

const getPriceDetailColumnWidth = (label: string) => {
  const characterCount = Array.from(label).length;
  return Math.min(240, Math.max(168, characterCount * 16 + 40));
};

const sortProducts = (products: Product[]) =>
  [...products].sort((a, b) => {
    const statusDiff = PRODUCT_STATUS_PRIORITY[b.status] - PRODUCT_STATUS_PRIORITY[a.status];
    if (statusDiff !== 0) return statusDiff;

    const weightDiff = b.weight - a.weight;
    if (weightDiff !== 0) return weightDiff;

    return b.createdAt.localeCompare(a.createdAt);
  });

const createEditorDraft = (product?: Product): ProductEditorDraft => {
  if (!product) return EMPTY_PRODUCT_EDITOR;

  return {
    productId: product.productId,
    title: product.title,
    description: product.description,
    category: product.category,
    coverImage: product.coverImage || '',
    defaultPrice: String(getProductDefaultPrice(product)),
    weight: String(product.weight),
    status: product.status,
  };
};

const getCoverVariant = (product: Product) => {
  if (product.title.includes('\u5c0f\u767d\u672c')) return 'book';
  if (product.title.includes('NAATI')) return 'australia';
  if (product.title.includes('NZTA')) return 'newzealand';
  if (product.title.includes('\u897f\u73ed\u7259')) return 'spain';
  if (product.title.includes('\u5fb7\u8bed')) return 'germany';
  if (product.title.includes('\u6cd5\u8bed')) return 'france';
  if (product.category === 'domestic_license') return 'domestic-license';
  if (product.category === 'notary' || product.category === 'local_language_notary') return 'notary';
  if (product.category === 'idp') return 'idp';
  return 'translation';
};

const getCoverMeta = (product: Product) => {
  if (product.title.includes('\u5c0f\u767d\u672c')) return { code: 'IDP', sub: '\u56fd\u9645\u8ba4\u8bc1' };
  if (product.title.includes('NAATI')) return { code: 'NAATI', sub: '\u6fb3\u6d32\u8ba4\u8bc1' };
  if (product.title.includes('NZTA')) return { code: 'NZTA', sub: '\u65b0\u897f\u5170\u8ba4\u8bc1' };
  if (product.title.includes('\u897f\u73ed\u7259')) return { code: 'ESP', sub: '\u5ba3\u8a93\u7ffb\u8bd1' };
  if (product.title.includes('\u5fb7\u8bed')) return { code: 'DE', sub: '\u7535\u5b50\u4ef6' };
  if (product.title.includes('\u6cd5\u8bed')) return { code: 'FR', sub: '\u7535\u5b50\u4ef6' };
  if (product.category === 'domestic_license') return { code: 'CN-DL', sub: '\u6362\u8bc1\u7ffb\u8bd1' };
  if (product.category === 'local_language_notary') return { code: 'LOCAL', sub: '\u5f53\u5730\u8bed\u8a00\u516c\u8bc1\u4ef6' };
  if (product.category === 'notary') return { code: 'NOTARY', sub: '\u516c\u8bc1\u4ef6' };
  if (product.category === 'idp') return { code: 'IDP', sub: '\u56fd\u9645\u9a7e\u7167' };
  return { code: 'TR', sub: '\u7ffb\u8bd1\u8ba4\u8bc1' };
};

const ProductList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<Product[]>(() => sortProducts(getProducts()));
  const [filterName, setFilterName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [priceDetailProduct, setPriceDetailProduct] = useState<Product | null>(null);
  const [priceEditorProduct, setPriceEditorProduct] = useState<Product | null>(null);
  const [priceMatrixDraft, setPriceMatrixDraft] = useState<PriceMatrixEditorDraft[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<ProductEditorMode>('create');
  const [editorDraft, setEditorDraft] = useState<ProductEditorDraft>(EMPTY_PRODUCT_EDITOR);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshProducts = () => {
    setProducts(sortProducts(getProducts()));
  };

  const filteredProducts = useMemo(() => {
    const keyword = filterName.trim().toLowerCase();

    return products.filter((product) => {
      if (!keyword) return true;

      return [product.productId, product.title, product.description, t(`product.status.${product.status}`)]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [filterName, products, t]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [currentPage, filteredProducts, pageSize]);

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilterName('');
    setCurrentPage(1);
  };

  const handleOpenCreateEditor = () => {
    setEditorMode('create');
    setEditorDraft(EMPTY_PRODUCT_EDITOR);
    setIsEditorOpen(true);
  };

  const handleOpenEditEditor = (product: Product) => {
    setEditorMode('edit');
    setEditorDraft(createEditorDraft(product));
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditorMode('create');
    setEditorDraft(EMPTY_PRODUCT_EDITOR);
  };

  const handleEditorFieldChange = <K extends keyof ProductEditorDraft>(field: K, value: ProductEditorDraft[K]) => {
    setEditorDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumericFieldChange = (field: 'defaultPrice' | 'weight', value: string) => {
    const sanitizedValue = value.replace(/[^\d]/g, '');
    handleEditorFieldChange(field, sanitizedValue);
  };

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleEditorFieldChange('coverImage', reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSaveProduct = async () => {
    const title = editorDraft.title.trim();
    const description = editorDraft.description.trim();
    const defaultPrice = Number(editorDraft.defaultPrice);
    const weight = Number(editorDraft.weight);

    if (!title || !editorDraft.category || !Number.isFinite(defaultPrice) || defaultPrice <= 0 || !Number.isFinite(weight) || weight < 0) {
      showToast('error', t('product.toast.incompleteFields'));
      return;
    }

    try {
      if (editorMode === 'edit') {
        const existingProduct = products.find((product) => product.productId === editorDraft.productId);
        if (!existingProduct) return;

        const coverImage = await saveLocalImageSource(
          `product-cover-${existingProduct.productId}`,
          editorDraft.coverImage,
        );

        updateProduct(existingProduct.productId, {
          title,
          description,
          category: editorDraft.category,
          coverImage: coverImage || undefined,
          defaultPrice,
          weight,
          status: editorDraft.status,
          updatedAt: getCurrentTimestamp(),
        });
      } else {
        const productId = getNextProductId();
        const timestamp = getCurrentTimestamp();
        const coverImage = await saveLocalImageSource(`product-cover-${productId}`, editorDraft.coverImage);

        addProduct({
          productId,
          title,
          description,
          category: editorDraft.category,
          coverImage: coverImage || undefined,
          defaultPrice,
          weight,
          status: editorDraft.status,
          processTypes: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      refreshProducts();
      setCurrentPage(1);
      handleCloseEditor();
      showToast('success', t('product.toast.saveSuccess'));
    } catch {
      showToast('error', '产品保存失败，请减少封面图片大小后重试');
    }
  };

  const handleDeleteProduct = () => {
    if (!confirmDeleteId) return;

    try {
      deleteProduct(confirmDeleteId);
      refreshProducts();
      setConfirmDeleteId(null);
      showToast('success', t('product.toast.deleteSuccess'));
    } catch {
      showToast('error', '产品删除失败，请稍后重试');
    }
  };

  const handleOpenPriceDetail = (product: Product) => {
    setPriceDetailProduct(product);
  };

  const handleClosePriceDetail = () => {
    setPriceDetailProduct(null);
  };

  const handleOpenPriceEditor = (product: Product) => {
    setPriceEditorProduct(product);
    setPriceMatrixDraft(cloneProcessTypesPricing(product.processTypes));
  };

  const handleClosePriceEditor = () => {
    setPriceEditorProduct(null);
    setPriceMatrixDraft([]);
  };

  const handlePriceMatrixChange = (typeId: string, agentLevel: AgentLevel, value: string) => {
    const sanitizedValue = value.replace(/[^\d.]/g, '');
    const numericValue = sanitizedValue === '' ? 0 : Number(sanitizedValue);

    setPriceMatrixDraft((prev) =>
      prev.map((processType) =>
        processType.typeId === typeId
          ? {
              ...processType,
              pricing: processType.pricing.map((pricing) =>
                pricing.agentLevel === agentLevel
                  ? {
                      ...pricing,
                      price: Number.isFinite(numericValue) ? numericValue : 0,
                    }
                  : pricing,
              ),
            }
          : processType,
      ),
    );
  };

  const handleSavePriceMatrix = () => {
    if (!priceEditorProduct) return;

    const nextProcessTypes = priceEditorProduct.processTypes.map((processType) => {
      const draft = priceMatrixDraft.find((item) => item.typeId === processType.typeId);

      if (!draft) return processType;

      return {
        ...processType,
        pricing: draft.pricing.map((pricing) => ({
          ...pricing,
          price: Number.isFinite(pricing.price) && pricing.price >= 0 ? pricing.price : 0,
        })),
      };
    });

    try {
      updateProduct(priceEditorProduct.productId, {
        processTypes: nextProcessTypes,
        defaultPrice: nextProcessTypes.length > 0
          ? getProductDefaultPriceFromProcessTypes(nextProcessTypes)
          : getProductDefaultPrice(priceEditorProduct),
        updatedAt: getCurrentTimestamp(),
      });

      const savedProduct = getProducts().find((product) => product.productId === priceEditorProduct.productId) || null;

      refreshProducts();
      handleClosePriceEditor();
      if (savedProduct) {
        setPriceDetailProduct(savedProduct);
      }
      showToast('success', '\u4ef7\u683c\u77e9\u9635\u5df2\u66f4\u65b0');
    } catch {
      showToast('error', '价格保存失败，请稍后重试');
    }
  };

  const priceDetailModalWidth = useMemo(() => {
    if (!priceDetailProduct) return 0;

    const firstColumnWidth = Math.max(
      188,
      priceDetailProduct.processTypes.reduce((maxWidth, processType) => {
        const label = getProductProcessTypeLabel(processType.name, t);
        return Math.max(maxWidth, getPriceDetailColumnWidth(label));
      }, 0),
    );
    const agentColumnsWidth = PRICE_MATRIX_AGENT_LEVELS.length * 132;

    return Math.max(780, firstColumnWidth + agentColumnsWidth + 56);
  }, [priceDetailProduct, t]);

  const priceEditorModalWidth = useMemo(() => {
    if (!priceEditorProduct) return 0;

    const firstColumnWidth = Math.max(
      188,
      priceEditorProduct.processTypes.reduce((maxWidth, processType) => {
        const label = getProductProcessTypeLabel(processType.name, t);
        return Math.max(maxWidth, getPriceDetailColumnWidth(label));
      }, 0),
    );
    const agentColumnsWidth = PRICE_MATRIX_AGENT_LEVELS.reduce((total, agentLevel) => {
      const label = t(`product.agentLevel.${agentLevel}`);
      return total + getPriceDetailColumnWidth(label);
    }, 0);

    return Math.max(860, firstColumnWidth + agentColumnsWidth + 56);
  }, [priceEditorProduct, t]);

  const renderCover = (product: Product) => {
    if (product.coverImage) {
      return (
        <div className="product-cover product-cover--uploaded">
          <ResolvedImage className="product-cover__image" src={product.coverImage} alt={product.title} />
        </div>
      );
    }

    const meta = getCoverMeta(product);
    const variant = getCoverVariant(product);

    return (
      <div className={`product-cover product-cover--${variant}`}>
        <div className="product-cover__card">
          <div className="product-cover__shine" />
          <div className="product-cover__code">{meta.code}</div>
          <div className="product-cover__sub">{meta.sub}</div>
          <div className="product-cover__footer">MEI KA</div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-main animate-fadeIn order-list-page product-sale-page">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <div className="app-topbar">
        <div className="order-list-topbar">
          <div className="app-topbar__breadcrumb">
            后台管理
            <span>/</span>
            产品中心
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel">
          <div className="order-filter-grid product-sale-filter-grid">
            <div className="product-sale-filter-row">
              <div className="form-group order-filter-field product-sale-filter-field">
              <label className="form-label">精准搜索</label>
              <input
                className="form-input"
                value={filterName}
                onChange={(event) => setFilterName(event.target.value)}
                placeholder="搜索标题、产品 ID、状态"
              />
              </div>

              <div className="order-filter-actions order-filter-actions--inline product-sale-filter-actions">
                <button type="button" className="btn btn--primary" onClick={handleSearch}>
                  搜索
                </button>
                <button type="button" className="btn btn--secondary" onClick={handleReset}>
                  重置
                </button>
              </div>

              <button
                type="button"
                className="btn btn--primary product-sale-toolbar__btn product-sale-toolbar__btn--add product-sale-filter-create"
                onClick={handleOpenCreateEditor}
              >
                添加产品
              </button>
            </div>
          </div>
        </div>

        <section className="card order-list-card product-sale-card">
          <div className="table-wrapper product-sale-table-wrapper">
            <table className="data-table product-sale-table" id="product-table">
              <thead>
                <tr>
                  <th style={{ width: 92 }}>产品ID</th>
                  <th style={{ minWidth: 260 }}>标题</th>
                  <th style={{ width: 132 }}>封面</th>
                  <th style={{ width: 140 }}>价格</th>
                  <th style={{ width: 138 }}>产品类别</th>
                  <th style={{ width: 110 }}>权重</th>
                  <th style={{ width: 118 }}>产品状态</th>
                  <th style={{ width: 168 }}>创建时间</th>
                  <th style={{ minWidth: 252 }}>操作</th>
                </tr>
              </thead>

              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      <div className="empty-state__icon">📝</div>
                      <div className="empty-state__text">{t('common.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <tr key={product.productId}>
                      <td className="product-sale-table__id">{getProductDisplayId(product.productId)}</td>
                      <td>
                        <div className="product-sale-table__title">{product.title}</div>
                      </td>
                      <td>{renderCover(product)}</td>
                      <td>
                        <div className="product-sale-price">
                          <button
                            type="button"
                            className="product-sale-link product-sale-link--price"
                            onClick={() => handleOpenPriceDetail(product)}
                          >
                            查看价格详情
                          </button>
                        </div>
                      </td>
                      <td>{t(`product.category.${product.category}`)}</td>
                      <td>
                        <span className="product-weight-pill">{product.weight}</span>
                      </td>
                      <td>
                        <span className={`product-status-pill product-status-pill--${product.status}`}>
                          {t(`product.status.${product.status}`)}
                        </span>
                      </td>
                      <td className="product-sale-table__time">{product.createdAt}</td>
                      <td>
                        <div className="product-sale-actions">
                          <button
                            type="button"
                            className="product-sale-action-btn product-sale-action-btn--primary"
                            onClick={() => handleOpenEditEditor(product)}
                          >
                            修改
                          </button>
                          <button type="button" className="product-sale-action-btn" onClick={() => handleOpenPriceEditor(product)}>
                            修改价格
                          </button>
                          <button
                            type="button"
                            className="product-sale-action-btn"
                            onClick={() => navigate(`/products/${product.productId}/process-types`)}
                          >
                            办理类型
                          </button>
                          <button
                            type="button"
                            className="product-sale-action-btn product-sale-action-btn--danger"
                            onClick={() => setConfirmDeleteId(product.productId)}
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

          <div className="product-sale-pagination">
            <ListUnifiedPagination
              total={filteredProducts.length}
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
          <div className="modal product-editor-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="product-editor-modal__close" onClick={handleCloseEditor} aria-label="关闭">
              ×
            </button>

            <div className="product-editor-modal__header">
              <h3 className="product-editor-modal__title">{editorMode === 'edit' ? '修改产品' : '添加产品'}</h3>
            </div>

            <div className="product-editor-modal__body">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="product-editor-modal__file-input"
                onChange={handleCoverUpload}
              />

              <div className="product-editor-modal__row">
                <label className="product-editor-modal__label">标题</label>
                <div className="product-editor-modal__field">
                  <input
                    className="product-editor-modal__input"
                    value={editorDraft.title}
                    onChange={(event) => handleEditorFieldChange('title', event.target.value)}
                    placeholder="请输入产品标题"
                  />
                </div>
              </div>

              <div className="product-editor-modal__row">
                <label className="product-editor-modal__label">描述</label>
                <div className="product-editor-modal__field">
                  <input
                    className="product-editor-modal__input"
                    value={editorDraft.description}
                    onChange={(event) => handleEditorFieldChange('description', event.target.value)}
                    placeholder="请输入产品描述"
                  />
                </div>
              </div>

              <div className="product-editor-modal__row">
                <label className="product-editor-modal__label product-editor-modal__label--required">产品类别</label>
                <div className="product-editor-modal__field">
                  <select
                    className="product-editor-modal__input product-editor-modal__select"
                    value={editorDraft.category}
                    onChange={(event) => handleEditorFieldChange('category', event.target.value as ProductCategory)}
                  >
                    <option value="">请选择产品类别</option>
                    <option value="translation">{t('product.category.translation')}</option>
                    <option value="domestic_license">{t('product.category.domestic_license')}</option>
                    <option value="notary">{t('product.category.notary')}</option>
                    <option value="local_language_notary">{t('product.category.local_language_notary')}</option>
                    <option value="idp">{t('product.category.idp')}</option>
                  </select>
                </div>
              </div>

              <div className="product-editor-modal__row product-editor-modal__row--upload">
                <label className="product-editor-modal__label">封面图片</label>
                <div className="product-editor-modal__field">
                  <button
                    type="button"
                    className="product-editor-modal__upload"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {editorDraft.coverImage ? (
                      <ResolvedImage
                        className="product-editor-modal__upload-image"
                        src={editorDraft.coverImage}
                        alt="产品封面预览"
                      />
                    ) : (
                      <span className="product-editor-modal__upload-plus">+</span>
                    )}
                  </button>
                  <div className="product-editor-modal__hint">建议尺寸：600x800 像素</div>
                </div>
              </div>

              <div className="product-editor-modal__row">
                <label className="product-editor-modal__label product-editor-modal__label--required">默认价格</label>
                <div className="product-editor-modal__field">
                  <div className="product-editor-modal__input-group">
                    <input
                      className="product-editor-modal__input"
                      value={editorDraft.defaultPrice}
                      onChange={(event) => handleNumericFieldChange('defaultPrice', event.target.value)}
                      placeholder="请输入默认价格"
                    />
                    <span className="product-editor-modal__suffix">元</span>
                  </div>
                </div>
              </div>

              <div className="product-editor-modal__row">
                <label className="product-editor-modal__label product-editor-modal__label--required">权重</label>
                <div className="product-editor-modal__field">
                  <div className="product-editor-modal__input-group">
                    <input
                      className="product-editor-modal__input"
                      value={editorDraft.weight}
                      onChange={(event) => handleNumericFieldChange('weight', event.target.value)}
                      placeholder="请输入权重"
                    />
                    <span className="product-editor-modal__suffix">级</span>
                  </div>
                </div>
              </div>

              <div className="product-editor-modal__row">
                <label className="product-editor-modal__label">产品状态</label>
                <div className="product-editor-modal__field">
                  <button
                    type="button"
                    className={`product-editor-switch ${editorDraft.status === 'active' ? 'product-editor-switch--active' : ''}`}
                    onClick={() => handleEditorFieldChange('status', editorDraft.status === 'active' ? 'inactive' : 'active')}
                    aria-pressed={editorDraft.status === 'active'}
                  >
                    <span className="product-editor-switch__track">
                      <span className="product-editor-switch__thumb" />
                    </span>
                    <span className="product-editor-switch__text">
                      {editorDraft.status === 'active' ? '已上架，可正常售卖' : '已下架，暂停售卖'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="product-editor-modal__footer">
              <button type="button" className="product-editor-modal__btn product-editor-modal__btn--cancel" onClick={handleCloseEditor}>
                取消
              </button>
              <button type="button" className="product-editor-modal__btn product-editor-modal__btn--confirm" onClick={handleSaveProduct}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">{t('common.confirm')}</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDeleteId(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              <p>是否删除此产品？</p>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setConfirmDeleteId(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--danger" onClick={handleDeleteProduct}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {priceEditorProduct && (
        <div className="modal-overlay" onClick={handleClosePriceEditor}>
          <div
            className="modal product-price-modal"
            style={{ width: `${priceEditorModalWidth}px`, maxWidth: 'calc(100vw - 24px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header product-price-modal__header">
              <h3 className="modal__title">{priceEditorProduct.title} - 修改价格</h3>
              <button className="btn btn--ghost btn--sm" onClick={handleClosePriceEditor}>
                ×
              </button>
            </div>
            <div className="modal__body product-price-modal__body">
              <p className="product-price-modal__tip">按办理类型与代理等级填写价格，保存后可在列表中查看价格详情。</p>
              <div className="product-price-modal__table-wrap">
                <table className="price-matrix">
                  <thead>
                    <tr>
                      <th>办理类型</th>
                      {PRICE_MATRIX_AGENT_LEVELS.map((agentLevel) => (
                        <th key={agentLevel}>{t(`product.agentLevel.${agentLevel}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priceEditorProduct.processTypes.length === 0 ? (
                      <tr>
                        <td colSpan={PRICE_MATRIX_AGENT_LEVELS.length + 1} className="empty-state">
                          暂无办理类型，请先在办理类型中新增。
                        </td>
                      </tr>
                    ) : (
                      priceEditorProduct.processTypes.map((processType) => {
                        const draft = priceMatrixDraft.find((item) => item.typeId === processType.typeId);

                        return (
                          <tr key={processType.typeId}>
                            <td style={{ fontWeight: 600, textAlign: 'left', background: 'var(--color-bg-body)' }}>
                              {getProductProcessTypeLabel(processType.name, t)}
                            </td>
                            {PRICE_MATRIX_AGENT_LEVELS.map((agentLevel) => {
                              const tier = draft?.pricing.find((pricing) => pricing.agentLevel === agentLevel);

                              return (
                                <td key={agentLevel}>
                                  <div className="product-price-detail-field">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      className="product-price-detail-field__input"
                                      value={tier?.price ?? 0}
                                      onChange={(event) => handlePriceMatrixChange(processType.typeId, agentLevel, event.target.value)}
                                    />
                                    <span className="product-price-detail-field__unit">元</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={handleClosePriceEditor}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--primary" onClick={handleSavePriceMatrix}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {priceDetailProduct && (
        <div className="modal-overlay" onClick={handleClosePriceDetail}>
          <div
            className="modal product-price-modal product-price-modal--detail"
            style={{ width: `${priceDetailModalWidth}px`, maxWidth: 'calc(100vw - 24px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header product-price-modal__header">
              <h3 className="modal__title">{priceDetailProduct.title} - 查看价格</h3>
              <button className="btn btn--ghost btn--sm" onClick={handleClosePriceDetail}>
                ×
              </button>
            </div>
            <div className="modal__body product-price-modal__body">
              <p className="product-price-modal__tip">按办理类型与代理等级查看价格，当前数据为只读展示。</p>

              <div className="product-price-modal__table-wrap">
                <table className="price-matrix price-matrix--readonly">
                  <thead>
                    <tr>
                      <th>办理类型</th>
                      {PRICE_MATRIX_AGENT_LEVELS.map((agentLevel) => (
                        <th key={agentLevel}>{t(`product.agentLevel.${agentLevel}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priceDetailProduct.processTypes.length === 0 ? (
                      <tr>
                        <td colSpan={PRICE_MATRIX_AGENT_LEVELS.length + 1} className="empty-state">
                          暂无办理类型，请先在办理类型中新增。
                        </td>
                      </tr>
                    ) : (
                      priceDetailProduct.processTypes.map((processType) => (
                        <tr key={processType.typeId}>
                          <td className="product-price-modal__label-cell">
                            {getProductProcessTypeLabel(processType.name, t)}
                          </td>
                          {PRICE_MATRIX_AGENT_LEVELS.map((agentLevel) => (
                            <td key={`${processType.typeId}-${agentLevel}`}>
                              <div className="product-price-modal__readonly-value">
                                <span>{formatPriceValue(getProcessTypePriceByAgentLevel(processType, agentLevel))}</span>
                                <span className="product-price-modal__readonly-unit">元</span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={handleClosePriceDetail}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
