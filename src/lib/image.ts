export type Photo = { blob: Blob; base64: string; url: string };

// Opens the phone camera (capture) or the file/gallery picker
export function pickFiles(capture: boolean, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple;
    if (capture) i.setAttribute('capture', 'environment');
    i.onchange = () => resolve(Array.from(i.files ?? []));
    i.addEventListener('cancel', () => resolve([]));
    i.click();
  });
}

// Shrinks a photo to a small JPEG (same idea as quality/maxWidth in react-native-image-picker)
export async function toPhoto(file: File, max = 800, quality = 0.4): Promise<Photo> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b as Blob), 'image/jpeg', quality));
  const base64: string = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res((fr.result as string).split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return { blob, base64, url: URL.createObjectURL(blob) };
}
