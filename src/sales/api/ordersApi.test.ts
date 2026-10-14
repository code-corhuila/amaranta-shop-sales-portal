import { apiClient } from 'shell/apiClient';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../model/order';
import { listMyOrders, placeOrder, type CheckoutRequest } from './ordersApi';

const order: Order = {
  orderId: '3f0b6c7e-0000-4000-8000-000000000001',
  status: 'PENDING',
  channel: 'ONLINE',
  total: 386_500,
  totalFormatted: '$ 386.500',
  items: [{ productId: 'p-1', productName: 'Croquetas Adulto', unitPrice: 189_000, quantity: 2, subtotal: 378_000 }],
  createdAt: '2026-10-14T15:00:00Z',
  fulfillmentMethod: 'PICKUP',
  paymentMethod: 'CASH',
  contactName: 'Ana Torres',
  contactPhone: '3001234567',
};

const request: CheckoutRequest = {
  items: [{ productId: 'p-1', quantity: 2 }],
  fulfillmentMethod: 'PICKUP',
  paymentMethod: 'CASH',
  contactName: 'Ana Torres',
  contactPhone: '3001234567',
};

const reply = <T>(data: T, status: number, location: string | null = null) => ({ status, data, location });

describe('placeOrder', () => {
  it('sends the order to the orders route with the key of the intention, as the service asks (CA-C1.5)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(reply(order, 201));
    await placeOrder(request, 'key-of-this-intention');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/orders', request, { idempotencyKey: 'key-of-this-intention' });
  });

  it('says the order was created when the service answers 201', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(reply(order, 201));
    await expect(placeOrder(request, 'k')).resolves.toEqual({ order, replayed: false });
  });

  it('says the order was already there when the service answers 200 to a retry (CA-C1.6): nothing new was created', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(reply(order, 200));
    await expect(placeOrder(request, 'k')).resolves.toEqual({ order, replayed: true });
  });

  it('passes the signal on, and lets a failure reach the screen as it is', async () => {
    const failure = { status: 422, code: 'BUSINESS_RULE_VIOLATION', userMessage: 'No se pudo completar la operación.', traceId: 't' };
    vi.mocked(apiClient.post).mockRejectedValue(failure);
    const controller = new AbortController();
    await expect(placeOrder(request, 'k', controller.signal)).rejects.toBe(failure);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/orders', request, { idempotencyKey: 'k', signal: controller.signal });
  });
});

describe('listMyOrders', () => {
  it('asks for a page of my orders', async () => {
    const page = { data: [order], meta: { page: 2, limit: 20, total: 21, totalPages: 2 } };
    vi.mocked(apiClient.get).mockResolvedValue(reply(page, 200));
    await expect(listMyOrders({ page: 2, limit: 20 })).resolves.toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/orders?page=2&limit=20', {});
  });
});
