import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AuthSession } from '../../shared/utils/auth';
import './LicenseOfficerLayout.css';

interface LicenseOfficerLayoutProps {
  children: React.ReactNode;
  currentUser: AuthSession;
  onLogout?: () => void;
}

const LicenseOfficerLayout: React.FC<LicenseOfficerLayoutProps> = ({ children, currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOrderMenuOpen, setIsOrderMenuOpen] = useState(true);
  const [isCtripMenuOpen, setIsCtripMenuOpen] = useState(false);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const isLoginPageActive = location.pathname.startsWith('/license-officer/pages/login');
  const isHomePageActive = location.pathname.startsWith('/license-officer/pages/home');
  const isChineseTranslationActive = location.pathname.startsWith('/license-officer/orders/chinese-translation');
  const isApiStandardTranslationActive = location.pathname.startsWith('/license-officer/ctrip-standard/api-standard-translation');
  const isExcelImportActive = location.pathname.startsWith('/license-officer/ctrip-standard/standard-translation-excel-import');
  const isVipStandardTranslationActive = location.pathname.startsWith('/license-officer/ctrip-standard/vip-standard-translation');
  const isReportListActive = location.pathname.startsWith('/license-officer/reports/list');
  const isUserListActive = location.pathname.startsWith('/license-officer/users/list');
  const isChannelQueryActive = location.pathname.startsWith('/license-officer/channel-standard/query');
  const isDeclarationTranslationActive = false;
  const isNotaryOrdersActive = false;

  React.useEffect(() => {
    setIsOrderMenuOpen(isChineseTranslationActive);
    setIsCtripMenuOpen(isApiStandardTranslationActive || isExcelImportActive || isVipStandardTranslationActive);
    setIsReportMenuOpen(isReportListActive);
    setIsUserMenuOpen(isUserListActive);
  }, [isApiStandardTranslationActive, isChineseTranslationActive, isExcelImportActive, isReportListActive, isUserListActive, isVipStandardTranslationActive]);

  const handleLogout = () => {
    if (typeof window !== 'undefined' && !window.confirm('确认退出登录吗？')) {
      return;
    }

    onLogout?.();
  };

  const closeExpandableMenus = () => {
    setIsOrderMenuOpen(false);
    setIsCtripMenuOpen(false);
    setIsReportMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const toggleMenu = (menu: 'order' | 'ctrip' | 'report' | 'user') => {
    const isTargetOpen =
      menu === 'order'
        ? isOrderMenuOpen
        : menu === 'ctrip'
          ? isCtripMenuOpen
          : menu === 'report'
            ? isReportMenuOpen
            : isUserMenuOpen;

    setIsOrderMenuOpen(menu === 'order' ? !isTargetOpen : false);
    setIsCtripMenuOpen(menu === 'ctrip' ? !isTargetOpen : false);
    setIsReportMenuOpen(menu === 'report' ? !isTargetOpen : false);
    setIsUserMenuOpen(menu === 'user' ? !isTargetOpen : false);
  };

  return (
    <div className={`license-officer-layout ${isSidebarCollapsed ? 'license-officer-layout--collapsed' : ''}`}>
      <aside className="license-officer-sidebar">
        <div className="license-officer-brand">
          <div className="license-officer-brand__logo">驾</div>
          <div>
            <strong>驾照官</strong>
            <span>后台管理系统</span>
          </div>
          <button
            type="button"
            className="license-officer-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {isSidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="license-officer-menu" aria-label="驾照官后台菜单">
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--standalone ${isLoginPageActive ? 'license-officer-menu__item--active' : ''}`}
            onClick={() => {
              closeExpandableMenus();
              navigate('/license-officer/pages/login');
            }}
          >
            登录页
          </button>
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--standalone ${isHomePageActive ? 'license-officer-menu__item--active' : ''}`}
            onClick={() => {
              closeExpandableMenus();
              navigate('/license-officer/pages/home');
            }}
          >
            首页
          </button>
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--standalone ${isChannelQueryActive ? 'license-officer-menu__item--active' : ''}`}
            onClick={() => {
              closeExpandableMenus();
              navigate('/license-officer/channel-standard/query');
            }}
          >
            查询页
          </button>
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--parent ${isOrderMenuOpen ? 'license-officer-menu__item--open' : ''}`}
            onClick={() => toggleMenu('order')}
            aria-expanded={isOrderMenuOpen}
          >
            <span>非标宣誓公证件</span>
            <span aria-hidden="true">›</span>
          </button>

          {isOrderMenuOpen && (
            <div className="license-officer-submenu">
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isChineseTranslationActive ? 'license-officer-menu__item--active' : ''}`}
                onClick={() => navigate('/license-officer/orders/chinese-translation')}
              >
                中文翻译件
              </button>
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isDeclarationTranslationActive ? 'license-officer-menu__item--active' : ''}`}
              >
                宣誓&认证翻译
              </button>
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isNotaryOrdersActive ? 'license-officer-menu__item--active' : ''}`}
              >
                公证订单
              </button>
            </div>
          )}

          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--parent ${isCtripMenuOpen ? 'license-officer-menu__item--open' : ''}`}
            onClick={() => toggleMenu('ctrip')}
            aria-expanded={isCtripMenuOpen}
          >
            <span>携程标准件</span>
            <span aria-hidden="true">›</span>
          </button>
          {isCtripMenuOpen && (
            <div className="license-officer-submenu">
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isApiStandardTranslationActive ? 'license-officer-menu__item--active' : ''}`}
                onClick={() => navigate('/license-officer/ctrip-standard/api-standard-translation')}
              >
                Api接口标准件
              </button>
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isExcelImportActive ? 'license-officer-menu__item--active' : ''}`}
                onClick={() => navigate('/license-officer/ctrip-standard/standard-translation-excel-import')}
              >
                标准翻译件excl导入
              </button>
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isVipStandardTranslationActive ? 'license-officer-menu__item--active' : ''}`}
                onClick={() => navigate('/license-officer/ctrip-standard/vip-standard-translation')}
              >
                大客户标准翻译件
              </button>
            </div>
          )}
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--parent ${isReportMenuOpen ? 'license-officer-menu__item--open' : ''}`}
            onClick={() => toggleMenu('report')}
            aria-expanded={isReportMenuOpen}
          >
            <span>报表</span>
            <span aria-hidden="true">›</span>
          </button>
          {isReportMenuOpen && (
            <div className="license-officer-submenu">
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isReportListActive ? 'license-officer-menu__item--active' : ''}`}
                onClick={() => navigate('/license-officer/reports/list')}
              >
                报表
              </button>
            </div>
          )}
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--parent ${isUserMenuOpen ? 'license-officer-menu__item--open' : ''}`}
            onClick={() => toggleMenu('user')}
            aria-expanded={isUserMenuOpen}
          >
            <span>用户管理</span>
            <span aria-hidden="true">›</span>
          </button>
          {isUserMenuOpen && (
            <div className="license-officer-submenu">
              <button
                type="button"
                className={`license-officer-menu__item license-officer-menu__item--child ${isUserListActive ? 'license-officer-menu__item--active' : ''}`}
                onClick={() => navigate('/license-officer/users/list')}
              >
              用户列表
              </button>
            </div>
          )}
        </nav>

        <div className="license-officer-sidebar__footer">
          <div className="license-officer-user">
            <strong>{currentUser.displayName}</strong>
            <span>{currentUser.role}</span>
          </div>
          <button type="button" onClick={() => navigate('/')}>切换管理端</button>
          <button type="button" onClick={() => navigate('/agent-system')}>切换用户端</button>
          <button type="button" className="license-officer-sidebar__logout" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <main className="license-officer-content">{children}</main>
    </div>
  );
};

export default LicenseOfficerLayout;
