export type OrderStatus = 'PLACED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED';

export interface MenuItem {
  menu_item_id: number;
  item_name: string;
  category: 'Coffee' | 'Cold Brew' | 'Breakfast' | 'Snacks' | 'Mains' | 'Desserts';
  price: number;
  available: 'Y' | 'N';
  description: string;
  isVeg: boolean;
  isBestseller?: boolean;
  calories?: number;
  prepTimeMinutes: number;
  imageUrl?: string;
}

export interface CafeTable {
  table_id: number;
  table_number: number;
  capacity: number;
  floor: 'Floor 1 (Inside)' | 'Floor 2 (Terrace)';
  status: TableStatus;
  currentOrderId?: number;
}

export interface OrderItem {
  order_item_id: number;
  order_id: number;
  menu_item_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface CafeOrder {
  order_id: number;
  table_id: number;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  order_status: OrderStatus;
  total_amount: number;
  payment_method: 'UPI' | 'Card' | 'Cash';
  payment_status: 'PAID' | 'PENDING';
  created_at: string;
  notes?: string;
  items: OrderItem[];
}
