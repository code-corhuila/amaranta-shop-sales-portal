// The words a person reads for what the service names. What this does not know is shown as it came: an order is never hidden
// because a new status or method appeared.

const STATUS: Record<string, string> = { PENDING: 'Pendiente de pago', PAID: 'Pagado' };
const FULFILLMENT: Record<string, string> = { PICKUP: 'Recoger en tienda', DELIVERY: 'A domicilio' };
const PAYMENT: Record<string, string> = { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia' };

export const statusLabel = (value: string): string => STATUS[value] ?? value;
export const fulfillmentLabel = (value: string): string => FULFILLMENT[value] ?? value;
export const paymentLabel = (value: string): string => PAYMENT[value] ?? value;
