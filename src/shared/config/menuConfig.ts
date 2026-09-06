import type { SidebarMenuIconName } from '../components/icons/SidebarMenuIcon';

// ============================================
// Menu Configuration
// ============================================

export interface MenuItem {
  key: string;
  labelKey: string;
  icon: SidebarMenuIconName;
  path?: string;
  children?: MenuItem[];
}

export const menuConfig: MenuItem[] = [
  {
    key: 'dashboard',
    labelKey: 'menu.dashboard',
    icon: 'dashboard',
    path: '/',
  },
  {
    key: 'order-management',
    labelKey: 'menu.orderManagement',
    icon: 'orders',
    children: [
      {
        key: 'order-list',
        labelKey: 'menu.orderList',
        icon: 'translation',
        path: '/orders',
      },
      {
        key: 'order-domestic-license-order-management',
        labelKey: 'menu.domesticLicenseOrderManagement',
        icon: 'license',
        path: '/order-management/domestic-license-orders',
      },
      {
        key: 'order-notary-order-management',
        labelKey: 'menu.notaryOrderManagement',
        icon: 'notary',
        path: '/order-management/notary-orders',
      },
      {
        key: 'order-hong-kong-notary-order-management',
        labelKey: 'menu.hongKongNotaryOrderManagement',
        icon: 'notary',
        path: '/order-management/hong-kong-notary-orders',
      },
      {
        key: 'order-external-notary-order-management',
        labelKey: 'menu.externalNotaryOrderManagement',
        icon: 'external-orders',
        path: '/order-management/external-notary-orders',
      },
      {
        key: 'order-idp-order-management',
        labelKey: 'menu.idpOrderManagement',
        icon: 'idp',
        path: '/order-management/idp-orders',
      },
      {
        key: 'order-api-order-management',
        labelKey: 'menu.apiOrderManagement',
        icon: 'api',
        children: [
          {
            key: 'order-klook-order-management',
            labelKey: 'menu.klookOrderManagement',
            icon: 'klook',
            path: '/order-management/api-orders/klook',
          },
          {
            key: 'order-hello-order-management',
            labelKey: 'menu.helloOrderManagement',
            icon: 'hello',
            path: '/order-management/api-orders/hello',
          },
        ],
      },
    ],
  },
  {
    key: 'product-management',
    labelKey: 'menu.productManagement',
    icon: 'products',
    children: [
      {
        key: 'product-list',
        labelKey: 'menu.productList',
        icon: 'products',
        path: '/products',
      },
    ],
  },
  {
    key: 'file-preview',
    labelKey: 'menu.filePreview',
    icon: 'file-preview',
    path: '/file-preview',
  },
  {
    key: 'notary-office',
    labelKey: 'menu.notaryOffice',
    icon: 'notary',
    children: [
      {
        key: 'notary-order-list',
        labelKey: 'menu.notaryOrderList',
        icon: 'notary',
        path: '/notary/orders',
      },
    ],
  },
];
