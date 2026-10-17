import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, embedImage, findByBarcode } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { alertBox, confirmBox } from '../lib/dialog';
import { Photo, pickFiles, toPhoto } from '../lib/image';
import ScanModal from '../components/ScanModal';

const CATEGORIES = ['Chandelier', 'Pendant', 'Wall Light', 'Table Lamp', 'Floor Lamp', 'Night Lamp', 'String Light', 'Other'];
const MAX_PHOTOS = 8;

type FieldProps = { label: string; value?: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string; multiline?: boolean; upper?: boolean; onBlur?: () => void };
function Field({ label, value, onChange, multiline, numeric, upper, ...rest }: FieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      {multiline
        ? <textarea className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        : <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} inputMode={numeric ? 'numeric' : undefined}
            style={upper ? { textTransform: 'uppercase' } : undefined} {...rest} />}
    </div>
  );
}

export default function AddProduct() {
  const nav = useNavigate();
  const loc = useLocation();
  const st = (loc.state ?? {}) as { barcode?: string; category?: string; model?: string };
  const { isAdmin } = useAuth();
  const [f, setF] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [existing, setExisting] = useState<{ id: string; name: string; barcode: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [autoCode, setAutoCode] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // barcode from the Scan screen ("Barcode not found -> Add product"), or category/model from "Add another variant"
  useEffect(() => {
    setF((p) => ({ ...p, ...(st.barcode ? { barcode: st.barcode } : {}), ...(st.category ? { category: st.category } : {}), ...(st.model ? { model: st.model } : {}) }));
  }, [st.barcode, st.category, st.model]);

  // models that already exist in the chosen category
  useEffect(() => {
    const cat = (f.category ?? '').trim();
    if (!cat) { setModels([]); return; }
    supabase.from('products').select('model').eq('category', cat).not('model', 'is', null).limit(1000)
      .then(({ data }) => setModels(Array.from(new Set((data ?? []).map((r: any) => r.model as string).filter(Boolean))).sort()));
  }, [f.category]);

  async function checkSku() {
    const sku = (f.sku ?? '').trim();
    if (!sku) return setExisting(null);
    const { data } = await supabase.from('products').select('id,name,barcode').eq('sku', sku).maybeSingle();
    setExisting(data ?? null);
  }

  async function addFiles(files: File[]) {
    try {
      const ps = await Promise.all(files.map((x) => toPhoto(x, 800, 0.4)));
      setPhotos((p) => [...p, ...ps].slice(0, MAX_PHOTOS));
    } catch (e: any) { alertBox('Photo error', e.message); }
  }
  const takePhoto = async () => addFiles(await pickFiles(true));
  const pickPhotos = async () => addFiles((await pickFiles(false, true)).slice(0, MAX_PHOTOS - photos.length));
  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, k) => k !== i));
  const reset = () => { setF({}); setPhotos([]); setExisting(null); setProgress(''); };

  async function save() {
    const sku = (f.sku ?? '').trim();
    const barcode = (f.barcode ?? '').trim();
    if (!sku) return alertBox('SKU is required');
    if (photos.length === 0) return alertBox('Add at least 1 photo', '3-5 photos from different angles give the best search results.');
    if (!existing && (!(f.name || f.model) || !f.price)) return alertBox('Enter a name or a model, and the price');
    if (!existing && !(f.category ?? '').trim()) return alertBox('Choose a category', 'Pick one, or type a new category.');

    setBusy(true);
    try {
      if (barcode) {
        const owner = await findByBarcode(barcode);
        if (owner && owner.id !== existing?.id) throw new Error(`Barcode ${barcode} is already used by "${owner.name}".`);
      }
      const variant = [f.color, f.size, f.wattage].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ');
      const modelName = (f.model ?? '').trim();
      let finalName = (f.name ?? '').trim() || modelName;
      if (modelName && finalName === modelName && variant) finalName = `${modelName} – ${variant}`;
      let pid = existing?.id;
      if (!existing) {
        setProgress('Saving product details…');
        const { data: p, error } = await supabase.from('products').insert({
          sku, name: finalName, model: modelName || null, category: (f.category ?? '').trim(), price: +f.price || 0, stock: +f.stock || 0,
          barcode: barcode || null, wattage: f.wattage, size: f.size, color: f.color, location: f.location, description: f.description,
        }).select().single();
        if (error) throw error;
        pid = p.id;
        if (f.cost_price) await supabase.from('product_costs').insert({ product_id: pid, cost_price: +f.cost_price });
      } else if (barcode && !existing.barcode) {
        const { error } = await supabase.from('products').update({ barcode }).eq('id', existing.id);
        if (error) throw error;
      }

      for (let i = 0; i < photos.length; i++) {
        setProgress(`Processing photo ${i + 1} of ${photos.length}…`);
        const path = `${pid}/${Date.now()}-${i}.jpg`;
        const up = await supabase.storage.from('product-images').upload(path, photos[i].blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
        const embedding = await embedImage(photos[i].base64);
        const ins = await supabase.from('product_images').insert({ product_id: pid, image_url: url, embedding });
        if (ins.error) throw ins.error;
      }
      let code = barcode || existing?.barcode || '';
      if (!code && autoCode) { try { code = await api.generateBarcode(pid as string); } catch (_) {} }
      const savedId = pid as string;
      reset();
      nav('/add', { replace: true, state: {} });
      if (confirmBox('Saved ✅', `${code ? `Barcode: ${code}` : 'Product can now be found by photo.'}\n\nOK = view label\nCancel = add another`)) nav(`/product/${savedId}`);
    } catch (e: any) {
      alertBox('Could not finish', `${e.message}\n\nIf the product was already created, enter the same SKU again and add the photos.`);
    }
    setBusy(false);
  }

  return (
    <div className="page cardin">
      <h1>Add Product</h1>
      <div className="sub" style={{ marginBottom: 16 }}>Take photos, add the barcode and details. Sales staff can then find it by photo or barcode.</div>

      <div className="card">
        <div className="section" style={{ marginTop: 0 }}>1. Product photos</div>
        <div className="photos">
          {photos.map((p, i) => (
            <div key={i} className="sw"><img src={p.url} alt="" /><button onClick={() => removePhoto(i)} aria-label="Remove photo">✕</button></div>
          ))}
        </div>
        {photos.length < MAX_PHOTOS && (
          <div className="row gap8">
            <button className="btn accent f1" style={{ marginTop: 0 }} onClick={takePhoto}>📷 Camera</button>
            <button className="btn grayl f1" style={{ marginTop: 0 }} onClick={pickPhotos}>🖼 Gallery</button>
          </div>
        )}
        <div className="muted mt12" style={{ fontSize: 12, color: photos.length >= 3 ? 'var(--green)' : undefined }}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} added · 3-5 from different angles is best
        </div>
      </div>

      <div className="card">
        <div className="section" style={{ marginTop: 0 }}>2. Product details</div>
        <Field label="SKU / Model number *" value={f.sku} onChange={set('sku')} onBlur={checkSku} upper placeholder="e.g. NL-013" />

        <label className="label">Barcode</label>
        <div className="row gap8 mb12">
          <input className="input nm f1" value={f.barcode ?? ''} onChange={(e) => set('barcode')(e.target.value)} placeholder="Type or scan" autoCapitalize="none" />
          <button className="btn auto accent" onClick={() => setScanOpen(true)}>Scan</button>
        </div>
        {!f.barcode && !existing?.barcode && (
          <label className="row sb mb12" style={{ fontWeight: 600 }}>
            <span className="f1 mr8">Generate a barcode automatically after saving</span>
            <input type="checkbox" checked={autoCode} onChange={(e) => setAutoCode(e.target.checked)} style={{ width: 22, height: 22 }} />
          </label>
        )}

        {existing ? (
          <div className="notice">
            SKU already exists ({existing.name}). Photos will be added to that product{existing.barcode ? '.' : ', and the barcode will be saved because it has none yet.'}
          </div>
        ) : (<>
          <Field label="Product name (empty = model + variant)" value={f.name} onChange={set('name')} placeholder="e.g. Moon Night Lamp" />
          <label className="label">Category *</label>
          <div className="chips">
            {CATEGORIES.map((c) => <button key={c} className={`chip${f.category === c ? ' on' : ''}`} onClick={() => set('category')(c)}>{c}</button>)}
          </div>
          <input className="input" value={CATEGORIES.includes(f.category ?? '') ? '' : f.category ?? ''} onChange={(e) => set('category')(e.target.value)} placeholder="Or type a new category" />
          <label className="label">Model (one lamp design that comes in different colours / sizes / wattages)</label>
          {models.length > 0 && (
            <div className="chips">
              {models.map((m) => <button key={m} className={`chip${f.model === m ? ' on' : ''}`} onClick={() => set('model')(m)}>{m}</button>)}
            </div>
          )}
          <input className="input" value={models.includes(f.model ?? '') ? '' : f.model ?? ''} onChange={(e) => set('model')(e.target.value)} placeholder="Or type a new model name" />
          <div className="two">
            <Field label="Selling price ₹ *" value={f.price} onChange={set('price')} numeric />
            {isAdmin && <Field label="Cost price ₹" value={f.cost_price} onChange={set('cost_price')} numeric />}
          </div>
          <div className="two">
            <Field label="Stock qty" value={f.stock} onChange={set('stock')} numeric />
            <Field label="Shelf location" value={f.location} onChange={set('location')} placeholder="Rack A1" />
          </div>
        </>)}
      </div>

      {!existing && (
        <div className="card">
          <div className="section" style={{ marginTop: 0 }}>3. Variant details (colour, size, wattage)</div>
          <div className="two">
            <Field label="Wattage" value={f.wattage} onChange={set('wattage')} placeholder="9W" />
            <Field label="Size" value={f.size} onChange={set('size')} placeholder="12 inch" />
          </div>
          <Field label="Colour" value={f.color} onChange={set('color')} placeholder="Warm white" />
          <Field label="Description" value={f.description} onChange={set('description')} multiline />
        </div>
      )}

      <button className="btn" style={{ padding: 17, fontSize: 16, borderRadius: 14 }} onClick={save} disabled={busy}>
        {busy ? (progress || 'Saving…') : existing ? 'Add Photos to Product' : 'Save Product'}
      </button>
      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScanned={(c) => { set('barcode')(c); setScanOpen(false); }} />
    </div>
  );
}
