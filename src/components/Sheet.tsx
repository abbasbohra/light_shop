import { ReactNode, useEffect } from 'react';

type Props = { visible: boolean; onClose: () => void; title: string; children: ReactNode };

export default function Sheet({ visible, onClose, title, children }: Props) {
  useEffect(() => {
    if (!visible) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [visible, onClose]);
  if (!visible) return null;
  return (
    <div className="bg" onClick={onClose}>
      <div className="sheet cardin" onClick={(e) => e.stopPropagation()}>
        <div className="row sb mb12">
          <b style={{ fontSize: 18 }}>{title}</b>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--sub)' }} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
