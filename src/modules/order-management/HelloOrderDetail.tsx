import React from 'react';
import KlookOrderDetail from './KlookOrderDetail';
import { getHelloOrderById, updateHelloOrder } from './klookOrderService';

const HelloOrderDetail: React.FC = () => (
  <KlookOrderDetail
    listPath="/order-management/api-orders/hello"
    listLabel="哈啰订单管理"
    getOrderById={getHelloOrderById}
    updateOrder={updateHelloOrder}
    enableFullLicenseEdit
    generateManagementOrderIdOnApprove
  />
);

export default HelloOrderDetail;
