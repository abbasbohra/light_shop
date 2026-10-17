import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Coords, DELIVERY_RADIUS_M, directionsUrl, distanceM, fmtDist, getCurrentCoords, mapsUrl } from '../lib/location';
import { statusInfo } from '../lib/ui';
import { alertBox, confirmBox } from '../lib/dialog';
import { Photo, pickFiles, toPhoto } from '../lib/image';
import { AppUser } from '../lib/types';
import { Pill } from '../components/ProductCard';
import Sheet from '../components/Sheet';
import BarcodeView from '../components/BarcodeView';
import LocationPicker from '../components/LocationPicker';

export default function DeliveryDetail() {
  const { id = '' } = useParams();
  const { role, session } = useAuth();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const [staff, setStaff] = useState<AppUser[] | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [me, setMe] = useState<Coords | null>(null); // delivery person's current position
  const [locBusy, setLocBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('deliveries').select('*, delivery_items(*)').eq('id', id).single();
    if (error) alertBox('Error', error.message);
    setD(data);
    setProofUrl(null);
    if (data?.proof_path) {
      const { data: s } = await supabase.storage.from('delivery-proofs').createSignedUrl(data.proof_path, 3600);
      setProofUrl(s?.signedUrl ?? null);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function checkLocation() {
    setLocBusy(true);
    try { setMe(await getCurrentCoords()); } catch (e: any) { alertBox('Location', e.message); }
    setLocBusy(false);
  }
  // delivery person: check position automatically once the delivery is on the way
  useEffect(() => {
    if (role === 'delivery' && d?.lat != null && d?.status === 'out_for_delivery') checkLocation();
  }, [d?.id, d?.status]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); } catch (e: any) { alertBox('Not done', e.message); }
    setBusy(false);
  }
  async function openAssign() {
    setPick(true);
    if (staff) return;
    try { setStaff((await api.users.list()).filter((u) => u.role === 'delivery' && u.active)); }
    catch (e: any) { alertBox('Error', e.message); setPick(false); }
  }
  async function takePhoto() {
    const [f] = await pickFiles(true);
    if (!f) return;
    try { setPhoto(await toPhoto(f, 1024, 0.5)); } catch (e: any) { alertBox('Photo error', e.message); }
  }

  async function confirmDelivered() {
    if (role === 'delivery' && !photo) return alertBox('Take a photo of the delivered goods first');
    setBusy(true);
    try {
      let here: Coords | null = null;
      if (role === 'delivery' && d.lat != null) { // must be at the delivery location
        here = await getCurrentCoords();
        const far = distanceM(here, { lat: d.lat, lng: d.lng });
        if (far > DELIVERY_RADIUS_M) throw new Error(`You are ${fmtDist(far)} away from the delivery location. Reach the place first.`);
      }
      let path: string | undefined;
      if (photo) {
        path = `${d.id}/${Date.now()}.jpg`;
        const up = await supabase.storage.from('delivery-proofs').upload(path, photo.blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
      }
      await api.setDeliveryStatus(d.id, 'delivered', path, note.trim() || undefined, here?.lat, here?.lng);
      setProofOpen(false); setPhoto(null); setNote('');
      await load();
    } catch (e: any) { alertBox('Could not complete delivery', e.message); }
    setBusy(false);
  }

  if (!d) return <div className="spinner" />;

  const target: Coords | null = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const fullAddr = [d.address, d.landmark ? `Near ${d.landmark}` : '', d.city, d.pincode].filter(Boolean).join(', ');
  const open = !['delivered', 'cancelled'].includes(d.status);
  const mine = d.assigned_to === session?.user.id;
  const dist = me && target ? distanceM(me, target) : null;
  const needsGeo = role === 'delivery' && !!target;
  const near = dist != null && dist <= DELIVERY_RADIUS_M;
  const canAssign = role === 'admin' && ['pending', 'assigned'].includes(d.status);
  const canStart = open && d.status === 'assigned' && (role === 'admin' || (role === 'delivery' && mine));
  const canFinish = open && d.status === 'out_for_delivery' && (role === 'admin' || (role === 'delivery' && mine));
  const canCancel = open && (role === 'admin' || (role === 'sales' && d.created_by === session?.user.id && d.status === 'pending'));
  const canSetLoc = open && (role === 'admin' || (role === 'sales' && d.created_by === session?.user.id));
  const total = d.delivery_items.reduce((s: number, i: any) => s + i.qty * i.price, 0);
  const units = d.delivery_items.reduce((s: number, i: any) => s + i.qty, 0);

  function finish() {
    if (needsGeo && !near) {
      return alertBox('Reach the delivery location first',
        dist != null ? `You are ${fmtDist(dist)} away. You need to be within ${DELIVERY_RADIUS_M} m.` : 'Tap "Refresh my location" to check where you are.');
    }
    setProofOpen(true);
  }

  const Btn = ({ label, onPress, color = '', off = false }: { label: string; onPress: () => void; color?: string; off?: boolean }) => (
    <button className={`btn ${off ? 'gray off' : color}`} onClick={onPress} disabled={busy}>{label}</button>
  );

  return (
    <div className="page wide cols">
      <div className="card">
        <div className="row sb">
          <div className="f1 mr8" style={{ fontSize: 22, fontWeight: 800 }}>{d.customer_name}</div>
          <Pill {...statusInfo(d.status)} />
        </div>
        {d.delivery_no != null && <div className="muted">Delivery #{d.delivery_no}</div>}
        {d.customer_phone && <a className="link mt8" href={`tel:${d.customer_phone}`}>📞 {d.customer_phone}</a>}
        <div><a className="link mt8" href={target ? mapsUrl(target) : directionsUrl(null, fullAddr)} target="_blank" rel="noreferrer">📍 {fullAddr}</a></div>
        {d.notes && <div className="muted mt8">Note: {d.notes}</div>}
      </div>

      <div className="card">
        <div className="name mb8">Products ({d.delivery_items.length}) · {units} items</div>
        {d.delivery_items.map((i: any) => (
          <div key={i.id} className="item">
            <div className="row sb"><b className="f1 mr8">{i.product_name}</b><b>× {i.qty}</b></div>
            <div className="muted">{[i.model && `Model: ${i.model}`, i.variant, i.sku].filter(Boolean).join(' · ')}</div>
            <div className="muted">₹{i.price} each · ₹{i.qty * i.price}</div>
          </div>
        ))}
        <div className="tr mt12" style={{ fontSize: 18, fontWeight: 800 }}>Total ₹{total}</div>
      </div>

      <div className="card">
        <div className="name mb8">Delivery location</div>
        {target ? (
          <>
            <div style={{ color: 'var(--green)', fontWeight: 800 }}>📍 Location set</div>
            {role === 'delivery' && open && d.status === 'out_for_delivery' && (
              <div className="mt8">
                <div style={{ color: near ? 'var(--green)' : 'var(--amber)', fontWeight: 800 }}>
                  {dist == null ? 'Checking your position…' : near ? `✅ You have reached the location (${fmtDist(dist)})`
                    : `⛔ ${fmtDist(dist)} away. Get within ${DELIVERY_RADIUS_M} m to mark delivered`}
                </div>
                <button className="link mt8" onClick={checkLocation} disabled={locBusy}>{locBusy ? 'Checking…' : '↻ Refresh my location'}</button>
              </div>
            )}
          </>
        ) : <div className="muted">No exact location saved{role === 'delivery' ? '. You can mark delivered without it.' : '.'}</div>}
        {open && <a className="btn blue mt12" style={{ textDecoration: 'none' }} href={directionsUrl(target, fullAddr)} target="_blank" rel="noreferrer">🧭 Navigate</a>}
        {canSetLoc && <button className="link mt12" style={{ width: '100%' }} onClick={() => setLocOpen(true)}>{target ? 'Change location' : '＋ Add location'}</button>}
      </div>

      {d.barcode && (
        <div className="card">
          <div className="name mb12">Delivery barcode</div>
          <BarcodeView code={d.barcode} />
          <div className="muted tc mt8">Stick this on the parcel. Scanning it opens this delivery.</div>
        </div>
      )}

      <div className="card">
        <div className="muted">Created by {d.created_by_name ?? 'staff'} · {new Date(d.created_at).toLocaleString('en-IN')}</div>
        <div className="muted">Delivery person: {d.assigned_name ?? 'not assigned yet'}</div>
        {d.delivered_at && <div className="muted">Delivered: {new Date(d.delivered_at).toLocaleString('en-IN')}</div>}
      </div>

      {d.status === 'delivered' && (d.proof_path || d.delivery_note) && (
        <div className="card">
          <div className="name mb8">Proof of delivery</div>
          {d.proof_path && (proofUrl ? <img src={proofUrl} alt="Proof" style={{ width: '100%', maxHeight: 360, borderRadius: 12, objectFit: 'cover' }} /> : <div className="spinner sm" />)}
          {d.delivery_note && <div className="muted mt8">Note: {d.delivery_note}</div>}
        </div>
      )}

      {canAssign && <Btn label={d.assigned_name ? 'Change delivery person' : 'Assign delivery person'} onPress={openAssign} color="blue" />}
      {canStart && <Btn label="Start delivery (out for delivery)" onPress={() => run(() => api.setDeliveryStatus(d.id, 'out_for_delivery'))} color="purple" />}
      {canFinish && <Btn label={needsGeo && !near ? 'Reach the location to mark delivered' : 'Mark as delivered (with photo)'} onPress={finish} color="green" off={needsGeo && !near} />}
      {canCancel && <Btn label="Cancel delivery & restore stock" color="red"
        onPress={() => confirmBox('Cancel delivery?', 'The items go back into stock.') && run(() => api.cancelDelivery(d.id))} />}

      <Sheet visible={proofOpen} onClose={() => setProofOpen(false)} title="Proof of delivery">
        <div className="muted mb12">{role === 'delivery' ? 'Take a photo of the delivered goods (required).' : 'Add a photo of the delivered goods (optional).'}</div>
        {photo && <img src={photo.url} alt="" style={{ width: '100%', maxHeight: 260, borderRadius: 12, objectFit: 'cover', marginBottom: 10 }} />}
        <button className="btn accent" style={{ marginTop: 0 }} onClick={takePhoto}>{photo ? '📷 Retake photo' : '📷 Take photo'}</button>
        <label className="label mt16">Note (optional)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Received by customer's wife" />
        <Btn label={busy ? 'Saving…' : 'Confirm delivered'} onPress={confirmDelivered} color="green" />
      </Sheet>

      <Sheet visible={locOpen} onClose={() => setLocOpen(false)} title="Delivery location">
        <LocationPicker value={null} onChange={(c) => { if (!c) return; setLocOpen(false); run(() => api.setDeliveryLocation(d.id, c.lat, c.lng)); }} />
      </Sheet>

      <Sheet visible={pick} onClose={() => setPick(false)} title="Choose delivery person">
        {!staff ? <div className="spinner sm" /> : staff.length === 0 ? (
          <div className="empty">No delivery users yet. Add one in Admin → Users & Roles.</div>
        ) : staff.map((u) => (
          <button key={u.id} className="card click" style={{ marginBottom: 8, boxShadow: 'none', border: '1px solid var(--line)' }}
            onClick={() => { setPick(false); run(() => api.assignDelivery(d.id, u.id)); }}>
            <div className="name">{u.full_name || u.email}</div>
            <div className="muted">{u.phone || u.email}</div>
          </button>
        ))}
      </Sheet>
    </div>
  );
}
