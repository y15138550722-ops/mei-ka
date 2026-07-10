import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addExternalNotaryOrder, type ExternalNotaryOrderAttachment } from '../../services/externalNotaryOrderService';
import { getProducts } from '../../services/mockDataService';
import { saveLocalImageSource } from '../../shared/utils/localImageStore';
import './ExternalNotaryOrderCreate.css';

type UploadFieldKey =
  | 'licenseFrontFile'
  | 'licenseBackFile'
  | 'licenseExtraFrontFile'
  | 'licenseExtraBackFile'
  | 'identityFrontFile'
  | 'identityBackFile'
  | 'digitalLicenseFile'
  | 'passportFile';

type UploadPreview = {
  name: string;
  src: string;
};

type NotaryServiceOption = {
  label: string;
  value: string;
};

const COUNTRY_CODES = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT','BO','BA','BW','BR',
  'BN','BG','BF','BI','CV','KH','CM','CA','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ','DK','DJ',
  'DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY',
  'HT','HN','HU','IS','IN','ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KW','KG','LA','LV','LB','LS','LR',
  'LY','LI','LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR',
  'NP','NL','NZ','NI','NE','NG','KP','MK','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL','PT','QA','RO','RU','RW','KN',
  'LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','KR','SS','ES','LK','SD','SR','SE','CH',
  'SY','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE',
  'ZM','ZW','PS'
] as const;

const getCountryOptions = () => {
  const displayNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['zh-Hans'], { type: 'region' }) : null;
  return COUNTRY_CODES.map((code) => ({
    code,
    name: displayNames?.of(code) || code,
  })).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
};

const UPLOAD_FIELDS: Array<{ key: UploadFieldKey; title: string; hint: string; required?: boolean }> = [
  { key: 'licenseFrontFile', title: '驾驶证正面图片', hint: '点击上传图片', required: true },
  { key: 'licenseBackFile', title: '驾驶证反面图片', hint: '点击上传图片', required: true },
  { key: 'licenseExtraFrontFile', title: '驾驶证副页正面图片', hint: '点击上传图片', required: true },
  { key: 'licenseExtraBackFile', title: '驾驶证副页反面图片', hint: '点击上传图片', required: true },
  { key: 'identityFrontFile', title: '身份证正面', hint: '点击上传图片', required: true },
  { key: 'identityBackFile', title: '身份证反面', hint: '点击上传图片', required: true },
  { key: 'digitalLicenseFile', title: '电子驾照', hint: '点击上传图片', required: true },
  { key: 'passportFile', title: '护照/港澳台通行证', hint: '点击上传图片' },
];

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const ExternalNotaryOrderCreate: React.FC = () => {
  const navigate = useNavigate();
  const notaryProducts = useMemo(
    () =>
      getProducts()
        .filter((product) => product.category === 'notary' && product.status === 'active')
        .sort((left, right) => right.weight - left.weight),
    [],
  );
  const productOptions = useMemo(
    () => (notaryProducts.length > 0 ? notaryProducts.map((product) => product.title) : ['公证双号', '公证单号', '公证海牙双号', '公证海牙单号']),
    [notaryProducts],
  );
  const serviceOptions = useMemo<NotaryServiceOption[]>(
    () => [
      { label: '加急1工出', value: '加急1工出' },
      { label: '加急3工出', value: '加急3工出' },
    ],
    [],
  );
  const countryOptions = useMemo(() => getCountryOptions(), []);

  const [form, setForm] = useState({
    productName: '',
    serviceName: '',
    useCountry: '',
    language: '',
    licenseNo: '',
    fullName: '',
    surnamePinyin: '',
    givenNamePinyin: '',
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    remark: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploads, setUploads] = useState<Partial<Record<UploadFieldKey, UploadPreview>>>({});

  const handleFieldChange = (field: keyof typeof form, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleUploadChange = async (field: UploadFieldKey, file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('请上传图片格式的附件');
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      setError('');
      setUploads((currentUploads) => ({
        ...currentUploads,
        [field]: {
          name: file.name,
          src,
        },
      }));
    } catch {
      setError('附件处理失败，请重新上传');
    }
  };

  const handleUploadRemove = (field: UploadFieldKey) => {
    setUploads((currentUploads) => ({
      ...currentUploads,
      [field]: undefined,
    }));
  };

  const handleSubmit = async () => {
    const missingRequiredUpload = UPLOAD_FIELDS.find((item) => item.required && !uploads[item.key]?.src);

    if (
      !form.productName.trim() ||
      !form.serviceName.trim() ||
      !form.useCountry.trim() ||
      !form.language.trim() ||
      !form.licenseNo.trim() ||
      !form.fullName.trim() ||
      !form.surnamePinyin.trim() ||
      !form.givenNamePinyin.trim() ||
      !form.recipientName.trim() ||
      !form.recipientPhone.trim() ||
      !form.deliveryAddress.trim()
    ) {
      setError('请完整填写产品信息、驾照信息和收货信息');
      return;
    }

    if (missingRequiredUpload) {
      setError(`请上传${missingRequiredUpload.title}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadTimestamp = Date.now();
      const attachments = await Promise.all(
        UPLOAD_FIELDS.reduce<Array<Promise<ExternalNotaryOrderAttachment>>>((result, item) => {
          const preview = uploads[item.key];
          if (!preview) {
            return result;
          }

          result.push(
            saveLocalImageSource(`external-notary-${uploadTimestamp}-${item.key}`, preview.src).then((storedSource) => ({
              key: item.key,
              title: item.title,
              name: preview.name,
              src: storedSource,
            })),
          );
          return result;
        }, []),
      );

      addExternalNotaryOrder({
        productName: form.productName.trim(),
        serviceName: form.serviceName.trim(),
        useCountry: form.useCountry.trim(),
        language: form.language.trim(),
        customerName: form.fullName.trim(),
        agentName: '手工录单',
        licenseName: form.fullName.trim(),
        licenseNo: form.licenseNo.trim(),
        surnamePinyin: form.surnamePinyin.trim(),
        givenNamePinyin: form.givenNamePinyin.trim(),
        remark: form.remark.trim(),
        recipientName: form.recipientName.trim(),
        recipientPhone: form.recipientPhone.trim(),
        deliveryAddress: form.deliveryAddress.trim(),
        attachments,
      });

      navigate('/order-management/external-notary-orders');
    } catch {
      setError('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-main animate-fadeIn order-list-page">
      <div className="app-topbar">
        <div className="order-list-topbar">
          <div className="app-topbar__breadcrumb">
            后台管理
            <span>/</span>
            外采公证订单管理
            <span>/</span>
            录单
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="card order-list-card external-notary-create-page">
          <div className="order-list-card__toolbar external-notary-create-page__toolbar">
            <button className="btn btn--primary" type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '提交订单'}
            </button>
            <button className="btn btn--secondary" type="button" onClick={() => navigate('/order-management/external-notary-orders')} disabled={isSubmitting}>
              取消
            </button>
          </div>

          {error && <div className="toast toast--error external-notary-create-page__error">{error}</div>}

          <div className="external-notary-create-layout">
            <div className="external-notary-create-column">
              <section className="external-notary-create-panel external-notary-create-panel--product">
                <div className="external-notary-create-panel__header">
                  <h3>产品信息</h3>
                </div>

                <div className="external-notary-form-grid">
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>产品类型</label>
                    <select
                      className={`form-select ${!form.productName ? 'external-notary-create-select--placeholder' : ''}`}
                      value={form.productName}
                      onChange={(event) => handleFieldChange('productName', event.target.value)}
                    >
                      <option value="">请选择产品类型</option>
                      {productOptions.map((product) => (
                        <option key={product} value={product}>
                          {product}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>服务选择</label>
                    <select
                      className={`form-select ${!form.serviceName ? 'external-notary-create-select--placeholder' : ''}`}
                      value={form.serviceName}
                      onChange={(event) => handleFieldChange('serviceName', event.target.value)}
                    >
                      <option value="">请选择加急服务</option>
                      {serviceOptions.map((service) => (
                        <option key={service.value} value={service.value}>
                          {service.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>语言</label>
                    <input
                      className="form-input"
                      value={form.language}
                      placeholder="请输入语言"
                      onChange={(event) => handleFieldChange('language', event.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>使用国家</label>
                    <select
                      className={`form-select ${!form.useCountry ? 'external-notary-create-select--placeholder' : ''}`}
                      value={form.useCountry}
                      onChange={(event) => handleFieldChange('useCountry', event.target.value)}
                    >
                      <option value="">请选择使用国家</option>
                      {countryOptions.map((country) => (
                        <option key={country.code} value={country.name}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="external-notary-create-panel external-notary-create-panel--grow">
                <div className="external-notary-create-panel__header">
                  <h3>收货信息</h3>
                </div>

                <div className="external-notary-form-grid">
                  <div className="form-group external-notary-form-grid__full">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>收货地址</label>
                    <textarea className="form-input external-notary-create-textarea--medium" rows={3} value={form.deliveryAddress} placeholder="请输入收货地址" onChange={(event) => handleFieldChange('deliveryAddress', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>电话号码</label>
                    <input className="form-input" value={form.recipientPhone} placeholder="请输入电话号码" onChange={(event) => handleFieldChange('recipientPhone', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>收件人姓名</label>
                    <input className="form-input" value={form.recipientName} placeholder="请输入收件人姓名" onChange={(event) => handleFieldChange('recipientName', event.target.value)} />
                  </div>
                </div>
              </section>

              <section className="external-notary-create-panel external-notary-create-panel--remark">
                <div className="external-notary-create-panel__header">
                  <h3>备注</h3>
                </div>

                <div className="form-group">
                  <textarea className="form-input external-notary-create-textarea--tall" rows={4} value={form.remark} placeholder="可输入备注信息" onChange={(event) => handleFieldChange('remark', event.target.value)} />
                </div>
              </section>
            </div>

            <div className="external-notary-create-column external-notary-create-column--side">
              <section className="external-notary-create-panel external-notary-create-panel--sticky">
                <div className="external-notary-create-panel__header">
                  <h3>驾照信息</h3>
                </div>

                <div className="external-notary-form-grid">
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>驾驶证号码</label>
                    <input className="form-input" value={form.licenseNo} placeholder="请输入驾驶证号码" onChange={(event) => handleFieldChange('licenseNo', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>姓名</label>
                    <input className="form-input" value={form.fullName} placeholder="请输入姓名" onChange={(event) => handleFieldChange('fullName', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>姓氏拼音</label>
                    <input className="form-input" value={form.surnamePinyin} placeholder="请输入姓氏拼音" onChange={(event) => handleFieldChange('surnamePinyin', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span className="external-notary-required-mark">*</span>名字拼音</label>
                    <input className="form-input" value={form.givenNamePinyin} placeholder="请输入名字拼音" onChange={(event) => handleFieldChange('givenNamePinyin', event.target.value)} />
                  </div>
                </div>

                <div className="external-notary-upload-board" aria-label="附件上传区域">
                  <div className="external-notary-upload-board__title">附件上传区域</div>
                  <div className="external-notary-upload-grid">
                    {UPLOAD_FIELDS.map((item) => {
                      const preview = uploads[item.key];
                      const uploadInputId = `external-notary-upload-${item.key}`;

                      return (
                        <div key={item.key} className={`external-notary-upload-card ${preview ? 'external-notary-upload-card--filled' : ''}`}>
                          {preview ? (
                            <>
                              <span className="external-notary-upload-card__preview">
                                <img src={preview.src} alt={`${item.title}预览`} />
                              </span>
                              <span className="external-notary-upload-card__label">
                                {item.required && <span className="external-notary-required-mark">*</span>}
                                {item.title}
                              </span>
                              <small>{preview.name}</small>
                              <div className="external-notary-upload-card__actions">
                                <label className="external-notary-upload-card__action" htmlFor={uploadInputId}>
                                  更换
                                </label>
                                <button type="button" className="external-notary-upload-card__action external-notary-upload-card__action--danger" onClick={() => handleUploadRemove(item.key)}>
                                  删除
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="external-notary-upload-card__empty" htmlFor={uploadInputId}>
                              <span className="external-notary-upload-card__icon">+</span>
                              <span className="external-notary-upload-card__label">
                                {item.required && <span className="external-notary-required-mark">*</span>}
                                {item.title}
                              </span>
                              <small>{item.hint}</small>
                            </label>
                          )}
                          <input
                            id={uploadInputId}
                            className="external-notary-upload-card__input"
                            type="file"
                            accept="image/*"
                            onChange={(event) => void handleUploadChange(item.key, event.target.files?.[0] ?? null)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExternalNotaryOrderCreate;
