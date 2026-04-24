export interface AuthSession {
  username: string;
  displayName: string;
  role: string;
}

const AUTH_SESSION_STORAGE_KEY = 'meika-auth-session';
const LOGGED_OUT_SENTINEL = '__logged_out__';

export const DEMO_AUTH_USERNAME = 'admin';
export const DEMO_AUTH_PASSWORD = '123456';

const DEFAULT_AUTH_SESSION: AuthSession = {
  username: DEMO_AUTH_USERNAME,
  displayName: '管理员',
  role: '运营人员',
};

const isBrowser = () => typeof window !== 'undefined';

const isAuthSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const session = value as Partial<AuthSession>;
  return (
    typeof session.username === 'string' &&
    typeof session.displayName === 'string' &&
    typeof session.role === 'string'
  );
};

const persistAuthSession = (session: AuthSession) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const getStoredAuthSession = (): AuthSession | null => {
  if (!isBrowser()) {
    return DEFAULT_AUTH_SESSION;
  }

  const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!rawValue) {
    persistAuthSession(DEFAULT_AUTH_SESSION);
    return DEFAULT_AUTH_SESSION;
  }

  if (rawValue === LOGGED_OUT_SENTINEL) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (isAuthSession(parsedValue)) {
      return parsedValue;
    }
  } catch {
    // Fall back to the demo session below.
  }

  persistAuthSession(DEFAULT_AUTH_SESSION);
  return DEFAULT_AUTH_SESSION;
};

export const getCurrentAuthAccountId = () => getStoredAuthSession()?.username || '--';

export const loginWithCredentials = (username: string, password: string): AuthSession | null => {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (normalizedUsername !== DEMO_AUTH_USERNAME || normalizedPassword !== DEMO_AUTH_PASSWORD) {
    return null;
  }

  persistAuthSession(DEFAULT_AUTH_SESSION);
  return DEFAULT_AUTH_SESSION;
};

export const logoutAuthSession = () => {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, LOGGED_OUT_SENTINEL);
};
