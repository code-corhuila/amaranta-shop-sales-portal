import type { CheckoutRequest } from '../api/ordersApi';
import type { FailureView } from './failure';

/** Everything in a form is text until it is checked. */
export interface CheckoutValues {
  readonly contactName: string;
  readonly contactPhone: string;
  readonly fulfillmentMethod: string;
  readonly deliveryAddress: string;
  readonly paymentMethod: string;
}

export type CheckoutField = keyof CheckoutValues | 'items';
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export function emptyCheckoutForm(): CheckoutValues {
  return { contactName: '', contactPhone: '', fulfillmentMethod: '', deliveryAddress: '', paymentMethod: '' };
}

const FULFILLMENT = ['PICKUP', 'DELIVERY'];
const PAYMENT = ['CASH', 'CARD', 'TRANSFER'];
const PHONE_CHARACTERS = /^[\d\s+\-()]+$/;

export type CheckoutResult = { readonly ok: true; readonly request: CheckoutRequest } | { readonly ok: false; readonly errors: CheckoutErrors };

/**
 * What the person typed and what the cart holds, as the order the service takes: the ids and the quantities, never a price or a
 * total (the service computes them from the products it reserves, RN-01 and RN-12). Whatever is wrong is said at once.
 */
export function validateCheckout(values: CheckoutValues, cart: readonly { readonly productId: string; readonly quantity: number }[]): CheckoutResult {
  const errors: CheckoutErrors = {};
  const name = values.contactName.trim();
  const phone = values.contactPhone.trim();
  const address = values.deliveryAddress.trim();

  if (cart.length === 0) errors.items = 'Tu carrito está vacío.';
  if (name === '') errors.contactName = 'Escribe tu nombre.';

  if (phone === '') errors.contactPhone = 'Escribe un teléfono de contacto.';
  else if (!PHONE_CHARACTERS.test(phone)) errors.contactPhone = 'El teléfono solo puede llevar números, espacios, + o -.';
  else if (phone.replace(/\D/g, '').length < 7) errors.contactPhone = 'Escribe un teléfono con al menos 7 dígitos.';

  if (!FULFILLMENT.includes(values.fulfillmentMethod)) errors.fulfillmentMethod = 'Elige cómo quieres recibir tu pedido.';
  else if (values.fulfillmentMethod === 'DELIVERY' && address === '') errors.deliveryAddress = 'Escribe la dirección de entrega.';

  if (!PAYMENT.includes(values.paymentMethod)) errors.paymentMethod = 'Elige cómo vas a pagar.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    request: {
      items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      fulfillmentMethod: values.fulfillmentMethod,
      paymentMethod: values.paymentMethod,
      contactName: name,
      contactPhone: phone,
      // A pickup stores no address (CA-C1.7): it is not sent, whatever was typed before the person changed their mind.
      ...(values.fulfillmentMethod === 'DELIVERY' ? { deliveryAddress: address } : {}),
    },
  };
}

/** What makes two attempts the same intention: the order itself. The keys of the request are built in a fixed order. */
export function fingerprint(request: CheckoutRequest): string {
  return JSON.stringify(request);
}

export interface CheckoutIssues {
  /** Beside the field. */
  readonly fields: CheckoutErrors;
  /** For the whole form, when the service said something that belongs to no field. */
  readonly general: string | null;
  /** True when the service refused the key itself: the next attempt needs a new one. */
  readonly renewKey: boolean;
}

const FIELDS: readonly string[] = ['contactName', 'contactPhone', 'fulfillmentMethod', 'deliveryAddress', 'paymentMethod'];

const RULES: Record<string, string> = {
  'INV-ORDER-008': 'La tienda está cerrada. Atendemos de lunes a sábado, de 8:00 a. m. a 12:00 m. y de 2:00 p. m. a 6:00 p. m. (hora de Bogotá). Los domingos no abrimos.',
  PRODUCT_NOT_FOUND: 'Alguno de los productos de tu carrito ya no está disponible. Quítalo e inténtalo de nuevo.',
  'INV-PRODUCT-002': 'No hay existencias suficientes de alguno de los productos de tu carrito. Reduce la cantidad e inténtalo de nuevo.',
  'INV-ORDER-003': 'Revisa tu carrito e inténtalo de nuevo.',
  'INV-ORDER-004': 'Revisa tu carrito e inténtalo de nuevo.',
  'INV-ORDER-ITEM-001': 'Revisa tu carrito e inténtalo de nuevo.',
};

/**
 * What the service refused, in the words of the person. The service writes for a developer (in English, naming a rule), so its
 * text is never shown: the field it named gets a neutral line, and the rule it broke is translated.
 */
export function checkoutIssues(failure: FailureView): CheckoutIssues {
  const fields: CheckoutErrors = {};
  let general: string | null = null;
  let renewKey = false;

  for (const { field, message } of failure.details) {
    if (FIELDS.includes(field)) fields[field as CheckoutField] = 'Revisa este campo.';
    else if (field === 'items' || field.startsWith('items[')) general = 'Revisa tu carrito: alguno de los productos no es válido.';
    else if (field === 'Idempotency-Key') {
      renewKey = true;
      general = 'No pudimos preparar tu pedido. Inténtalo de nuevo.';
    } else if (field === 'rule' && RULES[message]) general = RULES[message] as string;
  }

  if (general === null && Object.keys(fields).length === 0) {
    if (failure.status === 401) general = `${failure.message} Puedes volver a confirmar para comprar como invitado.`;
    else if (failure.status === 0) general = `${failure.message} Tu pedido pudo haberse creado. Vuelve a confirmar: no se duplicará.`;
    else if (failure.status === 503) general = `${failure.message} Tu carrito sigue guardado.`;
    else general = failure.message;
  }
  return { fields, general, renewKey };
}
