import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { alertBox } from '../lib/dialog';
import { stockInfo } from '../lib/ui';
import BarcodeView from '../components/BarcodeView';
import { Pill } from '../components/ProductCard';
import StockSheet from '../components/StockSheet';

export default function Product() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { isAdmin, role } = useAuth();
  const canStock = role === 'admin' || role === 'store'; // add / update stock, barcode, variants
  const canSell = role === 'admin' || role === 'sales';
  const [p, setP] = useState<any>(null);
  const [sibs, setSibs] = useState<any[]>([]);
  const [imgs, setImgs] = useState<string[]>([]);
  const [cost, setCost] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').eq('id', id).single();
    setP(data);
    if (data?.model) {
      let sq = supabase.from('products').select('id,sku,color,size,wattage,stock').eq('model', data.model).neq('id', data.id).order('name');
      sq = data.category ? sq.eq('category', data.category) : sq.is('category', null);
      setSibs((await sq).data ?? []);
    } else setSibs([]);
    const im = await supabase.from('product_images').select('image_url').eq('product_id', id);
    setImgs((im.data ?? []).map((i: any) => i.image_url));
    if (isAdmin) {
      const c = await supabase.from('product_costs').select('cost_price').eq('product_id', id).maybeSingle();
      setCost(c.data?.cost_price ?? null);
    }
  }, [id, isAdmin]);
  useEffect(() => { load(); }, [load]);

  async function change(qty: number, reason: string) {
    const { error } = await supabase.rpc('adjust_stock', { p_id: id, qty, p_reason: reason });
    if (error) alertBox('Error', error.message); else load();
  }
  // attach another colour / size / wattage to this lamp model
  async function addVariant() {
    try {
      const model = p.model || p.name;
      if (!p.model) await supabase.from('products').update({ model }).eq('id', p.id);
      nav('/add', { state: { category: p.category ?? undefined, model } });
    } catch (e: any) { alertBox('Error', e.message); }
  }
  async function makeBarcode() {
    try { await api.generateBarcode(id); load(); } catch (e: any) { alertBox('Could not generate barcode', e.message); }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ text: p.barcode }); } catch (_) {} }
    else { await navigator.clipboard?.writeText(p.barcode); alertBox('Barcode number copied'); }
  }

  if (!p) return <div className="spinner" />;
  const rows: [string, string | null][] = [
    ['Model', p.model], ['SKU', p.sku], ['Barcode', p.barcode], ['Category', p.category], ['Wattage', p.wattage],
    ['Size', p.size], ['Colour', p.color], ['Shelf location', p.location],
  ];

  return (
    <div className="page">
      {imgs.length > 0 && <div className="scroll-x">{imgs.map((u, k) => <img key={k} className="photo" src={u} alt="" />)}</div>}
      <div className="card mt12">
        <div style={{ fontSize: 22, fontWeight: 800 }}>{p.name}</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>₹{p.price}</div>
        <div className="mt8"><Pill {...stockInfo(p.stock, p.low_stock_level)} /></div>
      </div>

      <div className="card">
        <div className="section" style={{ fontSize: 15, marginTop: 0 }}>Details</div>
        {rows.filter((r) => r[1]).map(([k, v]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>)}
        {p.description && <div className="muted mt12" style={{ fontSize: 14, lineHeight: 1.4 }}>{p.description}</div>}
      </div>

      {sibs.length > 0 && (
        <div className="card">
          <div className="section" style={{ fontSize: 15, marginTop: 0 }}>Other variants of {p.model}</div>
          {sibs.map((s) => (
            <button key={s.id} className="kv" style={{ width: '100%' }} onClick={() => nav(`/product/${s.id}`)}>
              <span className="k">{[s.color, s.size, s.wattage].filter(Boolean).join(' · ') || s.sku}</span>
              <span className="v">{s.stock} in stock ›</span>
            </button>
          ))}
        </div>
      )}

      {canStock && (
        <div className="card">
          <div className="section" style={{ fontSize: 15, marginTop: 0 }}>Barcode label</div>
          {p.barcode ? (
            <>
              <BarcodeView code={p.barcode} />
              <div className="muted tc mt12">Take a screenshot or print this page to make a label, or share the number to your label printer app.</div>
              <div className="row mt12" style={{ justifyContent: 'center', gap: 20 }}>
                <button className="link" onClick={share}>Share barcode number</button>
                <button className="link" onClick={() => window.print()}>Print</button>
              </div>
            </>
          ) : <button className="btn accent" style={{ marginTop: 0 }} onClick={makeBarcode}>▮▯▮ Generate barcode</button>}
        </div>
      )}

      {isAdmin && cost !== null && (
        <div className="card">
          <div className="section" style={{ fontSize: 15, marginTop: 0 }}>Admin only</div>
          <div className="kv"><span className="k">Cost price</span><span className="v">₹{cost}</span></div>
          <div className="kv"><span className="k">Margin</span><span className="v">₹{(p.price - cost).toFixed(0)}</span></div>
        </div>
      )}

      {canStock && <button className="btn outline" onClick={addVariant}>＋ Add another variant of this model</button>}
      <div className="row gap8 mt8">
        {canSell && <button className="btn f1" onClick={() => change(-1, 'sale')}>Sold 1</button>}
        {canStock && <button className="btn green f1" onClick={() => setSheet(true)}>＋ Add / Update Stock</button>}
      </div>
      {canStock && <StockSheet product={sheet ? { id: p.id, name: p.name, stock: p.stock } : null} onClose={() => setSheet(false)} onSaved={load} />}
    </div>
  );
}
