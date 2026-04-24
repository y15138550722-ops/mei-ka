// ============================================
// ProductForm — FORM_BASE_V1 Create/Edit
// ============================================
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../shared/i18n/config';
import { getProductById, updateProduct, addProduct, getNextProductId } from '../../services/mockDataService';
import FormPageShell, { FormSection } from '../../shared/components/form/FormPageShell';
import type { ProductCategory, AgentLevel, ProductProcessType } from '../../shared/types';
import { getDefaultProcessTypeTemplatesForProduct, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';

const AGENT_LEVELS: AgentLevel[] = ['self', 'l1', 'l2', 'l3'];
const getDefaultProcessTypeDescription = (estimatedDays: number) => `${estimatedDays}个工作日`;

const ProductForm: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existingProduct = isEdit ? getProductById(id!) : null;

  // ── Form State ──
  const [title, setTitle] = useState(existingProduct?.title || '');
  const [category, setCategory] = useState<ProductCategory>(existingProduct?.category || 'idp');
  const [description, setDescription] = useState(existingProduct?.description || '');
  const [weight, setWeight] = useState(existingProduct?.weight || 50);
  const [status, setStatus] = useState(existingProduct?.status || 'inactive');

  // ── Process Types ──
  const defaultProcessTypes: ProductProcessType[] =
    existingProduct?.processTypes.map((processType) => ({
      ...processType,
      description: processType.description || getDefaultProcessTypeDescription(processType.estimatedDays),
    })) ||
    getDefaultProcessTypeTemplatesForProduct(existingProduct?.title).map((template, i) => {
      const basePrice = template.defaultPrice ?? 0;
      return {
        typeId: `PT-new-${i}`,
        name: template.name,
        description: template.description || getDefaultProcessTypeDescription(template.estimatedDays),
        weight: template.weight,
        estimatedDays: template.estimatedDays,
        pricing: AGENT_LEVELS.map((agentLevel, index) => ({
          agentLevel,
          price: Math.max(basePrice - index * 20, 0),
        })),
      };
    });
  const [processTypes, setProcessTypes] = useState<ProductProcessType[]>(defaultProcessTypes);

  // ── Toast ──
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const updatePricing = (ptIndex: number, agentLevel: AgentLevel, price: number) => {
    setProcessTypes(prev => {
      const next = [...prev];
      const pt = { ...next[ptIndex] };
      pt.pricing = pt.pricing.map(p =>
        p.agentLevel === agentLevel ? { ...p, price } : p
      );
      next[ptIndex] = pt;
      return next;
    });
  };

  const updateEstimatedDays = (ptIndex: number, days: number) => {
    setProcessTypes(prev => {
      const next = [...prev];
      next[ptIndex] = { ...next[ptIndex], estimatedDays: days };
      return next;
    });
  };

  const handleSave = () => {
    // BR-P-02: Validate required fields
    if (!title.trim() || !category || weight <= 0) {
      showToast('error', t('product.toast.incompleteFields'));
      return;
    }
    const hasPricing = processTypes.some(pt => pt.pricing.some(p => p.price > 0));
    if (!hasPricing) {
      showToast('error', t('product.toast.incompleteFields'));
      return;
    }

    const productData = {
      productId: isEdit ? id! : getNextProductId(),
      title,
      category,
      description,
      weight,
      status: status as 'active' | 'inactive',
      processTypes,
      createdAt: existingProduct?.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    if (isEdit) {
      updateProduct(id!, productData);
    } else {
      addProduct(productData);
    }

    showToast('success', t('product.toast.saveSuccess'));
    setTimeout(() => navigate('/products'), 1200);
  };

  const handleCancel = () => navigate('/products');

  // ── Build Sections for FormPageShell ──
  const sections: FormSection[] = [
    {
      id: 'section-basic',
      labelKey: 'product.section.basic',
      content: (
        <div className="fe-form-grid-2">
          <div className="form-group">
            <label className="form-label form-label--required">{t('product.field.name')}</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="NZTA新西兰认证" />
          </div>
          <div className="form-group">
            <label className="form-label form-label--required">{t('product.field.category')}</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value as ProductCategory)}>
              <option value="translation">{t('product.category.translation')}</option>
              <option value="notary">{t('product.category.notary')}</option>
              <option value="idp">{t('product.category.idp')}</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">{t('product.field.description')}</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
      ),
    },
    {
      id: 'section-process',
      labelKey: 'product.section.processType',
      content: (
        <div>
          <table className="data-table" style={{ marginBottom: '0' }}>
            <thead>
              <tr>
                <th>{t('product.field.name')}</th>
                <th>预计天数</th>
              </tr>
            </thead>
            <tbody>
              {processTypes.map((pt, i) => (
                <tr key={pt.typeId}>
                  <td style={{ fontWeight: 500 }}>{getProductProcessTypeLabel(pt.name, t)}</td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={pt.estimatedDays}
                      onChange={e => updateEstimatedDays(i, parseInt(e.target.value) || 1)}
                      style={{ width: '80px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'section-pricing',
      labelKey: 'product.section.pricing',
      content: (
        <div style={{ overflowX: 'auto' }}>
          <table className="price-matrix">
            <thead>
              <tr>
                <th></th>
                {AGENT_LEVELS.map(al => (
                  <th key={al}>{t(`product.agentLevel.${al}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processTypes.map((pt, ptIdx) => (
                <tr key={pt.typeId}>
                  <td style={{ fontWeight: 600, textAlign: 'left', background: 'var(--color-bg-body)' }}>
                    {getProductProcessTypeLabel(pt.name, t)}
                  </td>
                  {AGENT_LEVELS.map(al => {
                    const tier = pt.pricing.find(p => p.agentLevel === al);
                    return (
                      <td key={al}>
                        <input
                          type="number"
                          min={0}
                          value={tier?.price || 0}
                          onChange={e => updatePricing(ptIdx, al, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
            💡 代理下单时，系统自动匹配其等级对应的结算价格。价格变更后新订单适用新价，已有订单锁定下单时价格。
          </div>
        </div>
      ),
    },
    {
      id: 'section-status',
      labelKey: 'product.section.status',
      content: (
        <div className="fe-form-grid-2">
          <div className="form-group">
            <label className="form-label form-label--required">{t('product.field.weight')}</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={weight}
              onChange={e => setWeight(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('product.field.status')}</label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '36px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" name="status" value="active" checked={status === 'active'} onChange={() => setStatus('active')} />
                <span className="tag tag--active">{t('product.status.active')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" name="status" value="inactive" checked={status === 'inactive'} onChange={() => setStatus('inactive')} />
                <span className="tag tag--inactive">{t('product.status.inactive')}</span>
              </label>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}
      <FormPageShell
        titleKey={isEdit ? 'product.form.titleEdit' : 'product.form.titleAdd'}
        sections={sections}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
};

export default ProductForm;
