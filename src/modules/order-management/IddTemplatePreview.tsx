import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getOrderById } from '../../services/mockDataService';
import { IDD_TEMPLATE_ITEMS, getIddTemplatePreviewUrl, type IddTemplateId } from './iddTemplatePreviewUtils';
import './IddTemplatePreview.css';

type TemplatePreviewNavigationState = {
  from?: string;
  listLabel?: string;
};

const DEFAULT_TEMPLATE_ID: IddTemplateId = IDD_TEMPLATE_ITEMS[0].id;

const IddTemplatePreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as TemplatePreviewNavigationState | null;
  const order = useMemo(() => getOrderById(id || ''), [id]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<IddTemplateId>(DEFAULT_TEMPLATE_ID);

  const sourceListPath = navigationState?.from || '/order-management/idp-orders';
  const sourceListLabel = navigationState?.listLabel || 'IDP订单管理';

  const selectedTemplate = useMemo(
    () => IDD_TEMPLATE_ITEMS.find((item) => item.id === selectedTemplateId) || IDD_TEMPLATE_ITEMS[0],
    [selectedTemplateId],
  );

  const previewUrl = useMemo(() => getIddTemplatePreviewUrl(selectedTemplateId), [selectedTemplateId]);

  if (!order) {
    return (
      <div className="app-main animate-fadeIn">
        <div className="card idd-preview-empty">
          <div className="empty-state">
            <div className="empty-state__icon">404</div>
            <div className="empty-state__text">未找到对应订单，请返回 IDP 订单列表后重新选择。</div>
            <button className="btn btn--primary" type="button" onClick={() => navigate(sourceListPath)}>
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <header className="app-topbar idd-preview-topbar">
        <div className="idd-preview-topbar__left">
          <button
            className="btn idd-preview-topbar__action-btn idd-preview-topbar__action-btn--return"
            type="button"
            onClick={() => navigate(sourceListPath)}
          >
            返回列表
          </button>
          <div className="idd-preview-topbar__title">
            <div className="app-topbar__breadcrumb">
              {sourceListLabel}
              <span>/</span>
              <span>IDD模板预览</span>
            </div>
            <h1 className="app-topbar__title">IDD模板预览</h1>
          </div>
        </div>
      </header>

      <div className="app-main idd-preview-page">
        <div className="idd-preview-layout">
          <section className="card idd-preview-browser">
            <div className="idd-preview-browser__body">
              <aside className="idd-preview-nav">
                <div className="idd-preview-nav__section">
                  <div className="idd-preview-nav__header">
                    <h3>模板列表</h3>
                    <span>{IDD_TEMPLATE_ITEMS.length} 个</span>
                  </div>
                  <div className="idd-preview-template-list">
                    {IDD_TEMPLATE_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className={`idd-preview-template-card ${
                          selectedTemplateId === item.id ? 'idd-preview-template-card--active' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="idd-preview-template-card__select"
                          onClick={() => setSelectedTemplateId(item.id)}
                        >
                          <span className="idd-preview-template-card__badge">IDD</span>
                          <strong>{item.title}</strong>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="idd-preview-viewer-panel">
                <div className="idd-preview-viewer-panel__meta">
                  <div className="idd-preview-file-meta">
                    <span className="idd-preview-file-chip">预览模式</span>
                    <span className="idd-preview-file-chip idd-preview-file-chip--accent">PDF模板展示</span>
                  </div>
                  <a
                    className="idd-preview-viewer-panel__download"
                    href={selectedTemplate.previewUrl}
                    download={selectedTemplate.fileName}
                  >
                    下载此模版
                  </a>
                </div>

                <div className="idd-preview-viewer">
                  <iframe
                    title={`${selectedTemplate.title}预览`}
                    className="idd-preview-viewer__frame"
                    src={previewUrl}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default IddTemplatePreview;
