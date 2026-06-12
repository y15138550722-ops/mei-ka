import React from 'react';
import './ChineseTranslationOrders.css';

interface CtripStandardPlaceholderPageProps {
  title: string;
}

const CtripStandardPlaceholderPage: React.FC<CtripStandardPlaceholderPageProps> = ({ title }) => {
  return (
    <div className="license-translation-page animate-fadeIn">
      <header className="license-translation-topbar">
        <div>
          <div className="license-translation-breadcrumb">
            驾照官后台
            <span>/</span>
            携程标准件
            <span>/</span>
            {title}
          </div>
          <h1>{title}</h1>
        </div>
      </header>

      <section className="license-translation-card">
        <div className="license-translation-table-wrap">
          <table className="license-translation-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>订单号</th>
                <th>订单类型</th>
                <th>发起时间</th>
                <th>订单信息</th>
                <th>收货信息</th>
                <th>订单状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="license-translation-empty">
                  {title}页面已创建，后续可继续补充业务内容。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default CtripStandardPlaceholderPage;
