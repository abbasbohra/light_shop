import { createClient } from '@supabase/supabase-js';
import { ProductRow } from './types';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);

// photo (base64) -> 512-number embedding. Shows the REAL error message from the function.
export async function embedImage(base64: string): Promise<number[]> {
  const { data, error } = await supabase.functions.invoke('embed-image', { body: { image: base64 } });
  if (error) {
    let msg = error.message;
    try {
      const b = await (error as any).context.json();
      msg = b.error || b.message || b.msg || JSON.stringify(b);
    } catch (_) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data.embedding;
}

export async function searchByPhoto(base64: string) {
  const embedding = await embedImage(base64);
  const { data, error } = await supabase.rpc('match_products', { query_embedding: embedding, match_count: 3 });
  if (error) throw error;
  return { rows: (data ?? []) as ProductRow[], embedding };
}

export async function findByBarcode(code: string) {
  const { data, error } = await supabase
    .from('products').select('id,name,sku').eq('barcode', code.trim()).maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; sku: string } | null;
}

export function learnScan(productId: string, embedding: number[]) {
  supabase.rpc('learn_scan', { p_id: productId, p_embedding: embedding }).then(() => {}, () => {});
}

export async function findDeliveryByBarcode(code: string) {
  const { data, error } = await supabase.from('deliveries').select('id,customer_name').eq('barcode', code.trim()).maybeSingle();
  if (error) throw error;
  return data as { id: string; customer_name: string } | null;
}
