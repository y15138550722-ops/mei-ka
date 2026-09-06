import React from 'react';
import TranslationOrderList from './TranslationOrderList';

const HongKongNotaryOrderManagement: React.FC = () => (
  <TranslationOrderList
    productCategory="local_language_notary"
    pageTitle="香港公证件订单管理"
    basePath="/order-management/hong-kong-notary-orders"
  />
);

export default HongKongNotaryOrderManagement;
