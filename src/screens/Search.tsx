import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ProductRow } from '../lib/types';
import ProductCard from '../components/ProductCard';

const COLS = 'id,sku,name,price,stock,low_stock_level,category,product_images(image_url)';

export default function Search() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      const clean = q.trim().replace(/[,()%]/g, ' ');
      let query = supabase.from('products').select(COLS).limit(30);
      query = clean.length >= 1
        ? query.or(`name.ilike.%${clean}%,sku.ilike.%${clean}%,barcode.ilike.%${clean}%,category.ilike.%${clean}%,model.ilike.%${clean}%,color.ilike.%${clean}%,wattage.ilike.%${clean}%`)
        : query.order('created_at', { ascending: false });
      const { data } = await query;
      setRows((data ?? []).map((p: any) => ({ ...p, thumb: p.product_images?.[0]?.image_url })));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="page">
      <h1 className="mb12">Search</h1>
      <div className="row card" style={{ padding: '0 14px', marginBottom: 0 }}>
        <span style={{ marginRight: 8 }}>🔍</span>
        <input className="input nm f1" style={{ border: 0, background: 'none', padding: '13px 0' }}
          placeholder="Name, SKU, barcode, category, colour, watt" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        {q && <button onClick={() => setQ('')} style={{ color: 'var(--sub)', paddingLeft: 8 }}>✕</button>}
      </div>
      <div className="muted mt12 mb12" style={{ fontSize: 13, fontWeight: 600 }}>
        {loading ? 'Searching…' : q ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : 'Recently added'}
      </div>
      {loading && rows.length === 0 ? <div className="spinner" /> : rows.length === 0 ? (
        <div className="tc" style={{ padding: 40 }}>
          <div style={{ fontSize: 40 }}>💡</div>
          <div className="name mt8">No products found</div>
          <div className="muted">Check the spelling or try a SKU.</div>
        </div>
      ) : <div className="cards">{rows.map((item) => <ProductCard key={item.id} item={item} onPress={() => nav(`/product/${item.id}`)} />)}</div>}
    </div>
  );
}
