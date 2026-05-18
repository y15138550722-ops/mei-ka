import React from 'react';
import KlookOrderManagement from './KlookOrderManagement';
import { getHelloOrders } from './klookOrderService';

const HelloOrderManagement: React.FC = () => (
  <KlookOrderManagement
    pageTitle="哈啰订单管理"
    listLabel="哈啰订单管理"
    listPath="/order-management/api-orders/hello"
    detailPathPrefix="/order-management/api-orders/hello"
    getOrders={getHelloOrders}
    csvFilePrefix="哈啰订单管理"
  />
);

export default HelloOrderManagement;
