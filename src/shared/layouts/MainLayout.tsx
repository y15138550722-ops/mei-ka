import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { menuConfig, type MenuItem } from '../config/menuConfig';
import { useTranslation } from '../i18n/config';
import type { AuthSession } from '../utils/auth';
import './MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
  currentUser?: AuthSession | null;
  onLogout?: () => void;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'meika-sidebar-collapsed';

const findActivePathKeys = (items: MenuItem[], pathname: string, ancestors: string[] = []): string[] => {
  for (const item of items) {
    const nextAncestors = [...ancestors, item.key];
    const matchesPath =
      !!item.path && (pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)));

    if (matchesPath) {
      return nextAncestors;
    }

    if (item.children) {
      const childPath = findActivePathKeys(item.children, pathname, nextAncestors);
      if (childPath.length > 0) {
        return childPath;
      }
    }
  }

  return [];
};

const getExpandedKeysForPath = (pathname: string) => findActivePathKeys(menuConfig, pathname).slice(0, -1);

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentUser, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => getExpandedKeysForPath(location.pathname));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  });
  const [collapsedFlyoutKey, setCollapsedFlyoutKey] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const activePathKeys = useMemo(() => findActivePathKeys(menuConfig, location.pathname), [location.pathname]);
  const currentActiveKey = activePathKeys[activePathKeys.length - 1] || '';

  const displayName = currentUser?.displayName || '管理员';
  const displayRole = currentUser?.role || '运营人员';
  const canLogout = typeof onLogout === 'function';

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setExpandedKeys(activePathKeys.slice(0, -1));
    setCollapsedFlyoutKey(null);
    setIsUserMenuOpen(false);
  }, [activePathKeys]);

  useEffect(() => {
    if (!isSidebarCollapsed) {
      setCollapsedFlyoutKey(null);
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isSidebarCollapsed || !collapsedFlyoutKey) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setCollapsedFlyoutKey(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCollapsedFlyoutKey(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [collapsedFlyoutKey, isSidebarCollapsed]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  const toggleExpand = (key: string, depth: number) => {
    setExpandedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(item => item !== key);
      }

      return depth === 0 ? [key] : [...prev, key];
    });
  };

  const isActive = (item: MenuItem): boolean => {
    if (item.path && location.pathname === item.path) return true;
    if (item.path && location.pathname.startsWith(item.path) && item.path !== '/') return true;
    if (item.children) return item.children.some(child => isActive(child));
    return false;
  };

  const handleLogoutClick = () => {
    setIsUserMenuOpen(false);

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认退出登录吗？');
      if (!confirmed) {
        return;
      }
    }

    onLogout?.();
  };

  const handleSwitchSystemClick = () => {
    setIsUserMenuOpen(false);
    navigate('/agent-system');
  };

  const renderFlyoutItems = (items: MenuItem[], depth = 0): React.ReactNode =>
    items.map(item => {
      const itemLabel = t(item.labelKey);
      const itemCurrent = currentActiveKey === item.key;
      const itemInActiveTree = activePathKeys.includes(item.key);
      const itemPaddingLeft = 12 + depth * 14;

      if (item.children?.length) {
        return (
          <div key={item.key} className="sidebar-flyout__group">
            <div
              className={[
                'sidebar-flyout__section-label',
                itemInActiveTree ? 'sidebar-flyout__section-label--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ paddingLeft: `${itemPaddingLeft}px` }}
            >
              <span className="sidebar-flyout__icon">{item.icon}</span>
              <span className="sidebar-flyout__text">{itemLabel}</span>
            </div>

            <div className="sidebar-flyout__list sidebar-flyout__list--nested">
              {renderFlyoutItems(item.children, depth + 1)}
            </div>
          </div>
        );
      }

      return (
        <button
          key={item.key}
          type="button"
          className={`sidebar-flyout__item ${itemCurrent ? 'sidebar-flyout__item--active' : ''}`}
          onClick={() => {
            if (item.path) {
              navigate(item.path);
              setCollapsedFlyoutKey(null);
            }
          }}
          aria-current={itemCurrent ? 'page' : undefined}
          role="menuitem"
          style={{ paddingLeft: `${itemPaddingLeft}px` }}
        >
          <span className="sidebar-flyout__icon">{item.icon}</span>
          <span className="sidebar-flyout__text">{itemLabel}</span>
        </button>
      );
    });

  const renderFlyoutChildren = (parent: MenuItem) => (
    <div className="sidebar-flyout" role="menu" aria-label={t(parent.labelKey)}>
      <div className="sidebar-flyout__header">{t(parent.labelKey)}</div>
      <div className="sidebar-flyout__list">{renderFlyoutItems(parent.children ?? [])}</div>
    </div>
  );

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = !!item.children?.length;
    const expanded = expandedKeys.includes(item.key);
    const active = isActive(item);
    const current = currentActiveKey === item.key;
    const inActiveTree = activePathKeys.includes(item.key);
    const flyoutOpen = isSidebarCollapsed && collapsedFlyoutKey === item.key;
    const itemLabel = t(item.labelKey);

    const handleItemClick = () => {
      if (hasChildren) {
        if (isSidebarCollapsed) {
          setCollapsedFlyoutKey(prev => (prev === item.key ? null : item.key));
          return;
        }

        toggleExpand(item.key, depth);
        return;
      }

      if (item.path) {
        navigate(item.path);
      }
    };

    return (
      <div
        key={item.key}
        className={`sidebar-item-wrap ${flyoutOpen ? 'sidebar-item-wrap--flyout-open' : ''}`}
        onMouseLeave={() => {
          if (flyoutOpen) {
            setCollapsedFlyoutKey(null);
          }
        }}
        onBlur={event => {
          if (flyoutOpen && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setCollapsedFlyoutKey(null);
          }
        }}
      >
        <button
          type="button"
          className={[
            'sidebar-item',
            active ? 'sidebar-item--active' : '',
            current ? 'sidebar-item--current' : '',
            inActiveTree ? 'sidebar-item--in-active-tree' : '',
            depth > 0 ? 'sidebar-item--child' : '',
            isSidebarCollapsed ? 'sidebar-item--collapsed' : '',
            flyoutOpen ? 'sidebar-item--flyout-open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleItemClick}
          onMouseEnter={() => {
            if (hasChildren && isSidebarCollapsed) {
              setCollapsedFlyoutKey(item.key);
            }
          }}
          onFocus={() => {
            if (hasChildren && isSidebarCollapsed) {
              setCollapsedFlyoutKey(item.key);
            }
          }}
          style={isSidebarCollapsed ? undefined : { paddingLeft: `${16 + depth * 16}px` }}
          title={isSidebarCollapsed ? itemLabel : undefined}
          aria-current={current ? 'page' : undefined}
          aria-expanded={hasChildren ? (!isSidebarCollapsed ? expanded : flyoutOpen) : undefined}
          aria-haspopup={hasChildren ? 'menu' : undefined}
        >
          <span className="sidebar-item__indicator" aria-hidden="true" />
          <span className="sidebar-item__icon">{item.icon}</span>
          <span className="sidebar-item__label">{itemLabel}</span>
          {hasChildren && (
            <span className={`sidebar-item__arrow ${expanded ? 'sidebar-item__arrow--open' : ''}`}>›</span>
          )}
        </button>

        {hasChildren && expanded && !isSidebarCollapsed && (
          <div className="sidebar-submenu">
            {item.children!.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}

        {hasChildren && flyoutOpen && renderFlyoutChildren(item)}
      </div>
    );
  };

  const sidebarToggleLabel = isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏';

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'app-layout--sidebar-collapsed' : ''}`}>
      <aside
        ref={sidebarRef}
        className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}
        id="main-sidebar"
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand__identity">
            <div className="sidebar-brand__logo">✈️</div>
            <div className="sidebar-brand__text">
              <span className="sidebar-brand__name">美卡</span>
              <span className="sidebar-brand__desc">Mei Ka Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarToggleLabel}
            aria-controls="main-sidebar"
            aria-expanded={!isSidebarCollapsed}
            title={sidebarToggleLabel}
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
          >
            <span className={`sidebar-toggle__icon ${isSidebarCollapsed ? 'sidebar-toggle__icon--collapsed' : ''}`}>
              ‹
            </span>
          </button>
        </div>

        <nav className="sidebar-nav">{menuConfig.map(item => renderMenuItem(item))}</nav>

        <div className="sidebar-footer">
          <div
            ref={userMenuRef}
            className={`sidebar-user-menu ${isUserMenuOpen ? 'sidebar-user-menu--open' : ''}`}
          >
            <button
              type="button"
              className={`sidebar-user ${canLogout ? 'sidebar-user--clickable' : ''}`}
              onClick={() => {
                if (!canLogout) return;
                setIsUserMenuOpen(prev => !prev);
              }}
              aria-haspopup={canLogout ? 'menu' : undefined}
              aria-expanded={canLogout ? isUserMenuOpen : undefined}
              title={isSidebarCollapsed ? `${displayName} / ${displayRole}` : undefined}
            >
              <div className="sidebar-user__avatar">{displayName.slice(0, 1)}</div>
              <div className="sidebar-user__info">
                <span className="sidebar-user__name">{displayName}</span>
                <span className="sidebar-user__role">{displayRole}</span>
              </div>
              {canLogout && <span className={`sidebar-user__arrow ${isUserMenuOpen ? 'sidebar-user__arrow--open' : ''}`}>⌄</span>}
            </button>

            {canLogout && isUserMenuOpen && (
              <div className="sidebar-user-dropdown" role="menu" aria-label="用户菜单">
                <div className="sidebar-user-dropdown__meta">
                  <strong>{displayName}</strong>
                  <span>{displayRole}</span>
                </div>
                <button
                  type="button"
                  className="sidebar-user-dropdown__item"
                  onClick={handleSwitchSystemClick}
                  role="menuitem"
                >
                  切换系统
                </button>
                <button
                  type="button"
                  className="sidebar-user-dropdown__item sidebar-user-dropdown__item--danger"
                  onClick={handleLogoutClick}
                  role="menuitem"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="app-content">{children}</div>
    </div>
  );
};

export default MainLayout;
