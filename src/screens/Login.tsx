import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';
import { alertBox } from '../lib/dialog';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) alertBox('Login failed', error.message);
  }

  return (
    <form className="login" onSubmit={login}>
      <div className="logo">💡</div>
      <div className="brand">LightShop</div>
      <div className="tag2">Find any product with a photo or barcode</div>
      <input className="input" type="email" placeholder="Email" autoCapitalize="none" autoComplete="username"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" autoComplete="current-password"
        value={pass} onChange={(e) => setPass(e.target.value)} />
      <button className="btn accent" type="submit" disabled={busy} style={{ padding: 16, fontSize: 16 }}>
        {busy ? 'Logging in…' : 'Login'}
      </button>
    </form>
  );
}
