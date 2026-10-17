import { useState } from 'react';
import { Coords, getCurrentCoords, mapsUrl, resolveLocation } from '../lib/location';
import { alertBox } from '../lib/dialog';

type Props = { value: Coords | null; onChange: (c: Coords | null) => void };

// Delivery location: paste a full Google Maps link / "lat,lng", or use this device's GPS
export default function LocationPicker({ value, onChange }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function useLink() {
    setBusy(true);
    const c = await resolveLocation(text);
    setBusy(false);
    if (!c) return alertBox("Couldn't read the location", 'Paste the full Google Maps link that shows the pin (short maps.app.goo.gl links do not work in the browser: open it, then copy the long address from the address bar), or type latitude,longitude (for example 26.9124,75.7873).');
    onChange(c); setText('');
  }
  async function useGps() {
    setBusy(true);
    try { onChange(await getCurrentCoords()); } catch (e: any) { alertBox('Location', e.message); }
    setBusy(false);
  }

  if (value) {
    return (
      <div>
        <div style={{ color: 'var(--green)', fontWeight: 800 }}>📍 Location saved</div>
        <div className="muted">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</div>
        <div className="row mt12" style={{ gap: 18 }}>
          <a className="link" href={mapsUrl(value)} target="_blank" rel="noreferrer">Open in Maps</a>
          <button className="link" style={{ color: 'var(--red)' }} onClick={() => onChange(null)}>Remove</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="label">Paste Google Maps link or latitude,longitude</label>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="none" autoCorrect="off"
        placeholder="https://www.google.com/maps/…  or  26.9124,75.7873" />
      <div className="row gap8">
        <button className="btn auto f1" disabled={!text.trim() || busy} onClick={useLink}>Use link</button>
        <button className="btn auto f1 accent" disabled={busy} onClick={useGps}>
          {busy ? <span className="spinner sm" style={{ display: 'inline-block' }} /> : '📍 I am here now'}
        </button>
      </div>
      <div className="muted mt8">"I am here now" uses this device's GPS, so use it when you are at the customer's place (best on a phone).</div>
    </div>
  );
}
