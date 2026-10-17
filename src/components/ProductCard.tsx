import { ProductRow } from '../lib/types';
import { matchInfo, stockInfo } from '../lib/ui';

export function Pill({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return <span className="pill" style={{ color: fg, background: bg }}>{label}</span>;
}

type Props = { item: ProductRow; onPress: () => void; match?: number; badge?: 'exact' | 'best' };

export default function ProductCard({ item, onPress, match, badge }: Props) {
  return (
    <div className={`card click ${badge ?? ''}`} role="button" tabIndex={0} onClick={onPress}
      onKeyDown={(e) => e.key === 'Enter' && onPress()}>
      {badge && <div className="tag" style={badge === 'exact' ? { color: 'var(--green)' } : undefined}>
        {badge === 'exact' ? '✓ EXACT MATCH' : '★ BEST GUESS'}
      </div>}
      <div className="row">
        {item.thumb ? <img className="thumb" src={item.thumb} alt="" /> : <div className="thumb">💡</div>}
        <div className="f1">
          <div className="name">{item.name}</div>
          <div className="muted">{item.sku}{item.category ? `  ·  ${item.category}` : ''}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>₹{item.price}</div>
        </div>
        <span className="chev">›</span>
      </div>
      <div className="pills">
        <Pill {...stockInfo(item.stock, item.low_stock_level)} />
        {match != null && <Pill {...matchInfo(match)} />}
      </div>
    </div>
  );
}
