import BarcodeScanner from './BarcodeScanner';

export default function ScanModal({ open, onClose, onScanned }: { open: boolean; onClose: () => void; onScanned: (c: string) => void }) {
  if (!open) return null;
  return (
    <div className="full">
      <BarcodeScanner active={open} onScanned={onScanned} />
      <button className="close" onClick={onClose}>Close</button>
    </div>
  );
}
