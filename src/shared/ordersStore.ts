import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface OrderItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  table_id: number;
  waiter_id: number;
   status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled' | 'rejected';
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method?: string;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  created_at: string;
  updated_at: string;
}

interface OrdersStore {
  orders: Order[];
  currentOrder: Order | null;
  fetchOrders: () => Promise<void>;
  createOrder: (orderData: Partial<Order>) => Promise<Order | null>;
  updateOrderStatus: (id: number, status: Order['status']) => Promise<void>;
  payOrder: (id: number, paymentMethod: string) => Promise<void>;
  setCurrentOrder: (order: Order | null) => void;
}

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  orders: [],
  currentOrder: null,

  fetchOrders: async () => {
    try {
      const orders = await api.orders.getAll();
      set({ orders });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  },

  createOrder: async (orderData) => {
    try {
      const newOrder = await api.orders.create(orderData as any);
      if (newOrder) {
        const { orders } = get();
        set({ orders: [...orders, newOrder] });
        return newOrder;
      }
    } catch (error) {
      console.error('Failed to create order:', error);
    }
    return null;
  },

  updateOrderStatus: async (id, status) => {
    try {
      await api.orders.updateStatus(id, status);
      const { orders } = get();
      set({
        orders: orders.map(order =>
          order.id === id ? { ...order, status } : order
        )
      });
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  },

  payOrder: async (id, paymentMethod) => {
    try {
      await fetch(`/api/orders/${id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: paymentMethod })
      });
      const { orders } = get();
      set({
        orders: orders.map(order =>
          order.id === id
            ? { ...order, payment_method: paymentMethod, payment_status: 'paid', status: 'paid' }
            : order
        )
      });
    } catch (error) {
      console.error('Failed to pay order:', error);
    }
  },

  setCurrentOrder: (order) => set({ currentOrder: order })
}));