import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, findDeliveryByBarcode } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { alertBox } from '../lib/dialog';
import { statusInfo } from '../lib/ui';
import { Pill } from '../components/ProductCard';
import Chips from '../components/Chips';
import ScanModal from '../components/ScanModal';
import { useIsTab } from '../components/Layout';

type F = 'pending' | 'active' | 'done' | 'cancelled' | 'all';

export default function Deliveries() {
  const nav = useNavigate();
  const isTab = useIsTab(); // tab for sales/delivery, stack screen for admin
  const { role } = useAuth();
  const [filter, setFilter] = useState<F>('active');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('deliveries')
      .select('id,customer_name,address,city,delivery_no,status,created_at,assigned_name,delivery_items(qty,product_name)')
      .order('created_at', { ascending: false }).limit(80);
    if (error) alertBox('Error', error.message);
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const shown = rows.filter((d) =>
    filter === 'all' ? true :
    filter === 'pending' ? d.status === 'pending' :
    filter === 'active' ? ['pending', 'assigned', 'out_for_delivery'].includes(d.status) :
    filter === 'done' ? d.status === 'delivered' : d.status === 'cancelled');

  async function onParcel(code: string) {
    setScanOpen(false);
    try {
      const x = await findDeliveryByBarcode(code);
      if (x) nav(`/delivery/${x.id}`);
      else alertBox('Not found', 'This parcel is not assigned to you, or the code is wrong.');
    } catch (e: any) { alertBox('Error', e.message); }
  }

  return (
    <div className="page">
      <div className="row sb mb12">
        {isTab ? <h1>Deliveries</h1> : <span />}
        <div className="row gap8">
          <button className="btn auto" onClick={load}>↻</button>
          {role === 'delivery'
            ? <button className="btn auto accent" onClick={() => setScanOpen(true)}>▮▯▮ Scan parcel</button>
            : <button className="btn auto accent" onClick={() => nav('/delivery/new')}>+ New</button>}
        </div>
      </div>
      <Chips<F> value={filter} onChange={setFilter}
        options={[...(role === 'admin' ? [{ key: 'pending' as F, label: 'To assign' }] : []),
          { key: 'active', label: 'Active' }, { key: 'done', label: 'Delivered' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }]} />
      {loading ? <div className="spinner" /> : shown.length === 0 ? <div className="empty">No deliveries here</div> : <div className="cards">{shown.map((item) => (
        <button key={item.id} className="card click" onClick={() => nav(`/delivery/${item.id}`)}>
          <div className="row sb">
            <div className="name f1 mr8" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.customer_name}</div>
            <Pill {...statusInfo(item.status)} />
          </div>
          <div className="muted">{item.delivery_no != null ? `#${item.delivery_no} · ` : ''}{item.address}{item.city ? `, ${item.city}` : ''}</div>
          <div className="mt8">{item.delivery_items.map((i: any) => `${i.qty} × ${i.product_name}`).join(', ')}</div>
          <div className="muted">{new Date(item.created_at).toLocaleDateString('en-IN')}{item.assigned_name ? ` · ${item.assigned_name}` : ''}</div>
        </button>
      ))}</div>}
      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScanned={onParcel} />
    </div>
  );
}
