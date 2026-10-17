// Draws an EAN-13 barcode as SVG (no extra library needed).
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function isValidEan13(code: string) {
  if (!/^\d{13}$/.test(code)) return false;
  const d = code.split('').map(Number);
  const sum = d.slice(0, 12).reduce((s, v, i) => s + v * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

function bitsFor(code: string) {
  const d = code.split('').map(Number);
  const p = PARITY[d[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (p[i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + '101';
}

export default function BarcodeView({ code, height = 90 }: { code: string; height?: number }) {
  if (!isValidEan13(code)) {
    return <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#000' }}>{code}</div>;
  }
  const bits = bitsFor(code);
  const quiet = 9;   // quiet zone, in modules
  const W = bits.length + quiet * 2;
  const runs: { x: number; n: number }[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const last = runs[runs.length - 1];
    if (last && last.x + last.n === i) last.n++; else runs.push({ x: i, n: 1 });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid var(--line)', width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
      <svg viewBox={`0 0 ${W} ${height / 2}`} style={{ width: Math.min(W * 2.4, 320), maxWidth: '100%', height: 'auto' }} shapeRendering="crispEdges">
        <rect width={W} height={height / 2} fill="#fff" />
        {runs.map((r, i) => <rect key={i} x={r.x + quiet} y={0} width={r.n} height={height / 2} fill="#000" />)}
      </svg>
      <div style={{ marginTop: 6, fontSize: 14, letterSpacing: 3, color: '#000', fontWeight: 600 }}>{code}</div>
    </div>
  );
}
