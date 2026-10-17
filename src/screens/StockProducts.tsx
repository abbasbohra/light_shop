import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { NO_CATEGORY } from '../lib/config';
import { alertBox } from '../lib/dialog';
import { stockInfo } from '../lib/ui';
import { Pill } from '../components/ProductCard';
import Chips from '../components/Chips';

type Filter = 'all' | 'low' | 'out';
const label = (r: any) => [r.color, r.size, r.wattage].filter(Boolean).join(' · ');

// Step 2 of Manage Stock:
//  - inside a category -> list of MODELS (a model with one version opens straight to its details)
//  - inside a model    -> list of its VARIANTS (colour / size / wattage)
//  - from the dashboard low/out cards -> flat list of variants
export default function StockProducts() {
  const nav = useNavigate();
  const { role } = useAuth();
  const canAdd = role === 'admin' || role === 'store';
  const [sp] = useSearchParams();
  const cat = sp.get('category') ?? undefined;
  const model = sp.get('model') ?? undefined;
  const pf = sp.get('filter') as Filter | null;
  const flat = !!model || !!pf;
  const [filter, setFilter] = useState<Filter>(pf ?? 'all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let query = supabase.from('products')
      .select('id,sku,name,model,category,color,size,wattage,price,stock,low_stock_level,barcode').order('name').limit(2000);
    if (cat === NO_CATEGORY) query = query.or('category.is.null,category.eq.');
    else if (cat) query = query.eq('category', cat);
    if (model) query = query.eq('model', model);
    query.then(({ data, error }) => { if (error) alertBox('Error', error.message); setRows(data ?? []); });
  }, [cat, model]);

  const shown = rows.filter((r) => {
    const low = r.low_stock_level ?? 5;
    const okFilter = filter === 'all' || (filter === 'out' ? r.stock <= 0 : r.stock > 0 && r.stock <= low);
    const okText = !q || `${r.name} ${r.model ?? ''} ${r.sku} ${r.barcode ?? ''}`.toLowerCase().includes(q.toLowerCase());
    return okFilter && okText;
  });

  const groups = useMemo(() => {
    type G = { key: string; title: string; category: string | null; model: string; items: any[] };
    const m = new Map<string, G>();
    shown.forEach((r) => {
      const mm = (r.model ?? '').trim();
      const key = mm ? `m:${r.category}|${mm}` : `s:${r.id}`;
      const g: G = m.get(key) ?? { key, title: mm || r.name, category: r.category, model: mm, items: [] as any[] };
      g.items.push(r);
      m.set(key, g);
    });
    return [...m.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [shown]);

  const addHere = () => nav('/add', { state: { category: cat && cat !== NO_CATEGORY ? cat : undefined, model } });

  return (
    <div className="page">
      {(cat || model) && canAdd && (
        <button className="btn accent mb12" style={{ marginTop: 0 }} onClick={addHere}>
          {model ? '＋ Add another variant' : '＋ Add product / model here'}
        </button>
      )}
      <input className="input" placeholder="Search name, model, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips<Filter> value={filter} onChange={setFilter}
        options={[{ key: 'all', label: 'All' }, { key: 'low', label: 'Low stock' }, { key: 'out', label: 'Out of stock' }]} />

      {(flat ? shown.length : groups.length) === 0 && <div className="empty">No products here</div>}

      <div className="cards">
      {flat ? shown.map((item) => (
        <button key={item.id} className="card click row" onClick={() => nav(`/product/${item.id}`)}>
          <div className="f1 mr8">
            <div className="name">{model ? (label(item) || item.name) : item.name}</div>
            <div className="muted">{item.sku}{model ? ` · ₹${item.price}` : item.category ? ` · ${item.category}` : ''}</div>
            <div className="muted" style={{ color: item.barcode ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>
              {item.barcode ? '▮▯▮ Barcode ready' : 'No barcode yet'}
            </div>
          </div>
          <Pill {...stockInfo(item.stock, item.low_stock_level)} />
          <span className="chev">›</span>
        </button>
      )) : groups.map((g) => {
        const units = g.items.reduce((s, r) => s + r.stock, 0);
        const low = g.items.filter((r) => r.stock > 0 && r.stock <= (r.low_stock_level ?? 5)).length;
        const out = g.items.filter((r) => r.stock <= 0).length;
        const single = g.items.length === 1;
        return (
          <button key={g.key} className="card click row" onClick={() => single ? nav(`/product/${g.items[0].id}`)
            : nav(`/stock/products?category=${encodeURIComponent(g.category || NO_CATEGORY)}&model=${encodeURIComponent(g.model)}`)}>
            <div className="f1 mr8">
              <div className="name">{g.title}</div>
              <div className="muted">{single ? `${g.items[0].sku} · ${units} in stock` : `${g.items.length} variants · ${units} units`}</div>
              {(low > 0 || out > 0) && (
                <div className="row mt8">
                  {low > 0 && <Pill label={`${low} low`} fg="var(--amber)" bg="var(--amberBg)" />}
                  {out > 0 && <Pill label={`${out} out`} fg="var(--red)" bg="var(--redBg)" />}
                </div>
              )}
            </div>
            {single && <Pill {...stockInfo(g.items[0].stock, g.items[0].low_stock_level)} />}
            <span className="chev">›</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
