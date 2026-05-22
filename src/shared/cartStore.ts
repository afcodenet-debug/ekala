import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  discount?: number;
}

interface CartStore {
  items: CartItem[];
  total: number;
  discount: number;
  tax: number;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  applyDiscount: (amount: number) => void;
  clearCart: () => void;
  calculateTotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      discount: 0,
      tax: 0.08, // 8% tax

      addItem: (item) => {
        const { items } = get();
        const existingIndex = items.findIndex(i => i.productId === item.productId);

        if (existingIndex >= 0) {
          // Update quantity
          const updatedItems = [...items];
          updatedItems[existingIndex].quantity += item.quantity;
          set({ items: updatedItems });
        } else {
          // Add new item
          const newItem = { ...item, id: Date.now().toString() };
          set({ items: [...items, newItem] });
        }
        get().calculateTotal();
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const { items } = get();
        const updatedItems = items.map(item =>
          item.id === id ? { ...item, quantity } : item
        );
        set({ items: updatedItems });
        get().calculateTotal();
      },

      removeItem: (id) => {
        const { items } = get();
        set({ items: items.filter(item => item.id !== id) });
        get().calculateTotal();
      },

      applyDiscount: (amount) => {
        set({ discount: amount });
        get().calculateTotal();
      },

      clearCart: () => {
        set({ items: [], total: 0, discount: 0 });
      },

      calculateTotal: () => {
        const { items, discount, tax } = get();
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountAmount = discount > 1 ? discount : subtotal * discount; // Fixed or percentage
        const taxed = (subtotal - discountAmount) * tax;
        const total = subtotal - discountAmount + taxed;
        set({ total });
        return total;
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);