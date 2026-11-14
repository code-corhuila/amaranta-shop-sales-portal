import { useMemo, useRef } from 'react';

/** A key the service accepts: 8 to 128 characters (CA-C1.5). A UUID is 36, and never the same twice. */
export const newIdempotencyKey = (): string => crypto.randomUUID();

/**
 * One key per INTENTION (Annex H, CA-X3.2). Sending the same order again reuses the key, so a retry after a cut connection returns
 * the order the service already made and reserves nothing twice. A different order is a different intention and gets a new key:
 * the old one would bring back the old order. It remembers only the last thing sent.
 */
export function useIdempotencyKey(generate: () => string = newIdempotencyKey) {
  const last = useRef<{ fingerprint: string; key: string } | null>(null);
  return useMemo(
    () => ({
      keyFor(fingerprint: string): string {
        if (last.current?.fingerprint !== fingerprint) last.current = { fingerprint, key: generate() };
        return last.current.key;
      },
      /** For the next purchase, or when the service refused the key. */
      renew(): void {
        last.current = null;
      },
    }),
    [generate],
  );
}
