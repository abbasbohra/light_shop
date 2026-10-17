import { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Role } from './lib/types';
import Layout from './components/Layout';
import Login from './screens/Login';
import Scan from './screens/Scan';
import Search from './screens/Search';
import AddProduct from './screens/AddProduct';
import Admin from './screens/Admin';
import Stock from './screens/Stock';
import StockProducts from './screens/StockProducts';
import Product from './screens/Product';
import Deliveries from './screens/Deliveries';
import NewDelivery from './screens/NewDelivery';
import DeliveryDetail from './screens/DeliveryDetail';
import Users from './screens/Users';

const CATALOG: Role[] = ['admin', 'sales', 'store'];      // can browse products and stock
const DELIVERIES: Role[] = ['admin', 'sales', 'delivery']; // can open deliveries
const HOME: Record<Role, string> = { admin: '/admin', store: '/scan', sales: '/scan', delivery: '/deliveries' };

function Guard({ allow, children }: { allow: Role[]; children: ReactElement }) {
  const { role } = useAuth();
  return role && allow.includes(role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { session, role, loading } = useAuth();
  if (loading) return <div className="center"><div className="spinner" /></div>;
  if (!session || !role) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to={HOME[role]} replace />} />
        <Route path="scan" element={<Guard allow={CATALOG}><Scan /></Guard>} />
        <Route path="search" element={<Guard allow={CATALOG}><Search /></Guard>} />
        <Route path="add" element={<Guard allow={['admin', 'store']}><AddProduct /></Guard>} />
        <Route path="admin" element={<Guard allow={['admin']}><Admin /></Guard>} />
        <Route path="product/:id" element={<Guard allow={CATALOG}><Product /></Guard>} />
        <Route path="stock" element={<Guard allow={CATALOG}><Stock /></Guard>} />
        <Route path="stock/products" element={<Guard allow={CATALOG}><StockProducts /></Guard>} />
        <Route path="deliveries" element={<Guard allow={DELIVERIES}><Deliveries /></Guard>} />
        <Route path="delivery/new" element={<Guard allow={['admin', 'sales']}><NewDelivery /></Guard>} />
        <Route path="delivery/:id" element={<Guard allow={DELIVERIES}><DeliveryDetail /></Guard>} />
        <Route path="users" element={<Guard allow={['admin']}><Users /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
