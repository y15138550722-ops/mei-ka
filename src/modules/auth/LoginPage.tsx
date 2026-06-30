import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DEMO_AUTH_PASSWORD,
  DEMO_AUTH_USERNAME,
  loginWithCredentials,
  type AuthSession,
} from '../../shared/utils/auth';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

const createVerificationCode = () =>
  Math.random()
    .toString(36)
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X');

const UserIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
      fill="currentColor"
    />
  </svg>
);

const LockIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4Z"
      fill="currentColor"
    />
  </svg>
);

const ShieldIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2 5 5v6c0 4.44 2.99 8.57 7 9.74 4.01-1.17 7-5.3 7-9.74V5Zm-1.13 12.89L7.7 11.72l1.41-1.41 1.76 1.76 4.02-4.02 1.41 1.41Z"
      fill="currentColor"
    />
  </svg>
);

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState(DEMO_AUTH_USERNAME);
  const [password, setPassword] = useState(DEMO_AUTH_PASSWORD);
  const [verificationCode, setVerificationCode] = useState(createVerificationCode);
  const [verificationInput, setVerificationInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const refreshVerificationCode = () => {
    setVerificationCode(createVerificationCode());
    setVerificationInput('');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (verificationInput.trim().toUpperCase() !== verificationCode) {
      setErrorMessage('验证码错误，请重新输入。');
      refreshVerificationCode();
      return;
    }

    const session = loginWithCredentials(username, password);
    if (!session) {
      setErrorMessage('账号或密码错误，请使用演示账号重新登录。');
      refreshVerificationCode();
      return;
    }

    setErrorMessage('');
    onLogin(session);
    navigate('/', { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-page__backdrop" />

      <div className="login-page__shell animate-fadeIn">
        <section className="login-page__hero">
          <div className="login-page__hero-copy">
            <h1 className="login-page__title">美卡后台管理系统</h1>
            <p className="login-page__subtitle">订单履约 / 翻译制作 / 渠道协同 / 数据查询</p>
          </div>

          <div className="login-page__illustration" aria-hidden="true">
            <div className="login-page__glow login-page__glow--left" />
            <div className="login-page__glow login-page__glow--right" />

            <div className="login-scene">
              <div className="login-scene__road" />
              <div className="login-scene__road login-scene__road--secondary" />

              <div className="login-scene__block login-scene__block--a" />
              <div className="login-scene__block login-scene__block--b" />
              <div className="login-scene__block login-scene__block--c" />
              <div className="login-scene__block login-scene__block--d" />

              <div className="login-scene__pin login-scene__pin--a" />
              <div className="login-scene__pin login-scene__pin--b" />

              <div className="login-scene__doc">
                <div className="login-scene__doc-sheet">
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="login-scene__car">
                <span className="login-scene__wheel login-scene__wheel--left" />
                <span className="login-scene__wheel login-scene__wheel--right" />
              </div>

              <div className="login-scene__screen">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </section>

        <section className="login-page__panel">
          <div className="login-card">
            <div className="login-card__header">
              <h2 className="login-card__title">美卡后台管理系统</h2>
              <p className="login-card__caption">后台系统登录</p>
            </div>

            <form className="login-card__form" onSubmit={handleSubmit}>
              <label className="login-field" htmlFor="login-username">
                <span className="login-field__icon">
                  <UserIcon />
                </span>
                <input
                  id="login-username"
                  className="login-field__input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入账号"
                  autoComplete="username"
                />
              </label>

              <label className="login-field" htmlFor="login-password">
                <span className="login-field__icon">
                  <LockIcon />
                </span>
                <input
                  id="login-password"
                  type="password"
                  className="login-field__input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
                <span className="login-field__trailing" aria-hidden="true">
                  <ShieldIcon />
                </span>
              </label>

              <div className="login-card__verification">
                <label className="login-field login-field--verification" htmlFor="login-verification">
                  <input
                    id="login-verification"
                    className="login-field__input"
                    value={verificationInput}
                    onChange={(event) => setVerificationInput(event.target.value)}
                    placeholder="请输入验证码"
                    autoComplete="off"
                  />
                </label>

                <button
                  type="button"
                  className="login-card__verification-code"
                  onClick={refreshVerificationCode}
                  title="点击刷新验证码"
                >
                  {verificationCode}
                </button>
              </div>

              {errorMessage && <div className="login-card__error">{errorMessage}</div>}

              <button type="submit" className="login-card__submit">
                登录
              </button>
            </form>

            <div className="login-card__hint">
              <span>演示账号</span>
              <strong>
                {DEMO_AUTH_USERNAME} / {DEMO_AUTH_PASSWORD}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
