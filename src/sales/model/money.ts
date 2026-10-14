// Money in the cart is whole pesos, and every sum is of integers, done with BigInt so that it is exact whatever the size: a float
// never gets in (Annex H). The total of an ORDER is not computed here: it is the service's, from the products it reserves (RN-01).
// What this shows is an estimate of what the person chose, at the prices they saw.

export interface Priced {
  readonly price: number;
  readonly quantity: number;
}

export function lineSubtotal(line: Priced): bigint {
  return BigInt(line.price) * BigInt(line.quantity);
}

export function cartTotal(lines: readonly Priced[]): bigint {
  return lines.reduce((sum, line) => sum + lineSubtotal(line), 0n);
}

/** Pesos the way the services write them: a symbol, a non-breaking space and a dot for every thousand ("$\u00a0403.500"), so an amount never breaks across lines. */
export function formatPesos(pesos: bigint): string {
  return `$\u00a0${pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
