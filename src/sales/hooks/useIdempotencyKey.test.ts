import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { newIdempotencyKey, useIdempotencyKey } from './useIdempotencyKey';

function sequence() {
  let n = 0;
  return () => `key-number-${++n}`;
}

describe('useIdempotencyKey: one key per intention', () => {
  it('gives the same key every time the same order is sent, so a retry after a cut connection creates nothing new', () => {
    const { result } = renderHook(() => useIdempotencyKey(sequence()));
    const first = result.current.keyFor('order-A');
    expect(result.current.keyFor('order-A')).toBe(first);
    expect(result.current.keyFor('order-A')).toBe(first);
  });

  it('gives a new key when the order is different: it is another intention, and the old key would bring back the old order', () => {
    const { result } = renderHook(() => useIdempotencyKey(sequence()));
    const first = result.current.keyFor('order-A');
    const second = result.current.keyFor('order-B');
    expect(second).not.toBe(first);
    expect(result.current.keyFor('order-B')).toBe(second);
  });

  it('does not go back to an old key when the person goes back to an old order: what was sent last is the intention', () => {
    const { result } = renderHook(() => useIdempotencyKey(sequence()));
    const a = result.current.keyFor('order-A');
    result.current.keyFor('order-B');
    expect(result.current.keyFor('order-A')).not.toBe(a);
  });

  it('gives a new key on demand, for the next purchase or when the service refused the key', () => {
    const { result } = renderHook(() => useIdempotencyKey(sequence()));
    const first = result.current.keyFor('order-A');
    result.current.renew();
    expect(result.current.keyFor('order-A')).not.toBe(first);
  });

  it('keeps its key when the screen redraws', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey(sequence()));
    const first = result.current.keyFor('order-A');
    rerender();
    expect(result.current.keyFor('order-A')).toBe(first);
  });
});

describe('newIdempotencyKey', () => {
  it('is what the service accepts: 8 to 128 characters (CA-C1.5), and never the same twice', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key.length).toBeLessThanOrEqual(128);
    }
  });
});
