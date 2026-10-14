import { describe, expect, it } from 'vitest';
import { fulfillmentLabel, paymentLabel, statusLabel } from './labels';

describe('the words a person reads for what the service names', () => {
  it('says what state an order is in', () => {
    expect(statusLabel('PENDING')).toBe('Pendiente de pago');
    expect(statusLabel('PAID')).toBe('Pagado');
  });

  it('says how it is received and how it is paid', () => {
    expect(fulfillmentLabel('PICKUP')).toBe('Recoger en tienda');
    expect(fulfillmentLabel('DELIVERY')).toBe('A domicilio');
    expect(paymentLabel('CASH')).toBe('Efectivo');
    expect(paymentLabel('CARD')).toBe('Tarjeta');
    expect(paymentLabel('TRANSFER')).toBe('Transferencia');
  });

  it('shows what it does not know as it came, instead of hiding the order', () => {
    expect(statusLabel('FULFILLED')).toBe('FULFILLED');
    expect(paymentLabel('BARTER')).toBe('BARTER');
  });
});
