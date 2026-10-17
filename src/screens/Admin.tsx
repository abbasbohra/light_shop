import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { alertBox } from '../lib/dialog';

export default function Admin() {
  const nav = useNavigate();
  const { name } = useAuth();
  const [s, setS] = useState<any>(null);

  useEffect(() => { api.summary().then(setS).catch((e) => alertBox('Error', e.message)); }, []);

  const stats: [string, any, string, string][] = [
    ['Products', s?.products, 'var(--ink)', '/stock'],
    ['Low stock', s?.low_stock, 'var(--amber)', '/stock/products?filter=low'],
    ['Out of stock', s?.out_of_stock, 'var(--red)', '/stock/products?filter=out'],
    ['To dispatch', s?.pending_deliveries, 'var(--blue)', '/deliveries'],
    ['Out for delivery', s?.out_for_delivery, 'var(--purple)', '/deliveries'],
    ['Delivered today', s?.delivered_today, 'var(--green)', '/deliveries'],
  ];
  const links: [string, string, string, string][] = [
    ['📦', 'Manage Stock', 'Browse by category, add stock, barcodes', '/stock'],
    ['🚚', 'Deliveries', 'Create, assign and track deliveries', '/deliveries'],
    ['👥', 'Users & Roles', 'Add staff, set role and permissions', '/users'],
  ];

  return (
    <div className="page">
      <h1>Admin Panel</h1>
      <div className="sub">{name ? `Welcome, ${name}` : 'Stock, deliveries and users'}</div>
      <div className="grid2">
        {stats.map(([label, val, color, to]) => (
          <button key={label} className="stat" onClick={() => nav(to)}>
            <div className="num" style={{ color }}>{val ?? '–'}</div>
            <div className="lbl">{label}</div>
          </button>
        ))}
      </div>
      <div className="card mt12">
        <div className="muted">Stock value (at cost price)</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>₹{Math.round(s?.stock_value ?? 0).toLocaleString('en-IN')}</div>
      </div>
      <div className="section">Manage</div>
      <div className="cards">{links.map(([icon, title, desc, to]) => (
        <button key={to} className="card click row" onClick={() => nav(to)}>
          <span style={{ fontSize: 28, marginRight: 14 }}>{icon}</span>
          <div className="f1"><div className="name">{title}</div><div className="muted">{desc}</div></div>
          <span className="chev">›</span>
        </button>
      ))}</div>
    </div>
  );
}
