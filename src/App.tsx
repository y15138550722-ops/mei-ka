import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import MainLayout from './shared/layouts/MainLayout';
import { getStoredAuthSession, logoutAuthSession, type AuthSession } from './shared/utils/auth';

const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));
const OrderList = lazy(() => import('./modules/order-management/OrderList'));
const IdpOrderList = lazy(() => import('./modules/order-management/IdpOrderList'));
const IddTemplatePreview = lazy(() => import('./modules/order-management/IddTemplatePreview'));
const OrderDetail = lazy(() => import('./modules/order-management/OrderDetail'));
const NotaryOrderManagementList = lazy(() => import('./modules/order-management/NotaryOrderManagementList'));
const NotaryOrderManagementPreview = lazy(() => import('./modules/order-management/NotaryOrderManagementPreview'));
const KlookOrderManagement = lazy(() => import('./modules/order-management/KlookOrderManagement'));
const KlookOrderDetail = lazy(() => import('./modules/order-management/KlookOrderDetail'));
const HelloOrderManagement = lazy(() => import('./modules/order-management/HelloOrderManagement'));
const HelloOrderDetail = lazy(() => import('./modules/order-management/HelloOrderDetail'));
const ProductList = lazy(() => import('./modules/product-management/ProductList'));
const ProductForm = lazy(() => import('./modules/product-management/ProductForm'));
const ProductProcessTypeManagement = lazy(() => import('./modules/product-management/ProductProcessTypeManagement'));
const FilePreviewCenter = lazy(() => import('./modules/file-preview/FilePreviewCenter'));
const NotaryOrderList = lazy(() => import('./modules/notary-office/NotaryOrderList'));
const NotaryOrderPreview = lazy(() => import('./modules/notary-office/NotaryOrderPreview'));
const AgentSystemPage = lazy(() => import('./modules/agent-system/AgentSystemPage'));
const LicenseOfficerLayout = lazy(() => import('./modules/license-officer/LicenseOfficerLayout'));
const ChineseTranslationOrders = lazy(() => import('./modules/license-officer/ChineseTranslationOrders'));
const DomesticLicenseTranslationEditor = lazy(() => import('./modules/license-officer/DomesticLicenseTranslationEditor'));
const LoginPage = lazy(() => import('./modules/auth/LoginPage'));

interface ProtectedLayoutProps {
  currentUser: AuthSession | null;
  onLogout: () => void;
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ currentUser, onLogout }) => {
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MainLayout currentUser={currentUser} onLogout={onLogout}>
      <Outlet />
    </MainLayout>
  );
};

interface ProtectedSystemPageProps {
  currentUser: AuthSession | null;
}

const ProtectedSystemPage: React.FC<ProtectedSystemPageProps> = ({ currentUser }) => {
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <AgentSystemPage />;
};

interface ProtectedLicenseOfficerLayoutProps {
  currentUser: AuthSession | null;
  onLogout: () => void;
}

const ProtectedLicenseOfficerLayout: React.FC<ProtectedLicenseOfficerLayoutProps> = ({ currentUser, onLogout }) => {
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <LicenseOfficerLayout currentUser={currentUser} onLogout={onLogout}>
      <Outlet />
    </LicenseOfficerLayout>
  );
};

const LARGE_LOCAL_DATA_STORAGE_KEYS = [
  'meika-orders',
  'meika-order-data-version',
  'meika-notary-office-orders',
  'meika-notary-office-orders-version',
  'meika-klook-orders',
  'meika-hello-orders',
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(() => getStoredAuthSession());

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('clearLocalData') !== '1') {
      return;
    }

    LARGE_LOCAL_DATA_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    window.location.reload();
  }, []);

  const handleLogin = (session: AuthSession) => {
    setCurrentUser(session);
  };

  const handleLogout = () => {
    logoutAuthSession();
    setCurrentUser(null);
  };

  return (
    <Suspense fallback={<div className="app-main">加载中...</div>}>
      <Routes>
        <Route
          path="/login"
          element={
            currentUser ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />
          }
        />

        <Route path="/agent-system" element={<ProtectedSystemPage currentUser={currentUser} />} />

        <Route element={<ProtectedLicenseOfficerLayout currentUser={currentUser} onLogout={handleLogout} />}>
          <Route
            path="/license-officer"
            element={<Navigate to="/license-officer/orders/chinese-translation" replace />}
          />
          <Route path="/license-officer/orders/chinese-translation" element={<ChineseTranslationOrders />} />
          <Route path="/license-officer/orders/chinese-translation/docx/:orderId" element={<DomesticLicenseTranslationEditor />} />
        </Route>

        <Route element={<ProtectedLayout currentUser={currentUser} onLogout={handleLogout} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/order-management/idp-orders" element={<IdpOrderList />} />
          <Route path="/order-management/idp-orders/:id" element={<OrderDetail />} />
          <Route path="/order-management/idp-orders/:id/templates" element={<IddTemplatePreview />} />
          <Route path="/order-management/notary-orders" element={<NotaryOrderManagementList />} />
          <Route path="/order-management/notary-orders/:id/preview" element={<NotaryOrderManagementPreview />} />
          <Route path="/order-management/api-orders" element={<Navigate to="/order-management/api-orders/klook" replace />} />
          <Route path="/order-management/api-orders/klook" element={<KlookOrderManagement />} />
          <Route
            path="/order-management/api-orders/klook/:id"
            element={<KlookOrderDetail enableFullLicenseEdit generateManagementOrderIdOnApprove />}
          />
          <Route path="/order-management/api-orders/hello" element={<HelloOrderManagement />} />
          <Route path="/order-management/api-orders/hello/:id" element={<HelloOrderDetail />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/:id/edit" element={<ProductForm />} />
          <Route path="/products/:id/process-types" element={<ProductProcessTypeManagement />} />
          <Route path="/file-preview" element={<FilePreviewCenter />} />
          <Route path="/notary/orders" element={<NotaryOrderList />} />
          <Route path="/notary/orders/:id/preview" element={<NotaryOrderPreview />} />
        </Route>

        <Route path="*" element={<Navigate to={currentUser ? '/' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
