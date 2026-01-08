/**
 * 路由配置
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import MainLayout from '@/components/MainLayout';
import Dashboard from '@/pages/Dashboard';
import AuthGuard from '@/router/AuthGuard';

// 拜访管理
import VisitList from '@/pages/Visits/List';
import VisitDetail from '@/pages/Visits/Detail';
import VisitForm from '@/pages/Visits/Form';

// 礼品管理
import GiftRequisitionList from '@/pages/Gifts/RequisitionList';
import GiftRequisitionForm from '@/pages/Gifts/RequisitionForm';
import GiftApproval from '@/pages/Gifts/Approval';
import GiftLedger from '@/pages/Gifts/Ledger';

/**
 * 路由配置
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      // 拜访管理路由
      {
        path: 'visits',
        element: <VisitList />,
      },
      {
        path: 'visits/create',
        element: <VisitForm />,
      },
      {
        path: 'visits/:visitId',
        element: <VisitDetail />,
      },
      {
        path: 'visits/edit/:visitId',
        element: <VisitForm />,
      },
      // 礼品管理路由
      {
        path: 'gifts/requisitions',
        element: <GiftRequisitionList />,
      },
      {
        path: 'gifts/requisitions/create',
        element: <GiftRequisitionForm />,
      },
      {
        path: 'gifts/requisitions/:id',
        element: <GiftApproval />,
      },
      {
        path: 'gifts/requisitions/:id/approve',
        element: <GiftApproval />,
      },
      {
        path: 'gifts/ledger',
        element: <GiftLedger />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
