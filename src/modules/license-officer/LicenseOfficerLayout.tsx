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

  const isChineseTranslationActive = location.pathname.startsWith('/license-officer/orders/chinese-translation');

  const handleLogout = () => {
    if (typeof window !== 'undefined' && !window.confirm('确认退出登录吗？')) {
      return;
    }

    onLogout?.();
  };

  return (
    <div className="license-officer-layout">
      <aside className="license-officer-sidebar">
        <div className="license-officer-brand">
          <div className="license-officer-brand__logo">驾</div>
          <div>
            <strong>驾照官</strong>
            <span>后台管理系统</span>
          </div>
        </div>

        <nav className="license-officer-menu" aria-label="驾照官后台菜单">
          <button
            type="button"
            className={`license-officer-menu__item license-officer-menu__item--parent ${isOrderMenuOpen ? 'license-officer-menu__item--open' : ''}`}
            onClick={() => setIsOrderMenuOpen((open) => !open)}
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
            </div>
          )}
        </nav>

        <div className="license-officer-sidebar__footer">
          <div className="license-officer-user">
            <strong>{currentUser.displayName}</strong>
            <span>{currentUser.role}</span>
          </div>
          <button type="button" onClick={() => navigate('/')}>返回美卡后台</button>
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
