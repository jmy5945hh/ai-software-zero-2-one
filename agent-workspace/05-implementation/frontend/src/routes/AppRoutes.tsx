import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../layouts/Layout';
import LoginPage from '../pages/auth/LoginPage';
import HomePage from '../pages/home/HomePage';
import CustomerVisitList from '../pages/customer-visit/CustomerVisitList';
import CustomerVisitCreate from '../pages/customer-visit/CustomerVisitCreate';
import GiftApplicationList from '../pages/gift-management/GiftApplicationList';
import GiftApplicationCreate from '../pages/gift-management/GiftApplicationCreate';
import OperationsDashboard from '../pages/dashboard/OperationsDashboard';
import GiftLedgerList from '../pages/gift-management/GiftLedgerList';
import ProtectedRoute from './ProtectedRoute';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="customer-visit">
          <Route index element={<CustomerVisitList />} />
          <Route path="create" element={<CustomerVisitCreate />} />
          <Route path="edit/:id" element={<CustomerVisitCreate />} />
        </Route>
        <Route path="gift-application">
          <Route index element={<GiftApplicationList />} />
          <Route path="create" element={<GiftApplicationCreate />} />
        </Route>
        <Route path="dashboard" element={<OperationsDashboard />} />
        <Route path="gift-ledger" element={<GiftLedgerList />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};

export default AppRoutes;