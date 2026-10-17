import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { NO_CATEGORY } from '../lib/config';
import { Coords } from '../lib/location';
import { alertBox } from '../lib/dialog';
import { AppUser } from '../lib/types';
import Chips from '../components/Chips';
import LocationPicker from '../components/LocationPicker';
import ScanModal from '../components/ScanModal';

type Prod = {
  id: string; name: string; model: string | null; category: string | null; sku: string; barcode: string | null;
  color: string | null; size: string | null; wattage: string | null; price: number; stock: number;
};
type Item = { id: string; name: string; model: string | null; sku: string; variant: string; price: number; stock: number; qty: number };

const COLS = 'id,name,model,category,sku,barcode,color,size,wattage,price,stock';
const variantOf = (p: Prod) => [p.color, p.size, p.wattage].filter(Boolean).join(' · ');
const catKey = (p: Prod) => (p.category ?? '').trim() || NO_CATEGORY;
const modelKey = (p: Prod) => (p.model ?? '').trim() || p.name; // a product without a model counts as its own model

export default function NewDelivery() {
  const nav = useNavigate();
  const { role } = useAuth();
  const [f, setF] = useState({ name: '', phone: '', address: '', landmark: '', city: '', pincode: '', notes: '' });
  const [loc, setLoc] = useState<Coords | null>(null);
  const [catalog, setCatalog] = useState<Prod[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [selId, setSelId] = useState('');
  const [qty, setQty] = useState('1');
  const [cart, setCart] = useState<Item[]>([]);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from('products').select(COLS).order('name').limit(2000).then(({ data, error }) => {
      if (error) alertBox('Could not load products', error.message);
      setCatalog((data ?? []) as Prod[]);
    });
  }, []);
  useEffect(() => {
    if (role !== 'admin') return;
    api.users.list().then((u) => setStaff(u.filter((x) => x.role === 'delivery' && x.active))).catch(() => {});
  }, [role]);

  // step-by-step picker: category -> model -> variant
  const categories = useMemo(() => {
    const keys = Array.from(new Set(catalog.map(catKey)));
    return keys.sort((a, b) => (a === NO_CATEGORY ? 1 : 0) - (b === NO_CATEGORY ? 1 : 0) || a.localeCompare(b))
      .map((k) => ({ key: k, label: k === NO_CATEGORY ? 'Uncategorised' : k }));
  }, [catalog]);
  const models = useMemo(() => Array.from(new Set(catalog.filter((p) => catKey(p) === category).map(modelKey))).sort(), [catalog, category]);
  const variants = useMemo(() => catalog.filter((p) => catKey(p) === category && modelKey(p) === model), [catalog, category, model]);
  const sel = catalog.find((p) => p.id === selId) ?? null;
  const selQty = parseInt(qty, 10) || 0;

  const term = q.trim().toLowerCase();
  const found = term.length < 2 ? [] : catalog.filter((p) => `${p.name} ${p.model ?? ''} ${p.sku} ${p.barcode ?? ''}`.toLowerCase().includes(term)).slice(0, 8);

  function choose(p: Prod) { // from search or barcode scan: fills the pickers below
    if (p.stock <= 0) return alertBox('Out of stock', `${p.name} has no stock.`);
    setCategory(catKey(p)); setModel(modelKey(p)); setSelId(p.id); setQty('1'); setQ('');
  }
  function pickCategory(k: string) { setCategory(k); setModel(''); setSelId(''); }
  function pickModel(m: string) {
    setModel(m); setQty('1');
    const vs = catalog.filter((p) => catKey(p) === category && modelKey(p) === m);
    setSelId(vs.length === 1 && vs[0].stock > 0 ? vs[0].id : ''); // single version: select it straight away
  }
  function pickVariant(p: Prod) {
    if (p.stock <= 0) return alertBox('Out of stock', `${p.name} has no stock.`);
    setSelId(p.id); setQty('1');
  }
  const bump = (d: number) => setQty(String(Math.max(1, Math.min(sel?.stock ?? 1, (parseInt(qty, 10) || 0) + d))));

  function addToCart() {
    if (!sel) return alertBox('Choose a product first');
    if (selQty < 1) return alertBox('Enter the quantity');
    const inCart = cart.find((i) => i.id === sel.id)?.qty ?? 0;
    if (inCart + selQty > sel.stock) {
      return alertBox('Not enough stock', `Only ${sel.stock} available${inCart ? ` (${inCart} already added)` : ''}.`);
    }
    setCart((c) => inCart
      ? c.map((i) => (i.id === sel.id ? { ...i, qty: i.qty + selQty } : i))
      : [...c, { id: sel.id, name: sel.name, model: sel.model, sku: sel.sku, variant: variantOf(sel), price: sel.price, stock: sel.stock, qty: selQty }]);
    setSelId(''); setQty('1'); // category and model stay, so the next variant is quick to add
  }

  const setItemQty = (id: string, v: string) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: parseInt(v.replace(/\D/g, ''), 10) || 0 } : i)));
  const fixItemQty = (id: string) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(i.stock, i.qty)) } : i)));
  const remove = (id: string) => setCart((c) => c.filter((i) => i.id !== id));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  function onScan(code: string) {
    setScanOpen(false);
    const p = catalog.find((x) => x.barcode === code.trim());
    if (!p) return alertBox('Not found', `No product has barcode ${code}.`);
    choose(p);
  }

  async function submit() {
    if (!f.name.trim() || !f.address.trim()) return alertBox('Customer name and address are required');
    if (f.pincode && !/^\d{6}$/.test(f.pincode)) return alertBox('Pincode must be 6 digits');
    if (cart.length === 0) return alertBox('Add at least one product');
    const bad = cart.find((i) => i.qty < 1 || i.qty > i.stock);
    if (bad) return alertBox('Check the quantity', `${bad.name}: enter a quantity from 1 to ${bad.stock}.`);
    setBusy(true);
    try {
      const id = await api.createDelivery(
        { ...f, lat: loc?.lat, lng: loc?.lng, assignTo: assignTo || undefined },
        cart.map((i) => ({ product_id: i.id, qty: i.qty })),
      );
      nav(`/delivery/${id}`, { replace: true });
    } catch (e: any) { alertBox('Could not create delivery', e.message); }
    setBusy(false);
  }

  // called as a function (not a component) so inputs keep focus while typing
  const inp = (label: string, k: keyof typeof f, extra: any = {}) => (
    <div>
      <label className="label">{label}</label>
      {extra.multiline
        ? <textarea className="input" value={f[k]} onChange={(e) => set(k)(e.target.value)} />
        : <input className="input" value={f[k]} onChange={(e) => set(k)(e.target.value)} {...extra} />}
    </div>
  );
  const info = (k: string, v: string | number | null | undefined) => v ? (
    <div className="row sb" style={{ padding: '4px 0' }}>
      <span className="muted">{k}</span><b style={{ textAlign: 'right', marginLeft: 12 }}>{v}</b>
    </div>
  ) : null;

  return (
    <div className="page cardin">
      <div className="card">
        <div className="name mb12">1. Customer and address</div>
        {inp('Customer name *', 'name')}
        {inp('Phone', 'phone', { type: 'tel' })}
        {inp('Address (house / shop, street, area) *', 'address', { multiline: true })}
        {inp('Landmark', 'landmark', { placeholder: 'e.g. Near City Mall' })}
        <div className="two">
          {inp('City', 'city')}
          {inp('Pincode', 'pincode', { inputMode: 'numeric', maxLength: 6 })}
        </div>
      </div>

      <div className="card">
        <div className="name mb12">2. Delivery location</div>
        <LocationPicker value={loc} onChange={setLoc} />
        <div className="muted mt8">With a location saved, the delivery person can only mark it delivered after reaching the place.</div>
      </div>

      <div className="card">
        <div className="name mb12">3. Add product to deliver</div>
        <label className="label">Quick find</label>
        <div className="row gap8">
          <input className="input nm f1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, model, SKU or barcode" />
          <button className="btn auto accent" onClick={() => setScanOpen(true)}>▮ Scan</button>
        </div>
        {found.map((p) => (
          <button key={p.id} className="row" style={{ width: '100%', textAlign: 'left', padding: '10px 0', borderBottom: '1px solid var(--line)' }} onClick={() => choose(p)}>
            <div className="f1">
              <b>{p.name}</b>
              <div className="muted">{[p.model, variantOf(p), p.sku].filter(Boolean).join(' · ')} · {p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}</div>
            </div>
            <b>Select</b>
          </button>
        ))}

        <label className="label mt16">Category</label>
        <Chips<string> value={category} onChange={pickCategory} options={categories} />
        {category !== '' && (<>
          <label className="label">Model</label>
          <Chips<string> value={model} onChange={pickModel} options={models.map((m) => ({ key: m, label: m }))} />
        </>)}
        {model !== '' && variants.length > 1 && (<>
          <label className="label">Variant (colour · size · wattage)</label>
          <div className="chips">
            {variants.map((p) => {
              const on = p.id === selId, out = p.stock <= 0;
              return (
                <button key={p.id} className={`chip${on ? ' on' : ''}`} style={out ? { opacity: 0.45 } : undefined} onClick={() => pickVariant(p)}>
                  {variantOf(p) || p.sku} · {out ? 'out' : `${p.stock} left`}
                </button>
              );
            })}
          </div>
        </>)}

        {sel && (
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 12, marginTop: 4 }}>
            <div className="label" style={{ marginBottom: 6 }}>Selected product</div>
            {info('Product', sel.name)}{info('Model', sel.model)}{info('Variant', variantOf(sel))}
            {info('SKU', sel.sku)}{info('Price', `₹${sel.price}`)}{info('Available', `${sel.stock} in stock`)}
            <label className="label mt12">Quantity</label>
            <div className="row">
              <button className="btn grayl auto" style={{ width: 40, height: 40, padding: 0, fontSize: 20 }} onClick={() => bump(-1)}>−</button>
              <input className="input nm" style={{ width: 80, textAlign: 'center', fontWeight: 800, margin: '0 6px', background: '#fff' }}
                value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
              <button className="btn grayl auto" style={{ width: 40, height: 40, padding: 0, fontSize: 20 }} onClick={() => bump(1)}>+</button>
              <b className="f1 tr" style={{ fontSize: 16 }}>₹{selQty * sel.price}</b>
            </div>
            <button className="btn green" onClick={addToCart}>＋ Add to delivery</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="name mb8">Products in this delivery</div>
        <div className="muted">{cart.length} product{cart.length === 1 ? '' : 's'} · {cart.reduce((s, i) => s + i.qty, 0)} items</div>
        {cart.length === 0 && <div className="empty" style={{ marginTop: 14, marginBottom: 6 }}>Nothing added yet</div>}
        {cart.map((i) => (
          <div key={i.id} className="item" style={{ padding: '10px 0' }}>
            <div className="row sb">
              <b className="f1 mr8">{i.name}</b>
              <button onClick={() => remove(i.id)} style={{ color: 'var(--red)', fontSize: 16 }} aria-label="Remove">✕</button>
            </div>
            <div className="muted">{[i.model && `Model: ${i.model}`, i.variant, i.sku].filter(Boolean).join(' · ')}</div>
            <div className="row mt8">
              <span className="muted">Qty</span>
              <input className="input nm" style={{ width: 70, marginLeft: 8, padding: '6px 12px', textAlign: 'center', fontWeight: 800 }}
                value={String(i.qty)} inputMode="numeric" onChange={(e) => setItemQty(i.id, e.target.value)} onBlur={() => fixItemQty(i.id)} />
              <span className="muted ml8">× ₹{i.price} (max {i.stock})</span>
              <b className="f1 tr">₹{i.qty * i.price}</b>
            </div>
          </div>
        ))}
        {cart.length > 0 && <div className="tr mt12" style={{ fontSize: 18, fontWeight: 800 }}>Total ₹{total}</div>}
      </div>

      {role === 'admin' && (
        <div className="card">
          <div className="name mb12">4. Delivery person</div>
          {staff.length === 0 ? <div className="muted">No delivery users yet. Add one in Admin → Users & Roles, or assign later.</div> : (
            <Chips<string> value={assignTo} onChange={setAssignTo}
              options={[{ key: '', label: 'Assign later' }, ...staff.map((u) => ({ key: u.id, label: u.full_name || u.email }))]} />
          )}
        </div>
      )}

      <div className="card">{inp('Notes for the delivery person', 'notes', { placeholder: 'e.g. Call before arriving' })}</div>

      <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Delivery'}</button>
      <div className="muted tc mt12">Stock is reduced as soon as the delivery is created. A delivery barcode is made automatically.</div>
      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScan} />
    </div>
  );
}
