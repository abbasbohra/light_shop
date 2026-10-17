import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { NO_CATEGORY } from '../lib/config';
import { Role } from '../lib/types';

const T = {
  scan: { to: '/scan', icon: '📷', label: 'Scan' },
  search: { to: '/search', icon: '🔍', label: 'Search' },
  add: { to: '/add', icon: '➕', label: 'Add' },
  admin: { to: '/admin', icon: '🛠️', label: 'Admin' },
  stock: { to: '/stock', icon: '📦', label: 'Stock' },
  deliveries: { to: '/deliveries', icon: '🚚', label: 'Deliveries' },
};
// Which bottom tabs each role sees (BottomStack was not uploaded, so this is inferred from the role checks)
export const tabsFor = (role: Role | null) =>
  role === 'admin' ? [T.admin, T.scan, T.search, T.add]
  : role === 'store' ? [T.scan, T.search, T.add, T.stock]
  : role === 'sales' ? [T.scan, T.search, T.deliveries]
  : role === 'delivery' ? [T.deliveries] : [];

// true when the current page is one of the tabs (tab pages show their own big title, no back header)
export function useIsTab() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  return tabsFor(role).some((t) => t.to === pathname);
}

function useTitle() {
  const { pathname } = useLocation();
  const [sp] = useSearchParams();
  if (pathname === '/stock') return 'Manage Stock';
  if (pathname === '/stock/products') {
    const c = sp.get('category');
    return sp.get('model') ?? (c ? (c === NO_CATEGORY ? 'Uncategorised' : c) : 'All products');
  }
  if (pathname.startsWith('/product/')) return 'Product Details';
  if (pathname === '/deliveries') return 'Deliveries';
  if (pathname === '/delivery/new') return 'New Delivery';
  if (pathname.startsWith('/delivery/')) return 'Delivery';
  if (pathname === '/users') return 'Users & Roles';
  return '';
}

export default function Layout() {
  const { role, name } = useAuth();
  const nav = useNavigate();
  const isTab = useIsTab();
  const title = useTitle();
  return (
    <div className="app">
      <nav className="tabs">
        <div className="brand">💡 LightShop<small>{name ?? role}</small></div>
        {tabsFor(role).map((t) => (
          <NavLink key={t.to} to={t.to}><span className="ico">{t.icon}</span>{t.label}</NavLink>
        ))}
        <button onClick={() => supabase.auth.signOut()}><span className="ico">🚪</span>Logout</button>
      </nav>
      <div className="main">
        {!isTab && (
          <div className="hdr"><button onClick={() => nav(-1)}>‹ Back</button><b>{title}</b></div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
