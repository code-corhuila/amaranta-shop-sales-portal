import { vi } from 'vitest';

/**
 * The shell's `shell/cart`, for tests: a test says what the cart holds by changing `cart.items`, and looks at the calls of
 * `cart.add`, `cart.setQuantity`, `cart.remove` and `cart.clear`. In the browser the real one is loaded from the shell, which also
 * keeps the cart in the browser and shows it in the menu. `resetCart()` gives every test a clean one.
 */
export const MAX_QUANTITY = 50;

interface StubItem {
  productId: string;
  name: string;
  price: number;
  priceFormatted: string;
  imageUrl: string | null;
  quantity: number;
}

export const cart: {
  items: StubItem[];
  add: ReturnType<typeof vi.fn>;
  setQuantity: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
} = { items: [], add: vi.fn(), setQuantity: vi.fn(), remove: vi.fn(), clear: vi.fn() };

export function resetCart() {
  cart.items = [];
  cart.add = vi.fn(() => ({ capped: false }));
  cart.setQuantity = vi.fn();
  cart.remove = vi.fn();
  cart.clear = vi.fn();
}

resetCart();

export function useCart() {
  return {
    items: cart.items,
    count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    add: cart.add,
    setQuantity: cart.setQuantity,
    remove: cart.remove,
    clear: cart.clear,
  };
}
