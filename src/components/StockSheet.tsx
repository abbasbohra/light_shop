import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { alertBox } from '../lib/dialog';
import Chips from './Chips';
import Sheet from './Sheet';

type Mode = 'add' | 'set';
type Props = { product: { id: string; name: string; stock: number } | null; onClose: () => void; onSaved: () => void };

// Admin / store window: add received stock, or set the exact counted stock.
export default function StockSheet({ product, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('add');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [hist, setHist] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    setMode('add'); setQty(''); setNote(''); setHist([]);
    supabase.from('stock_movements').select('change,reason,note,created_at')
      .eq('product_id', product.id).order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setHist(data ?? []));
  }, [product?.id]);

  async function save() {
    if (!product) return;
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 0 || (mode === 'add' && n === 0)) return alertBox('Enter a valid number');
    setBusy(true);
    try {
      if (mode === 'add') await api.adjustStock(product.id, n, 'purchase', note.trim() || undefined);
      else await api.setStock(product.id, n, note.trim() || undefined);
      onSaved();
      onClose();
    } catch (e: any) { alertBox('Could not update stock', e.message); }
    setBusy(false);
  }

  return (
    <Sheet visible={!!product} onClose={onClose} title={product?.name ?? ''}>
      <div className="muted mb12">Current stock: {product?.stock}</div>
      <Chips<Mode> value={mode} onChange={setMode}
        options={[{ key: 'add', label: '+ Add stock' }, { key: 'set', label: 'Set exact count' }]} />
      <label className="label">{mode === 'add' ? 'Quantity received' : 'Counted stock'}</label>
      <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="0" />
      <label className="label">Note (optional)</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier invoice 123" />
      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      {hist.length > 0 && (
        <div className="mt16">
          <div className="label mb8">Recent changes</div>
          {hist.map((h, i) => (
            <div key={i} className="row sb" style={{ padding: '6px 0' }}>
              <span className="f1" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.reason}{h.note ? ` · ${h.note}` : ''}</span>
              <b style={{ color: h.change < 0 ? 'var(--red)' : 'var(--green)' }}>{h.change > 0 ? '+' : ''}{h.change}</b>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
