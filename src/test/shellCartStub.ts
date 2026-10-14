import { vi } from 'vitest';

/**
 * The shell's `shell/cart`, for tests: a test says what the cart holds by changing `cart.items`, and looks at `cart.add`. In the
 * browser the real one is loaded from the shell, which also keeps the cart in the browser and shows it in the menu.
 */
export const MAX_QUANTITY = 50;

export const cart: { items: { productId: string; quantity: number }[]; add: ReturnType<typeof vi.fn> } = {
  items: [],
  add: vi.fn(() => ({ capped: false })),
};

export function useCart() {
  return {
    items: cart.items,
    count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    add: cart.add,
    setQuantity: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  };
}
