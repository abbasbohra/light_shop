export function statusInfo(s: string) {
  switch (s) {
    case 'pending': return { label: 'Pending', fg: 'var(--amber)', bg: 'var(--amberBg)' };
    case 'assigned': return { label: 'Assigned', fg: 'var(--blue)', bg: 'var(--blueBg)' };
    case 'out_for_delivery': return { label: 'Out for delivery', fg: 'var(--purple)', bg: 'var(--purpleBg)' };
    case 'delivered': return { label: 'Delivered', fg: 'var(--green)', bg: 'var(--greenBg)' };
    default: return { label: 'Cancelled', fg: 'var(--red)', bg: 'var(--redBg)' };
  }
}
export function roleInfo(r: string) {
  if (r === 'admin') return { label: 'Admin', fg: 'var(--ink)', bg: 'var(--accentSoft)' };
  if (r === 'delivery') return { label: 'Delivery', fg: 'var(--purple)', bg: 'var(--purpleBg)' };
  if (r === 'store') return { label: 'Store', fg: 'var(--green)', bg: 'var(--greenBg)' };
  return { label: 'Sales', fg: 'var(--blue)', bg: 'var(--blueBg)' };
}
export function stockInfo(stock: number, low = 5) {
  if (stock <= 0) return { label: 'Out of stock', fg: 'var(--red)', bg: 'var(--redBg)' };
  if (stock <= low) return { label: `Low stock · ${stock}`, fg: 'var(--amber)', bg: 'var(--amberBg)' };
  return { label: `In stock · ${stock}`, fg: 'var(--green)', bg: 'var(--greenBg)' };
}
export function matchInfo(sim: number) {
  const pct = Math.round(sim * 100);
  if (sim >= 0.8) return { label: `${pct}% Strong match`, fg: 'var(--green)', bg: 'var(--greenBg)' };
  if (sim >= 0.6) return { label: `${pct}% Possible match`, fg: 'var(--amber)', bg: 'var(--amberBg)' };
  return { label: `${pct}% Weak match`, fg: 'var(--gray)', bg: 'var(--grayBg)' };
}
