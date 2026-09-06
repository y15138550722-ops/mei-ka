import React, { useMemo, useState } from 'react';
import './ChineseTranslationOrders.css';

type UserIdentityFilter = '全部' | '普通会员' | '管理员' | '运营人员';
type UserStatusFilter = '全部' | '启用' | '停用';
type UserPermission = '订单管理' | '携程标准翻译件' | '报表' | '用户管理';

interface UserListItem {
  id: string;
  nickname: string;
  realName: string;
  identity: Exclude<UserIdentityFilter, '全部'>;
  enabled: boolean;
  email: string;
  phone: string;
  joinIp: string;
  joinedAt: string;
  lastLoginAt: string;
}

const USER_IDENTITY_OPTIONS: UserIdentityFilter[] = ['全部', '普通会员', '管理员', '运营人员'];
const USER_STATUS_OPTIONS: UserStatusFilter[] = ['全部', '启用', '停用'];
const USER_PERMISSION_OPTIONS: Array<{ value: UserPermission; description: string }> = [
  { value: '订单管理', description: '查看和处理生产端订单' },
  { value: '携程标准翻译件', description: '处理携程标准翻译件业务' },
  { value: '报表', description: '查看生产数据报表' },
  { value: '用户管理', description: '维护用户信息和管理员权限' },
];
const USER_LIST_PAGE_SIZE = 10;

export const USER_LIST: UserListItem[] = [
  {
    id: 'U2606001',
    nickname: '海风自驾',
    realName: '任卫利',
    identity: '普通会员',
    enabled: true,
    email: 'renweili@example.com',
    phone: '13800138001',
    joinIp: '110.102.36.15',
    joinedAt: '2026-06-01 09:18:26',
    lastLoginAt: '2026-06-11 10:24:18',
  },
  {
    id: 'U2606002',
    nickname: '运营小周',
    realName: '周敏',
    identity: '运营人员',
    enabled: true,
    email: 'zhoumin@meika.local',
    phone: '13900139002',
    joinIp: '121.43.18.92',
    joinedAt: '2026-06-02 14:36:10',
    lastLoginAt: '2026-06-11 09:42:31',
  },
  {
    id: 'U2606003',
    nickname: '系统管理员',
    realName: '李明',
    identity: '管理员',
    enabled: true,
    email: 'admin@meika.local',
    phone: '13700137003',
    joinIp: '58.246.77.16',
    joinedAt: '2026-05-28 11:08:45',
    lastLoginAt: '2026-06-11 08:55:09',
  },
  {
    id: 'U2606004',
    nickname: '远山旅人',
    realName: '张维淮',
    identity: '普通会员',
    enabled: false,
    email: 'zhangweihuai@example.com',
    phone: '13600136004',
    joinIp: '220.181.38.88',
    joinedAt: '2026-06-05 16:22:19',
    lastLoginAt: '2026-06-10 21:17:40',
  },
  {
    id: 'U2606005',
    nickname: '客服小赵',
    realName: '赵子乔',
    identity: '运营人员',
    enabled: true,
    email: 'zhaozq@meika.local',
    phone: '13500135005',
    joinIp: '101.226.125.68',
    joinedAt: '2026-06-07 13:05:33',
    lastLoginAt: '2026-06-11 11:03:27',
  },
  {
    id: 'U2606006',
    nickname: '管理员王磊',
    realName: '王磊',
    identity: '管理员',
    enabled: true,
    email: 'wanglei@meika.local',
    phone: '13500135006',
    joinIp: '101.226.125.69',
    joinedAt: '2026-06-08 09:15:21',
    lastLoginAt: '2026-06-12 09:24:16',
  },
  {
    id: 'U2606007',
    nickname: '管理员陈晨',
    realName: '陈晨',
    identity: '管理员',
    enabled: true,
    email: 'chenchen@meika.local',
    phone: '13500135007',
    joinIp: '101.226.125.70',
    joinedAt: '2026-06-08 10:28:43',
    lastLoginAt: '2026-06-12 09:41:32',
  },
  {
    id: 'U2606008',
    nickname: '管理员刘洋',
    realName: '刘洋',
    identity: '管理员',
    enabled: true,
    email: 'liuyang@meika.local',
    phone: '13500135008',
    joinIp: '101.226.125.71',
    joinedAt: '2026-06-08 11:36:08',
    lastLoginAt: '2026-06-12 10:05:27',
  },
  {
    id: 'U2606009',
    nickname: '管理员孙悦',
    realName: '孙悦',
    identity: '管理员',
    enabled: false,
    email: 'sunyue@meika.local',
    phone: '13500135009',
    joinIp: '101.226.125.72',
    joinedAt: '2026-06-08 14:12:50',
    lastLoginAt: '2026-06-11 18:36:19',
  },
  {
    id: 'U2606010',
    nickname: '管理员周航',
    realName: '周航',
    identity: '管理员',
    enabled: true,
    email: 'zhouhang@meika.local',
    phone: '13500135010',
    joinIp: '101.226.125.73',
    joinedAt: '2026-06-09 09:44:31',
    lastLoginAt: '2026-06-12 10:22:48',
  },
  {
    id: 'U2606011',
    nickname: '管理员吴迪',
    realName: '吴迪',
    identity: '管理员',
    enabled: true,
    email: 'wudi@meika.local',
    phone: '13500135011',
    joinIp: '101.226.125.74',
    joinedAt: '2026-06-09 10:18:26',
    lastLoginAt: '2026-06-12 10:47:13',
  },
  {
    id: 'U2606012',
    nickname: '管理员郑楠',
    realName: '郑楠',
    identity: '管理员',
    enabled: false,
    email: 'zhengnan@meika.local',
    phone: '13500135012',
    joinIp: '101.226.125.75',
    joinedAt: '2026-06-09 13:55:09',
    lastLoginAt: '2026-06-11 17:29:51',
  },
  {
    id: 'U2606013',
    nickname: '管理员胡静',
    realName: '胡静',
    identity: '管理员',
    enabled: true,
    email: 'hujing@meika.local',
    phone: '13500135013',
    joinIp: '101.226.125.76',
    joinedAt: '2026-06-10 08:47:36',
    lastLoginAt: '2026-06-12 11:08:06',
  },
  {
    id: 'U2606014',
    nickname: '管理员高峰',
    realName: '高峰',
    identity: '管理员',
    enabled: true,
    email: 'gaofeng@meika.local',
    phone: '13500135014',
    joinIp: '101.226.125.77',
    joinedAt: '2026-06-10 15:20:18',
    lastLoginAt: '2026-06-12 11:35:44',
  },
  {
    id: 'U2606015',
    nickname: '管理员唐欣',
    realName: '唐欣',
    identity: '管理员',
    enabled: true,
    email: 'tangxin@meika.local',
    phone: '13500135015',
    joinIp: '101.226.125.78',
    joinedAt: '2026-06-11 09:03:25',
    lastLoginAt: '2026-06-12 11:58:29',
  },
];

const UserListPage: React.FC = () => {
  const [identity, setIdentity] = useState<UserIdentityFilter>('全部');
  const [status, setStatus] = useState<UserStatusFilter>('全部');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [identityInput, setIdentityInput] = useState<UserIdentityFilter>('全部');
  const [statusInput, setStatusInput] = useState<UserStatusFilter>('全部');
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<UserListItem[]>(USER_LIST);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [permissionUser, setPermissionUser] = useState<UserListItem | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, UserPermission[]>>({});
  const [permissionDraft, setPermissionDraft] = useState<UserPermission[]>([]);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (identity !== '全部' && user.identity !== identity) return false;
        if (status === '启用' && !user.enabled) return false;
        if (status === '停用' && user.enabled) return false;

        const normalizedKeyword = keyword.trim().toLowerCase();
        if (!normalizedKeyword) return true;

        return [user.realName, user.phone, user.nickname]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      }),
    [identity, keyword, status, users],
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USER_LIST_PAGE_SIZE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (currentSafePage - 1) * USER_LIST_PAGE_SIZE,
    currentSafePage * USER_LIST_PAGE_SIZE,
  );

  const closeModals = () => {
    setIsAddModalOpen(false);
    setEditingUser(null);
    setPermissionUser(null);
  };

  const openPermissionModal = (user: UserListItem) => {
    setPermissionUser(user);
    setPermissionDraft(userPermissions[user.id] || USER_PERMISSION_OPTIONS.map((option) => option.value));
  };

  const togglePermission = (permission: UserPermission) => {
    setPermissionDraft((currentPermissions) => (
      currentPermissions.includes(permission)
        ? currentPermissions.filter((item) => item !== permission)
        : [...currentPermissions, permission]
    ));
  };

  const savePermissions = () => {
    if (!permissionUser) return;
    setUserPermissions((currentPermissions) => ({
      ...currentPermissions,
      [permissionUser.id]: permissionDraft,
    }));
    closeModals();
  };

  const handleSearch = () => {
    setKeyword(keywordInput);
    setIdentity(identityInput);
    setStatus(statusInput);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setKeywordInput('');
    setKeyword('');
    setIdentityInput('全部');
    setIdentity('全部');
    setStatusInput('全部');
    setStatus('全部');
    setCurrentPage(1);
  };

  const toggleUserEnabled = (userId: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) => (
        user.id === userId ? { ...user, enabled: !user.enabled } : user
      )),
    );
  };

  const deleteUser = (userId: string) => {
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
  };

  const renderMemberForm = (mode: 'add' | 'edit', user?: UserListItem) => (
    <form
      className="user-member-form"
      onSubmit={(event) => {
        event.preventDefault();
        closeModals();
      }}
    >
      <label>
        <span>昵称</span>
        <input placeholder="会员昵称" defaultValue={user?.nickname || ''} />
      </label>
      <label>
        <span>{mode === 'add' ? <em>*</em> : null} 真实姓名</span>
        <input placeholder="真实姓名" defaultValue={user?.realName || ''} required={mode === 'add'} />
      </label>
      <label>
        <span>邮箱</span>
        <input placeholder="会员邮箱" defaultValue={user?.email || ''} />
      </label>
      <label>
        <span><em>*</em> 手机号码</span>
        <input placeholder="会员手机号码" defaultValue={user?.phone || ''} required />
        {mode === 'add' ? <small>用于会员登录</small> : null}
      </label>
      <label>
        <span>用户身份</span>
        <select defaultValue={user?.identity || '普通会员'}>
          {USER_IDENTITY_OPTIONS.filter((option) => option !== '全部').map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{mode === 'add' ? <em>*</em> : null} 输入密码</span>
        <input type="password" placeholder={mode === 'add' ? '设置密码' : '不修改请留空'} required={mode === 'add'} />
      </label>
      <label>
        <span>{mode === 'add' ? <em>*</em> : null} 确认密码</span>
        <input type="password" placeholder="再次输入密码" required={mode === 'add'} />
      </label>
      <button type="submit" className="user-member-form__submit">
        {mode === 'add' ? '确定添加' : '保存修改'}
      </button>
    </form>
  );

  return (
    <div className="license-translation-page animate-fadeIn">
      <header className="license-translation-topbar">
        <div>
          <div className="license-translation-breadcrumb">
            驾照官后台
            <span>/</span>
            用户管理
            <span>/</span>
            用户列表
          </div>
          <h1 className="user-list-page-title">用户列表</h1>
        </div>
      </header>

      <section className="license-translation-filter user-list-filter">
        <label>
          <span>综合搜索</span>
          <input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="支持姓名、手机号、昵称搜索"
          />
        </label>
        <label>
          <span>权限组</span>
          <select value={identityInput} onChange={(event) => setIdentityInput(event.target.value as UserIdentityFilter)}>
            {USER_IDENTITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select value={statusInput} onChange={(event) => setStatusInput(event.target.value as UserStatusFilter)}>
            {USER_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option === '全部' ? '请选择状态' : option}</option>
            ))}
          </select>
        </label>
        <div className="license-translation-filter__actions user-list-filter__actions">
          <button type="button" className="license-translation-button license-translation-button--primary" onClick={handleSearch}>
            搜索
          </button>
          <button type="button" className="license-translation-button" onClick={handleReset}>
            重置
          </button>
        </div>
      </section>

      <section className="license-translation-card">
        <div className="user-list-card-toolbar">
          <button
            type="button"
            className="license-translation-button license-translation-button--primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            添加会员
          </button>
        </div>
        <div className="license-translation-table-wrap">
          <table className="license-translation-table user-list-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>头像</th>
                <th>用户名</th>
                <th>昵称</th>
                <th>权限组</th>
                <th>状态</th>
                <th>邮箱</th>
                <th>手机</th>
                <th>加入时间</th>
                <th>最后登录时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>{(currentSafePage - 1) * USER_LIST_PAGE_SIZE + index + 1}</td>
                  <td>
                    <span className="user-avatar" aria-hidden="true">{(user.realName || user.nickname).slice(0, 1)}</span>
                  </td>
                  <td>{user.realName}</td>
                  <td>{user.nickname}</td>
                  <td>{user.identity}</td>
                  <td>
                    <button
                      type="button"
                      className={`user-status-switch${user.enabled ? ' user-status-switch--enabled' : ''}`}
                      onClick={() => toggleUserEnabled(user.id)}
                      aria-pressed={user.enabled}
                      aria-label={user.enabled ? '当前启用，点击停用' : '当前停用，点击启用'}
                    >
                      <span className="user-status-switch__label user-status-switch__label--off">停用</span>
                      <span className="user-status-switch__label user-status-switch__label--on">启用</span>
                      <span className="user-status-switch__thumb" />
                    </button>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.phone}</td>
                  <td className="license-translation-time-cell">{user.joinedAt}</td>
                  <td className="license-translation-time-cell">{user.lastLoginAt}</td>
                  <td>
                    <div className="license-translation-actions">
                      <button
                        type="button"
                        className="license-translation-action-button license-translation-action-button--view"
                        onClick={() => setEditingUser(user)}
                      >
                        修改会员信息
                      </button>
                      {user.identity === '管理员' ? (
                        <button
                          type="button"
                          className="license-translation-action-button license-translation-action-button--orange"
                          onClick={() => openPermissionModal(user)}
                        >
                          设置权限
                        </button>
                      ) : null}
                      {!user.enabled ? (
                        <button
                          type="button"
                          className="license-translation-action-button license-translation-action-button--danger"
                          onClick={() => deleteUser(user.id)}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="license-translation-empty">
                    当前筛选条件下没有用户
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="pagination user-list-pagination">
          <div className="pagination__info">
            共 <strong>{filteredUsers.length}</strong> 条记录
          </div>
          <div className="pagination__controls">
            <button
              type="button"
              className="pagination__btn"
              disabled={currentSafePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              ‹
            </button>
            <span className="pagination__current">
              {currentSafePage} / {totalPages}
            </span>
            <button
              type="button"
              className="pagination__btn"
              disabled={currentSafePage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              ›
            </button>
            <span className="pagination__label">每页 10 条</span>
          </div>
        </div>
      </section>

      {isAddModalOpen ? (
        <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={closeModals}>
          <section
            className="user-member-modal"
            role="dialog"
            aria-modal="true"
            aria-label="添加会员"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <strong>添加会员</strong>
              <button type="button" aria-label="关闭" onClick={closeModals}>×</button>
            </header>
            {renderMemberForm('add')}
          </section>
        </div>
      ) : null}

      {editingUser ? (
        <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={closeModals}>
          <section
            className="user-member-modal"
            role="dialog"
            aria-modal="true"
            aria-label="编辑会员"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <strong>编辑会员</strong>
              <button type="button" aria-label="关闭" onClick={closeModals}>×</button>
            </header>
            {renderMemberForm('edit', editingUser)}
          </section>
        </div>
      ) : null}

      {permissionUser ? (
        <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={closeModals}>
          <section
            className="user-member-modal user-permission-modal"
            role="dialog"
            aria-modal="true"
            aria-label="设置权限"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>设置权限</strong>
                <span>{permissionUser.realName}（{permissionUser.nickname}）</span>
              </div>
              <button type="button" aria-label="关闭" onClick={closeModals}>×</button>
            </header>
            <div className="user-permission-form">
              <div className="user-permission-list">
                {USER_PERMISSION_OPTIONS.map((option) => (
                  <label key={option.value} className="user-permission-option">
                    <input
                      type="checkbox"
                      checked={permissionDraft.includes(option.value)}
                      onChange={() => togglePermission(option.value)}
                    />
                    <span>
                      <strong>{option.value}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <footer>
                <button type="button" className="license-translation-button" onClick={closeModals}>取消</button>
                <button
                  type="button"
                  className="license-translation-button license-translation-button--primary"
                  onClick={savePermissions}
                >
                  保存权限
                </button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default UserListPage;
