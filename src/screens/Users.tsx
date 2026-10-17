import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { roleInfo } from '../lib/ui';
import { alertBox } from '../lib/dialog';
import { AppUser, Role } from '../lib/types';
import { Pill } from '../components/ProductCard';
import Chips from '../components/Chips';
import Sheet from '../components/Sheet';

const blank = { email: '', password: '', full_name: '', phone: '', role: 'sales' as Role, active: true };

const PERMS = `ADMIN
Everything: stock, deliveries, users, roles, cost price and margin.

STORE PERSON
Browse stock, add and update stock, set exact counts, generate barcodes, add products and variants. Cannot see cost price. No deliveries.

SALESMAN
Scan and search products, view stock, record a sale, create deliveries and cancel their own pending ones. Cannot change stock.

DELIVERY
Only deliveries assigned to them: start, and mark delivered with a proof photo.`;

export default function Users() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (v: any) => setF((p) => ({ ...p, [k]: v }));

  async function load() {
    setLoading(true);
    try { setUsers(await api.users.list()); } catch (e: any) { alertBox('Error', e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(u: AppUser) {
    setEditing(u);
    setF({ email: u.email, password: '', full_name: u.full_name ?? '', phone: u.phone ?? '', role: u.role, active: u.active });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await api.users.update({ id: editing.id, role: f.role, full_name: f.full_name, phone: f.phone, active: f.active, password: f.password || undefined });
      } else {
        if (!f.email.trim() || f.password.length < 6) throw new Error('Enter an email and a password of 6+ characters');
        await api.users.create({ email: f.email, password: f.password, role: f.role, full_name: f.full_name, phone: f.phone });
      }
      setOpen(false);
      load();
    } catch (e: any) { alertBox('Could not save user', e.message); }
    setBusy(false);
  }

  const self = editing?.id === session?.user.id;
  return (
    <div className="page">
      <button className="btn accent" style={{ marginTop: 0 }} onClick={openNew}>+ Add user</button>
      <button className="link mt12 mb12" style={{ width: '100%', textAlign: 'center' }} onClick={() => alertBox('What can each role do?', PERMS)}>ℹ️ What can each role do?</button>
      {loading ? <div className="spinner" /> : users.map((item) => (
        <button key={item.id} className="card click" onClick={() => openEdit(item)}>
          <div className="row sb">
            <div className="name f1 mr8">{item.full_name || item.email}</div>
            <Pill {...roleInfo(item.role)} />
          </div>
          <div className="muted">{item.email}{item.phone ? ` · ${item.phone}` : ''}</div>
          {!item.active && <div style={{ color: 'var(--red)', fontWeight: 800, marginTop: 6 }}>Disabled</div>}
        </button>
      ))}

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? 'Edit user' : 'Add user'}>
        <label className="label">Full name</label>
        <input className="input" value={f.full_name} onChange={(e) => set('full_name')(e.target.value)} />
        <label className="label">Email</label>
        <input className="input" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} disabled={!!editing} autoCapitalize="none" />
        <label className="label">Phone</label>
        <input className="input" type="tel" value={f.phone} onChange={(e) => set('phone')(e.target.value)} />
        <label className="label">{editing ? 'New password (leave empty to keep)' : 'Password (6+ characters)'}</label>
        <input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password')(e.target.value)} />
        <label className="label">Role</label>
        <Chips<Role> value={f.role} onChange={set('role')}
          options={[{ key: 'admin', label: 'Admin' }, { key: 'sales', label: 'Salesman' }, { key: 'store', label: 'Store person' }, { key: 'delivery', label: 'Delivery' }]} />
        {editing && (
          <label className="row sb mb8" style={{ fontWeight: 700 }}>
            Account active
            <input type="checkbox" checked={f.active} onChange={(e) => set('active')(e.target.checked)} style={{ width: 22, height: 22 }} />
          </label>
        )}
        {self && <div className="muted mb8">This is your own account: you cannot remove your admin access.</div>}
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </Sheet>
    </div>
  );
}
