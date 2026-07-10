// ============================================
// Menu Configuration
// ============================================

export interface MenuItem {
  key: string;
  labelKey: string;
  icon: string;
  path?: string;
  children?: MenuItem[];
}

export const menuConfig: MenuItem[] = [
  {
    key: 'dashboard',
    labelKey: 'menu.dashboard',
    icon: 'D',
    path: '/',
  },
  {
    key: 'order-management',
    labelKey: 'menu.orderManagement',
    icon: 'O',
    children: [
      {
        key: 'order-list',
        labelKey: 'menu.orderList',
        icon: 'T',
        path: '/orders',
      },
      {
        key: 'order-domestic-license-order-management',
        labelKey: 'menu.domesticLicenseOrderManagement',
        icon: 'DL',
        path: '/order-management/domestic-license-orders',
      },
      {
        key: 'order-notary-order-management',
        labelKey: 'menu.notaryOrderManagement',
        icon: 'N',
        path: '/order-management/notary-orders',
      },
      {
        key: 'order-external-notary-order-management',
        labelKey: 'menu.externalNotaryOrderManagement',
        icon: 'EN',
        path: '/order-management/external-notary-orders',
      },
      {
        key: 'order-idp-order-management',
        labelKey: 'menu.idpOrderManagement',
        icon: 'IDP',
        path: '/order-management/idp-orders',
      },
      {
        key: 'order-api-order-management',
        labelKey: 'menu.apiOrderManagement',
        icon: 'API',
        children: [
          {
            key: 'order-klook-order-management',
            labelKey: 'menu.klookOrderManagement',
            icon: 'K',
            path: '/order-management/api-orders/klook',
          },
          {
            key: 'order-hello-order-management',
            labelKey: 'menu.helloOrderManagement',
            icon: 'H',
            path: '/order-management/api-orders/hello',
          },
        ],
      },
    ],
  },
  {
    key: 'product-management',
    labelKey: 'menu.productManagement',
    icon: 'P',
    children: [
      {
        key: 'product-list',
        labelKey: 'menu.productList',
        icon: 'PL',
        path: '/products',
      },
    ],
  },
  {
    key: 'file-preview',
    labelKey: 'menu.filePreview',
    icon: 'F',
    path: '/file-preview',
  },
  {
    key: 'notary-office',
    labelKey: 'menu.notaryOffice',
    icon: 'NO',
    children: [
      {
        key: 'notary-order-list',
        labelKey: 'menu.notaryOrderList',
        icon: 'N',
        path: '/notary/orders',
      },
    ],
  },
];
