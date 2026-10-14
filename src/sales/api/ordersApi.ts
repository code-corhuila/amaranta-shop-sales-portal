import { apiClient, type ShellRequestOptions } from 'shell/apiClient';
import type { Order, Page } from '../model/order';

/** What the service takes to place an order (`POST /api/v1/orders`). The customer is the token's, never a field. */
export interface CheckoutRequest {
  readonly items: readonly { readonly productId: string; readonly quantity: number }[];
  readonly fulfillmentMethod: string;
  readonly paymentMethod: string;
  readonly contactName: string;
  readonly contactPhone: string;
  /** Only for a delivery: the service drops it for a pickup. */
  readonly deliveryAddress?: string;
}

export interface PlacedOrder {
  readonly order: Order;
  /** True when the service answered 200: that order was already there, and nothing new was created or reserved (CA-C1.6). */
  readonly replayed: boolean;
}

/**
 * Places an order. The key identifies the INTENTION: sent again with the same key, the service answers with the same order and
 * reserves nothing twice, so a retry after a cut connection never creates a second order (Annex H, RNF-C3).
 */
export async function placeOrder(request: CheckoutRequest, idempotencyKey: string, signal?: AbortSignal): Promise<PlacedOrder> {
  const options: ShellRequestOptions = signal ? { idempotencyKey, signal } : { idempotencyKey };
  const response = await apiClient.post<Order>('/api/v1/orders', request, options);
  return { order: response.data, replayed: response.status === 200 };
}

export interface PageRequest {
  readonly page: number;
  readonly limit: number;
}

/** My orders, newest first. It needs a signed-in person: the gateway refuses a request with no credential. */
export async function listMyOrders({ page, limit }: PageRequest, signal?: AbortSignal): Promise<Page<Order>> {
  const response = await apiClient.get<Page<Order>>(`/api/v1/orders?page=${page}&limit=${limit}`, signal ? { signal } : {});
  return response.data;
}
