import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, searchByPhoto, findByBarcode, findDeliveryByBarcode, learnScan } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { EXACT_MIN, EXACT_GAP, LEARN_MIN } from '../lib/config';
import { ProductRow } from '../lib/types';
import { alertBox, confirmBox } from '../lib/dialog';
import { pickFiles, toPhoto } from '../lib/image';
import ProductCard from '../components/ProductCard';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Scan() {
  const nav = useNavigate();
  const { role } = useAuth();
  const canAdd = role === 'admin' || role === 'store'; // may add products
  const [mode, setMode] = useState<'photo' | 'barcode'>('photo');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [results, setResults] = useState<ProductRow[] | null>(null);
  const [emb, setEmb] = useState<number[] | null>(null);
  const [handling, setHandling] = useState(false);

  // ---------- Photo search ----------
  async function snap() {
    const [file] = await pickFiles(true);
    if (!file) return;
    setResults(null); setBusy(true);
    try {
      const p = await toPhoto(file, 800, 0.4);
      setPhoto(p.url);
      const { rows, embedding } = await searchByPhoto(p.base64);
      const ids = rows.map((r) => r.id);
      let extra: any[] = [];
      if (ids.length) {
        const res = await supabase.from('products').select('id,category,low_stock_level,product_images(image_url)').in('id', ids);
        extra = res.data ?? [];
      }
      const map: Record<string, any> = Object.fromEntries(extra.map((e) => [e.id, e]));
      setEmb(embedding);
      setResults(rows.map((r) => ({
        ...r, category: map[r.id]?.category, low_stock_level: map[r.id]?.low_stock_level,
        thumb: map[r.id]?.product_images?.[0]?.image_url,
      })));
    } catch (e: any) { alertBox('Search failed', e.message); }
    setBusy(false);
  }
  const reset = () => { setPhoto(null); setResults(null); setEmb(null); };

  function open(item: ProductRow) {
    if (emb && (item.similarity ?? 0) >= LEARN_MIN) learnScan(item.id, emb); // teaches the app this look
    nav(`/product/${item.id}`);
  }

  const top = results?.[0], second = results?.[1];
  const exact = !!top && (top.similarity ?? 0) >= EXACT_MIN && (!second || (top.similarity ?? 0) - (second.similarity ?? 0) >= EXACT_GAP);

  // ---------- Barcode ----------
  async function onCode(code: string) {
    setHandling(true);
    try {
      const p = await findByBarcode(code);
      if (p) return nav(`/product/${p.id}`);
      const dl = role === 'admin' || role === 'sales' ? await findDeliveryByBarcode(code) : null;
      if (dl) return nav(`/delivery/${dl.id}`);
      if (canAdd && confirmBox('Barcode not found', `No product has barcode ${code}.\n\nOK = add a product with this barcode\nCancel = scan again`)) {
        return nav('/add', { state: { barcode: code } });
      }
      if (!canAdd) alertBox('Barcode not found', `No product has barcode ${code}.`);
    } catch (e: any) { alertBox('Error', e.message); }
    setHandling(false);
  }

  return (
    <div className="page">
      <h1>Find Product</h1>
      <div className="seg">
        {(['photo', 'barcode'] as const).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'photo' ? '📷 Photo' : '▮▯▮ Barcode'}</button>
        ))}
      </div>

      {mode === 'photo' ? (
        <div className="mt16">
          {!photo ? (
            <div className="hero">
              <button className="camBtn" onClick={snap}>📷</button>
              <div className="name mt12" style={{ fontSize: 18 }}>Tap to scan</div>
              <div className="muted tc mt12" style={{ background: 'var(--bg)', borderRadius: 12, padding: 12, fontSize: 13 }}>
                • Keep the light in the centre<br />• Use good lighting, avoid shadows<br />• One product per photo
              </div>
            </div>
          ) : (
            <div className="card row">
              <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover' }} />
              <div className="f1 ml8" style={{ marginLeft: 14 }}>
                <div className="name">{busy ? 'Searching…' : 'Your photo'}</div>
                <div className="row mt12">
                  <button className="btn auto mr8" onClick={snap}>Retake</button>
                  <button className="btn auto grayl" onClick={reset}>Clear</button>
                </div>
              </div>
            </div>
          )}
          {busy && <div className="spinner" />}
          {results && !busy && results.length > 0 && (
            <div className="card mt16" style={{ background: exact ? 'var(--greenBg)' : 'var(--amberBg)', color: exact ? 'var(--green)' : 'var(--amber)', fontWeight: 800 }}>
              {exact ? '✓ Exact match found' : 'Not sure. Please check the matches and pick the right one.'}
            </div>
          )}
          {!busy && results?.map((item, i) => (
            <ProductCard key={item.id} item={item} match={item.similarity} badge={i === 0 ? (exact ? 'exact' : 'best') : undefined} onPress={() => open(item)} />
          ))}
          {results && !busy && results.length === 0 && (
            <div className="tc" style={{ padding: 30 }}>
              <div style={{ fontSize: 40 }}>🔍</div>
              <div className="name mt8">No product found</div>
              <div className="muted">Try another angle, scan the barcode, or use the Search tab.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt16">
          <div className="camwrap">
            <BarcodeScanner active={!handling} onScanned={onCode} />
            {handling && <div className="busyov"><div className="spinner" /></div>}
          </div>
          <div className="muted tc mt12" style={{ fontSize: 13 }}>Point the camera at the barcode or QR sticker. Product details open automatically.</div>
        </div>
      )}
    </div>
  );
}
