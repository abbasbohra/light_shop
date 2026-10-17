import { useEffect, useRef, useState } from 'react';

const FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
type Props = { active: boolean; onScanned: (code: string) => void };

// Uses the browser's built-in BarcodeDetector (Chrome / Edge / Android) and falls back to ZXing (Safari / Firefox)
export default function BarcodeScanner({ active, onScanned }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const lock = useRef(false);
  const cb = useRef(onScanned);
  cb.current = onScanned;

  useEffect(() => { if (active) lock.current = false; }, [active]);

  useEffect(() => {
    if (!active) return;
    let stop = false, raf = 0;
    let stream: MediaStream | null = null;
    let controls: { stop: () => void } | null = null;
    const found = (code: string) => {
      if (!code || lock.current) return;
      lock.current = true;            // one scan at a time
      cb.current(code);
    };
    (async () => {
      try {
        setErr('');
        const v = video.current!;
        if ('BarcodeDetector' in window) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
          if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
          v.srcObject = stream;
          await v.play();
          const det = new (window as any).BarcodeDetector({ formats: FORMATS });
          const tick = async () => {
            if (stop) return;
            try { const r = await det.detect(v); if (r[0]?.rawValue) found(r[0].rawValue); } catch (_) {}
            raf = window.setTimeout(tick, 150) as unknown as number;
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromVideoDevice(undefined, v, (res) => { if (res) found(res.getText()); });
          if (stop) controls.stop();
        }
      } catch (e: any) {
        setErr(e?.name === 'NotAllowedError'
          ? 'Camera permission is needed to scan barcodes. Allow it in the browser site settings.'
          : (e?.message || 'Could not start the camera. The page must be opened over HTTPS.'));
      }
    })();
    return () => {
      stop = true;
      clearTimeout(raf);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      if (video.current) video.current.srcObject = null;
    };
  }, [active]);

  return (
    <div className="cam">
      <video ref={video} playsInline muted />
      {err ? <div className="msg">{err}</div> : <div className="frame" />}
    </div>
  );
}
