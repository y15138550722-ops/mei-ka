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
    icon: '📊',
    path: '/',
  },
  {
    key: 'order-management',
    labelKey: 'menu.orderManagement',
    icon: '📋',
    children: [
      {
        key: 'order-list',
        labelKey: 'menu.orderList',
        icon: '🧾',
        path: '/orders',
      },
      {
        key: 'order-notary-order-management',
        labelKey: 'menu.notaryOrderManagement',
        icon: '📜',
        path: '/order-management/notary-orders',
      },
      {
        key: 'order-idp-order-management',
        labelKey: 'menu.idpOrderManagement',
        icon: '🚗',
        path: '/order-management/idp-orders',
      },
      {
        key: 'order-api-order-management',
        labelKey: 'menu.apiOrderManagement',
        icon: '🔌',
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
            icon: '哈',
            path: '/order-management/api-orders/hello',
          },
        ],
      },
    ],
  },
  {
    key: 'product-management',
    labelKey: 'menu.productManagement',
    icon: '📦',
    children: [
      {
        key: 'product-list',
        labelKey: 'menu.productList',
        icon: '🏷️',
        path: '/products',
      },
    ],
  },
  {
    key: 'file-preview',
    labelKey: 'menu.filePreview',
    icon: '📁',
    path: '/file-preview',
  },
  {
    key: 'notary-office',
    labelKey: 'menu.notaryOffice',
    icon: '🏛️',
    children: [
      {
        key: 'notary-order-list',
        labelKey: 'menu.notaryOrderList',
        icon: '📜',
        path: '/notary/orders',
      },
    ],
  },
];
