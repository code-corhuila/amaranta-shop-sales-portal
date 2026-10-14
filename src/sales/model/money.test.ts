import { describe, expect, it } from 'vitest';
import { cartTotal, formatPesos, lineSubtotal } from './money';

const line = (price: number, quantity: number) => ({ price, quantity });

describe('money in the cart is exact: whole pesos, summed as integers', () => {
  it('multiplies a price by a quantity', () => {
    expect(lineSubtotal(line(189_000, 2))).toBe(378_000n);
    expect(lineSubtotal(line(8_500, 3))).toBe(25_500n);
  });

  it('stays exact where a float would not', () => {
    // 0.07 * 100 is 7.000000000000001 in a float; pesos are whole, and a big price times 50 must not lose a peso either.
    expect(lineSubtotal(line(9_007_199_254_740_991, 50))).toBe(450_359_962_737_049_550n);
  });

  it('adds the lines of a cart', () => {
    expect(cartTotal([line(189_000, 2), line(8_500, 3)])).toBe(403_500n);
    expect(cartTotal([])).toBe(0n);
  });

  it('writes pesos the way the shop does: a symbol, and a dot for every thousand', () => {
    expect(formatPesos(0n)).toBe('$\u00a00');
    expect(formatPesos(999n)).toBe('$\u00a0999');
    expect(formatPesos(8_500n)).toBe('$\u00a08.500');
    expect(formatPesos(403_500n)).toBe('$\u00a0403.500');
    expect(formatPesos(1_234_567n)).toBe('$\u00a01.234.567');
    expect(formatPesos(450_359_962_737_049_550n)).toBe('$\u00a0450.359.962.737.049.550');
  });
});
