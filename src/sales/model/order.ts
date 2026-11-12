// The types of the portal reflect the contract of sales-api with the SAME field names (Annex H, rule 2).

export interface OrderLine {
  readonly productId: string;
  /** The name of the product the day of the purchase: an order is a snapshot (RN-12). */
  readonly productName: string;
  /** Whole pesos, as they were the day of the purchase. */
  readonly unitPrice: number;
  readonly quantity: number;
  readonly subtotal: number;
}

export interface Order {
  readonly orderId: string;
  /** PENDING until a person at the shop marks it as paid. */
  readonly status: string;
  readonly channel: string;
  /** Whole pesos, computed by the service: the sum of the lines (RN-01). */
  readonly total: number;
  /** As the service formatted it, e.g. "$ 386.500". The portal shows it as it comes. */
  readonly totalFormatted: string;
  readonly items: readonly OrderLine[];
  /** ISO-8601, in UTC. */
  readonly createdAt: string;
  readonly fulfillmentMethod: string;
  readonly paymentMethod: string;
  readonly contactName: string;
  readonly contactPhone: string;
  /** Only for a delivery. */
  readonly deliveryAddress?: string;
}

export interface PageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

/** A page of anything the services list: `{data, meta}`. */
export interface Page<T> {
  readonly data: readonly T[];
  readonly meta: PageMeta;
}
