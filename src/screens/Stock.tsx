import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NO_CATEGORY } from '../lib/config';
import { alertBox } from '../lib/dialog';
import { stockInfo } from '../lib/ui';
import { Pill } from '../components/ProductCard';
import { useIsTab } from '../components/Layout';

type Group = { key: string; name: string; total: number; units: number; low: number; out: number };

// Step 1 of Manage Stock: pick a category
export default function Stock() {
  const nav = useNavigate();
  const isTab = useIsTab();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.from('products').select('id,sku,name,stock,low_stock_level,category,barcode').order('name').limit(2000)
      .then(({ data, error }) => { if (error) alertBox('Error', error.message); setRows(data ?? []); });
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    rows.forEach((r) => {
      const key = (r.category ?? '').trim() || NO_CATEGORY;
      const g = m.get(key) ?? { key, name: key === NO_CATEGORY ? 'Uncategorised' : key, total: 0, units: 0, low: 0, out: 0 };
      g.total++; g.units += r.stock;
      if (r.stock <= 0) g.out++; else if (r.stock <= (r.low_stock_level ?? 5)) g.low++;
      m.set(key, g);
    });
    return [...m.values()].sort((a, b) => (a.key === NO_CATEGORY ? 1 : 0) - (b.key === NO_CATEGORY ? 1 : 0) || a.name.localeCompare(b.name));
  }, [rows]);

  const term = q.trim().toLowerCase();
  const found = term ? rows.filter((r) => `${r.name} ${r.sku} ${r.category ?? ''} ${r.barcode ?? ''}`.toLowerCase().includes(term)) : [];

  return (
    <div className="page">
      {isTab && <h1 className="mb12">Stock</h1>}
      <input className="input" placeholder="Search any product, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
      {term ? (
        found.length === 0 ? <div className="empty">No products found</div> : <div className="cards">{found.map((item) => (
          <button key={item.id} className="card click row" onClick={() => nav(`/product/${item.id}`)}>
            <div className="f1 mr8"><div className="name">{item.name}</div><div className="muted">{item.sku} · {item.category || 'Uncategorised'}</div></div>
            <Pill {...stockInfo(item.stock, item.low_stock_level)} />
          </button>
        ))}</div>
      ) : (
        <div className="cards">
          <button className="card click dark row" onClick={() => nav('/stock/products')}>
            <span style={{ fontSize: 28, marginRight: 14 }}>📦</span>
            <div className="f1"><div className="name">All products</div><div className="muted" style={{ color: '#CBD5E1' }}>{rows.length} products in {groups.length} categories</div></div>
            <span className="chev" style={{ color: '#CBD5E1' }}>›</span>
          </button>
          {groups.length === 0 && <div className="empty">No products yet. Add one from the Add Product tab.</div>}
          {groups.map((g) => (
            <button key={g.key} className="card click row" onClick={() => nav(`/stock/products?category=${encodeURIComponent(g.key)}`)}>
              <span style={{ fontSize: 28, marginRight: 14 }}>🗂️</span>
              <div className="f1">
                <div className="name">{g.name}</div>
                <div className="muted">{g.total} product{g.total === 1 ? '' : 's'} · {g.units} units</div>
                {(g.low > 0 || g.out > 0) && (
                  <div className="row mt8">
                    {g.low > 0 && <Pill label={`${g.low} low`} fg="var(--amber)" bg="var(--amberBg)" />}
                    {g.out > 0 && <Pill label={`${g.out} out`} fg="var(--red)" bg="var(--redBg)" />}
                  </div>
                )}
              </div>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
