export type Role = 'admin' | 'sales' | 'store' | 'delivery';
export type ProductRow = {
  id: string; sku: string; name: string; price: number; stock: number;
  low_stock_level?: number; category?: string | null; thumb?: string; similarity?: number;
};
export type AppUser = {
  id: string; email: string; role: Role; full_name: string | null; phone: string | null; active: boolean;
};
