import React from 'react';
import avisLogo from '../../assets/brand-logos/avis.png';
import ctripLogo from '../../assets/brand-logos/ctrip.png';
import ehiLogo from '../../assets/brand-logos/ehi.png';
import europcarLogo from '../../assets/brand-logos/europcar.svg';
import wukongLogo from '../../assets/brand-logos/wukong.png';
import { ORDER_DATA_CHANGED_EVENT } from '../../services/mockDataService';
import { useTranslation } from '../../shared/i18n/config';
import {
  readProductionLineStatistics,
  type ProductionLineStatistic,
  type ProductionStatisticsFilter,
} from './productionOrderStatistics';
import './ProductionPortalPages.css';

interface PartnerBrand {
  name: string;
  logoSrc?: string;
  logoAlt: string;
  textFallback?: string;
}

const partnerBrands: PartnerBrand[] = [
  { name: '携程旅行', logoSrc: ctripLogo, logoAlt: '携程旅行 LOGO' },
  { name: 'Enterprise', logoAlt: 'Enterprise LOGO', textFallback: 'enterprise' },
  { name: 'AVIS', logoSrc: avisLogo, logoAlt: 'AVIS LOGO' },
  { name: '悟空租车', logoSrc: wukongLogo, logoAlt: '悟空租车 LOGO' },
  { name: 'SIXT', logoAlt: 'SIXT LOGO', textFallback: 'SIXT' },
  { name: 'Europcar', logoSrc: europcarLogo, logoAlt: 'Europcar LOGO' },
  { name: '一嗨 eHi', logoSrc: ehiLogo, logoAlt: '一嗨 eHi LOGO' },
];

const resultSummary = [
  ['创建时间', '2026-03-14 14:14:34'],
  ['渠道商订单号', '1128145885471314'],
  ['驾照官订单号', '260314141434732'],
];

const resultDetailColumns = [
  [
    ['驾照号', '340403197105152635'],
    ['姓名', 'RUI JUN'],
    ['中文姓名', '芮军'],
    ['发证地区', '广东省广州市'],
    ['发证机构', '公安局交通警察支队'],
    ['性别', '男'],
    ['国籍', 'China'],
    ['现住址', '安徽省淮南市田家庵区及斫阳和晟坟东4组8栋10室'],
    ['出生日期', '1971-05-15'],
    ['准驾车型', 'C1'],
    ['初次领证日期', '2009-10-27'],
    ['有效起始日期', '2025-10-27'],
    ['有效年限', '长期'],
  ],
  [
    ['收件人', '芮军'],
    ['收货地址', '广东广州番禺区针村祈福活力二期1栋2507'],
    ['手机号', '18922756099'],
    ['邮箱', '344786842@qq.com'],
    ['离境日期', '1970-01-01'],
    ['加急', '是'],
    ['订单数量', '1'],
    ['快递单号', 'JDVB58394184473'],
    ['快递名称', 'JD'],
    ['发货时间', '2026-03-14 15:38:00'],
    ['来源渠道', '携程'],
  ],
];

const editFormFields = [
  { label: '驾照号', value: '340403197105152635' },
  { label: '姓', value: 'RUI' },
  { label: '名', value: 'JUN' },
  { label: '性别', value: '男', type: 'select', options: ['男', '女'] },
  { label: '住址', value: '安徽省淮南市田家庵区及斫阳和晟坟东4组8栋10室', wide: true },
  { label: '出生日期', value: '1971-05-15', type: 'date' },
  { label: '准驾车型', value: 'C1' },
  { label: '初次领证日期', value: '2009-10-27', type: 'date' },
  { label: '有效起始日期', value: '2025-10-27', type: 'date' },
  { label: '有效年限', value: '长期', type: 'select', options: ['6年', '10年', '长期'] },
  { label: '收件人', value: '芮军' },
  { label: '收货地址省', value: '广东省' },
  { label: '收货地址市', value: '广州市' },
  { label: '收货地址区', value: '番禺区' },
  { label: '收货地址详细', value: '针村祈福活力二期1栋2507', wide: true },
  { label: '手机号', value: '18922756099' },
  { label: '发证地区', value: '广东省广州市' },
  { label: '发证机构', value: '公安局交通警察支队', wide: true },
];

const SearchIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m21 20.3-5.7-5.7a7.4 7.4 0 1 0-1.3 1.3l5.7 5.7ZM4.9 10.3a5.4 5.4 0 1 1 10.8 0 5.4 5.4 0 0 1-10.8 0Z" fill="currentColor" />
  </svg>
);

const ChartIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 19V5h2v14Zm4 0v-7h2v7Zm4 0V8h2v11Zm4 0v-5h2v5Zm4 1H3v-2h17Z" fill="currentColor" />
  </svg>
);

const FilterIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5h16l-6.2 7.2V18l-3.6 1.8v-7.6Z" fill="currentColor" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3Z" fill="currentColor" />
  </svg>
);

const CalendarIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 2h2v3h6V2h2v3h3v17H4V5h3Zm11 8H6v10h12Z" fill="currentColor" />
  </svg>
);

const InfoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2Zm0-8h-2V7h2Z" fill="currentColor" />
  </svg>
);

const ListIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h3v3H4Zm5 0h11v2H9Zm0 5h11v2H9Zm0 5h11v2H9ZM4 11h3v3H4Zm0 5h3v3H4Z" fill="currentColor" />
  </svg>
);

const EditIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m4 16.9 9.9-9.9 3.1 3.1-9.9 9.9L4 20Zm13.7-8.4-3.1-3.1 1.8-1.8a1 1 0 0 1 1.4 0l1.7 1.7a1 1 0 0 1 0 1.4Z" fill="currentColor" />
  </svg>
);

const InputIcon: React.FC<{ type: 'search' | 'order' | 'card' | 'license' }> = ({ type }) => {
  if (type === 'search') {
    return <SearchIcon />;
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {type === 'order' && <path d="M6 2h9l3 3v17H6Zm8 1.8V6h2.2ZM8 10h8V8H8Zm0 4h8v-2H8Zm0 4h6v-2H8Z" fill="currentColor" />}
      {type === 'card' && <path d="M3 5h18v14H3Zm2 4h14V7H5Zm2 6h5v-2H7Zm7 0h3v-2h-3Z" fill="currentColor" />}
      {type === 'license' && <path d="M4 5h16v14H4Zm2 3v8h12V8Zm2 2h3v4H8Zm5 .5h4V9h-4Zm0 3h4V12h-4Zm-5 3h9V15H8Z" fill="currentColor" />}
    </svg>
  );
};

export const ProductionLoginPreviewPage: React.FC = () => (
  <div className="production-page production-login-preview animate-fadeIn">
    <section className="production-login-preview__canvas">
      <div className="production-login-preview__brand">
        <span>驾</span>
        <div>
          <strong>驾照官生产后台</strong>
          <em>Production Management System</em>
        </div>
      </div>

      <div className="production-login-preview__panel">
        <div className="production-login-preview__visual" aria-hidden="true">
          <div className="production-login-preview__visual-frame">
            <div className="production-login-preview__gallery">
              <div className="production-login-preview__gallery-card production-login-preview__gallery-card--doc1">
                <img src="/ETC/jiazhaoguan/img_v3_0212j_4b44202f-0a47-4027-a4db-3df62876a3fg.jpg" alt="驾照翻译件" className="production-login-preview__gallery-image" />
              </div>
              <div className="production-login-preview__gallery-card production-login-preview__gallery-card--doc2">
                <img src="/ETC/jiazhaoguan/img_v3_0212j_2a0fa705-c6bf-45a4-9468-f2e72d7c19bg.jpg" alt="国际驾照封面" className="production-login-preview__gallery-image" />
              </div>
              <div className="production-login-preview__gallery-card production-login-preview__gallery-card--doc3">
                <img src="/ETC/jiazhaoguan/img_v3_0212j_29e2903e-d928-460c-bc75-0ccbc409c46g.jpg" alt="国际证件翻译页" className="production-login-preview__gallery-image" />
              </div>
              <div className="production-login-preview__gallery-card production-login-preview__gallery-card--doc4">
                <img src="/ETC/jiazhaoguan/img_v3_0212j_8191a3b4-eb31-4ab9-9a3a-f82d1bb2562g.png" alt="公证书封面" className="production-login-preview__gallery-image" />
              </div>
            </div>
          </div>
        </div>

        <form className="production-login-card">
          <h2>账号登录</h2>
          <label>
            <span>账号</span>
            <input value="production_admin" readOnly />
          </label>
          <label>
            <span>密码</span>
            <input value="••••••••" readOnly />
          </label>
          <button type="button" className="production-login-card__submit">登录后台</button>
        </form>
      </div>
    </section>
  </div>
);

export const ProductionHomePage: React.FC = () => (
  <div className="production-page production-home animate-fadeIn">
    <section className="production-brand-logo-grid" aria-label="合作品牌 LOGO">
      {partnerBrands.map((brand) => (
        <article key={brand.name} className="production-brand-logo-card">
          {brand.logoSrc ? (
            <img src={brand.logoSrc} alt={brand.logoAlt} className="production-brand-logo-card__image" />
          ) : (
            <span className="production-brand-logo-card__fallback">{brand.textFallback}</span>
          )}
        </article>
      ))}
    </section>
  </div>
);

export const ProductionQueryPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(locale);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [statisticsFilter, setStatisticsFilter] = React.useState<ProductionStatisticsFilter>({});
  const [productionLineStatistics, setProductionLineStatistics] = React.useState(readProductionLineStatistics);
  const [activeStatistic, setActiveStatistic] = React.useState<ProductionLineStatistic | null>(null);
  const refreshStatistics = React.useCallback(
    () => setProductionLineStatistics(readProductionLineStatistics(statisticsFilter)),
    [statisticsFilter],
  );

  const updateStatisticsDate = (field: keyof ProductionStatisticsFilter, value: string) => {
    setStatisticsFilter((currentFilter) => {
      const nextFilter = { ...currentFilter, [field]: value };
      if (nextFilter.startDate && nextFilter.endDate && nextFilter.startDate > nextFilter.endDate) {
        return field === 'startDate'
          ? { ...nextFilter, endDate: value }
          : { ...nextFilter, startDate: value };
      }
      return nextFilter;
    });
  };

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'meika-orders' || event.key === null) refreshStatistics();
    };
    refreshStatistics();
    window.addEventListener(ORDER_DATA_CHANGED_EVENT, refreshStatistics);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshStatistics);
    const timer = window.setInterval(refreshStatistics, 60_000);

    return () => {
      window.removeEventListener(ORDER_DATA_CHANGED_EVENT, refreshStatistics);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refreshStatistics);
      window.clearInterval(timer);
    };
  }, [refreshStatistics]);

  return (
    <div className="production-query-page animate-fadeIn">
    <header className="production-query-topbar">
      <div className="production-query-topbar__brand">
        <SearchIcon />
        <strong>订单查询系统</strong>
      </div>
      <div className="production-query-topbar__actions">
        <button type="button" className="production-query-button production-query-button--plain" onClick={refreshStatistics}>
          <RefreshIcon />
          刷新
        </button>
        <button type="button" className="production-query-button production-query-button--primary">管理员</button>
      </div>
    </header>

    <main className="production-query-main">
      <section className="production-query-card">
        <div className="production-query-card__header">
          <h2>
            <ChartIcon />
            {t('production.statistics.title')}
          </h2>
          <div className="production-query-stat-filter" role="group" aria-label={t('production.statistics.period')}>
            <span className="production-query-stat-filter__label">{t('production.statistics.period')}</span>
            <label className="production-query-stat-filter__date">
              <CalendarIcon />
              <input
                type="date"
                value={statisticsFilter.startDate || ''}
                max={statisticsFilter.endDate || undefined}
                aria-label={t('production.statistics.startDate')}
                onChange={(event) => updateStatisticsDate('startDate', event.target.value)}
              />
            </label>
            <span className="production-query-stat-filter__separator">{t('production.statistics.to')}</span>
            <label className="production-query-stat-filter__date">
              <CalendarIcon />
              <input
                type="date"
                value={statisticsFilter.endDate || ''}
                min={statisticsFilter.startDate || undefined}
                aria-label={t('production.statistics.endDate')}
                onChange={(event) => updateStatisticsDate('endDate', event.target.value)}
              />
            </label>
            <button
              type="button"
              className="production-query-button production-query-button--plain production-query-button--compact"
              onClick={() => setStatisticsFilter({})}
            >
              {t('common.reset')}
            </button>
          </div>
        </div>
        <div className="production-query-table-wrap">
          <table className="production-query-table">
            <thead>
              <tr>
                <th scope="col">{t('production.statistics.line')}</th>
                <th scope="col">{t('production.statistics.newOrders')}</th>
                <th scope="col">{t('production.statistics.pending')}</th>
              </tr>
            </thead>
            <tbody>
              {productionLineStatistics.map((row, rowIndex) => (
                <tr key={row.key}>
                  <th scope="row" className="production-query-line-name">{t(row.labelKey)}</th>
                  <td><span className="production-query-stat production-query-stat--new">{numberFormatter.format(row.newOrders)}</span></td>
                  <td>
                    <div
                      className={`production-query-stat-detail-trigger${rowIndex >= 3 ? ' production-query-stat-detail-trigger--above' : ''}`}
                      onMouseEnter={() => setActiveStatistic(row)}
                      onMouseLeave={() => setActiveStatistic(null)}
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setActiveStatistic(null);
                      }}
                    >
                      <div className="production-query-stat-detail-actions">
                        <span className="production-query-stat production-query-stat--pending">{numberFormatter.format(row.pendingProduction)}</span>
                        <button
                          type="button"
                          className="production-query-stat-detail-button"
                          onClick={() => setActiveStatistic(row)}
                          aria-expanded={activeStatistic?.key === row.key}
                        >
                          <InfoIcon />
                          {t('production.statistics.viewDetails')}
                        </button>
                      </div>
                      {activeStatistic?.key === row.key && (
                        <div className="production-query-stat-detail-popover" role="tooltip">
                          <strong className="production-query-stat-detail-popover__title">
                            {t(row.labelKey)} {t('production.statistics.detailTitle')}
                          </strong>
                          <table className="production-query-stat-detail-table">
                            <thead>
                              <tr>
                                <th>{t('order.field.status')}</th>
                                <th>{t('production.statistics.orderCount')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.pendingStatusCounts.map((status) => (
                                <tr key={status.key}>
                                  <th scope="row">{t(status.labelKey)}</th>
                                  <td>{numberFormatter.format(status.count)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="production-query-card production-query-card--search">
        <h2>
          <FilterIcon />
          搜索条件
        </h2>
        <div className="production-query-form">
          <label className="production-query-input">
            <InputIcon type="search" />
            <input placeholder="请输入姓名 姓名拼音等" />
          </label>
          <label className="production-query-input">
            <InputIcon type="order" />
            <input placeholder="请输入mk订单号、客户订单号、驾照官订单号等" />
          </label>
          <label className="production-query-input">
            <InputIcon type="card" />
            <input placeholder="请输入快递单号 手机号" />
          </label>
          <label className="production-query-input">
            <InputIcon type="license" />
            <input placeholder="请输入驾照号" />
          </label>
        </div>
        <div className="production-query-actions">
          <button type="button" className="production-query-button production-query-button--primary">
            <CalendarIcon />
            最近查询(近3个月数据)
          </button>
          <button type="button" className="production-query-button production-query-button--primary">
            <SearchIcon />
            查询
          </button>
          <button type="button" className="production-query-button production-query-button--plain">
            <InfoIcon />
            详情
          </button>
        </div>
      </section>

      <section className="production-query-card production-query-card--result">
        <h2>
          <ListIcon />
          搜索结果
        </h2>
        <article className="production-query-result-panel">
          <header className="production-query-result-panel__summary">
            <div className="production-query-result-panel__summary-content">
              <h3>驾照翻译国际认证件-携程</h3>
              <div className="production-query-result-panel__summary-grid">
                {resultSummary.map((item) => (
                  <div key={item[0]} className="production-query-result-panel__item">
                    <span>{item[0]}：</span>
                    <strong>{item[1]}</strong>
                  </div>
                ))}
              </div>
            </div>
            <span className="production-query-result-panel__status">已发货</span>
          </header>

          <div className="production-query-result-panel__details">
            <div className="production-query-result-panel__grid">
              {resultDetailColumns.map((column, columnIndex) => (
                <div key={`column-${columnIndex}`} className="production-query-result-panel__column">
                  {column.map((item, itemIndex) => (
                    <div key={`${item[0]}-${itemIndex}`} className="production-query-result-panel__item">
                      <span>{item[0]}：</span>
                      <strong>{item[1]}</strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="production-query-result-panel__footer">
              <button
                type="button"
                className="production-query-button production-query-button--primary production-query-button--compact"
                onClick={() => setIsEditOpen(true)}
              >
                <EditIcon />
                修改
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>

    <footer className="production-query-footer">© 2025 驾照翻译管理系统 | 技术支持：系统部</footer>

      {isEditOpen && (
        <div className="production-query-modal" role="presentation" onMouseDown={() => setIsEditOpen(false)}>
          <section
            className="production-query-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="production-query-edit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="production-query-modal__header">
              <div>
                <h2 id="production-query-edit-title">修改订单信息</h2>
                <p>驾照翻译国际认证件-携程</p>
              </div>
              <button type="button" className="production-query-modal__close" aria-label="关闭" onClick={() => setIsEditOpen(false)}>
                ×
              </button>
            </header>

            <form
              className="production-query-modal__form"
              onSubmit={(event) => {
                event.preventDefault();
                setIsEditOpen(false);
              }}
            >
              <div className="production-query-modal__body">
                {editFormFields.map((field) => (
                  <label
                    key={field.label}
                    className={`production-query-modal__field${field.wide ? ' production-query-modal__field--wide' : ''}`}
                  >
                    <span>{field.label}</span>
                    {field.type === 'select' ? (
                      <select defaultValue={field.value}>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input type={field.type ?? 'text'} defaultValue={field.value} />
                    )}
                  </label>
                ))}
              </div>

              <footer className="production-query-modal__footer">
                <button type="button" className="production-query-button production-query-button--plain" onClick={() => setIsEditOpen(false)}>
                  取消
                </button>
                <button type="submit" className="production-query-button production-query-button--primary">
                  保存修改
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
