import { describe, expect, it } from 'vitest';
import type { FailureView } from './failure';
import { checkoutIssues, emptyCheckoutForm, fingerprint, validateCheckout, type CheckoutValues } from './checkoutForm';

const cart = [
  { productId: 'p-1', quantity: 2 },
  { productId: 'p-2', quantity: 1 },
];

const pickup: CheckoutValues = {
  contactName: 'Ana Torres',
  contactPhone: '300 123 4567',
  fulfillmentMethod: 'PICKUP',
  deliveryAddress: '',
  paymentMethod: 'CASH',
};

describe('validateCheckout', () => {
  it('builds what the service takes from the cart and the form: only the ids and the quantities, never a price or a total', () => {
    expect(validateCheckout(pickup, cart)).toEqual({
      ok: true,
      request: {
        items: [
          { productId: 'p-1', quantity: 2 },
          { productId: 'p-2', quantity: 1 },
        ],
        fulfillmentMethod: 'PICKUP',
        paymentMethod: 'CASH',
        contactName: 'Ana Torres',
        contactPhone: '300 123 4567',
      },
    });
  });

  it('trims what was typed', () => {
    const result = validateCheckout({ ...pickup, contactName: '  Ana Torres ', contactPhone: ' 3001234567 ' }, cart);
    expect(result).toMatchObject({ ok: true, request: { contactName: 'Ana Torres', contactPhone: '3001234567' } });
  });

  it('sends the address for a delivery', () => {
    const result = validateCheckout({ ...pickup, fulfillmentMethod: 'DELIVERY', deliveryAddress: ' Calle 10 # 5-20 ' }, cart);
    expect(result).toMatchObject({ ok: true, request: { fulfillmentMethod: 'DELIVERY', deliveryAddress: 'Calle 10 # 5-20' } });
  });

  it('does not send an address for a pickup, even if one was typed before the person changed their mind (CA-C1.7)', () => {
    const result = validateCheckout({ ...pickup, deliveryAddress: 'Calle 10 # 5-20' }, cart);
    expect(result.ok).toBe(true);
    expect(result.ok && 'deliveryAddress' in result.request).toBe(false);
  });

  it('names everything that is wrong at once, in words, so the person fixes it in one go', () => {
    expect(validateCheckout(emptyCheckoutForm(), cart)).toEqual({
      ok: false,
      errors: {
        contactName: 'Escribe tu nombre.',
        contactPhone: 'Escribe un teléfono de contacto.',
        fulfillmentMethod: 'Elige cómo quieres recibir tu pedido.',
        paymentMethod: 'Elige cómo vas a pagar.',
      },
    });
  });

  it('treats a name or a phone of only spaces as empty (CA-C1.9)', () => {
    expect(validateCheckout({ ...pickup, contactName: '   ', contactPhone: '   ' }, cart)).toMatchObject({
      ok: false,
      errors: { contactName: 'Escribe tu nombre.', contactPhone: 'Escribe un teléfono de contacto.' },
    });
  });

  it('asks for the address when the order is delivered', () => {
    expect(validateCheckout({ ...pickup, fulfillmentMethod: 'DELIVERY', deliveryAddress: '   ' }, cart)).toEqual({
      ok: false,
      errors: { deliveryAddress: 'Escribe la dirección de entrega.' },
    });
  });

  it('wants a phone that can be a phone', () => {
    expect(validateCheckout({ ...pickup, contactPhone: '12345' }, cart)).toMatchObject({ ok: false, errors: { contactPhone: 'Escribe un teléfono con al menos 7 dígitos.' } });
    expect(validateCheckout({ ...pickup, contactPhone: 'llámame' }, cart)).toMatchObject({ ok: false, errors: { contactPhone: 'El teléfono solo puede llevar números, espacios, + o -.' } });
    expect(validateCheckout({ ...pickup, contactPhone: '+57 (300) 123-4567' }, cart)).toMatchObject({ ok: true });
  });

  it('refuses an empty cart: there is nothing to order', () => {
    expect(validateCheckout(pickup, [])).toEqual({ ok: false, errors: { items: 'Tu carrito está vacío.' } });
  });

  it('refuses a way of receiving or paying that the service does not know', () => {
    expect(validateCheckout({ ...pickup, fulfillmentMethod: 'TELEPORT' }, cart)).toMatchObject({ ok: false, errors: { fulfillmentMethod: 'Elige cómo quieres recibir tu pedido.' } });
    expect(validateCheckout({ ...pickup, paymentMethod: 'BARTER' }, cart)).toMatchObject({ ok: false, errors: { paymentMethod: 'Elige cómo vas a pagar.' } });
  });
});

describe('fingerprint: what makes two attempts the same intention', () => {
  const request = (overrides: Partial<CheckoutValues> = {}, items = cart) => {
    const result = validateCheckout({ ...pickup, ...overrides }, items);
    if (!result.ok) throw new Error('the test needs a valid order');
    return result.request;
  };

  it('is the same for the same order', () => {
    expect(fingerprint(request())).toBe(fingerprint(request()));
  });

  it('changes when anything the service would store changes', () => {
    const base = fingerprint(request());
    expect(fingerprint(request({ contactName: 'Otra Persona' }))).not.toBe(base);
    expect(fingerprint(request({ contactPhone: '3009999999' }))).not.toBe(base);
    expect(fingerprint(request({ paymentMethod: 'CARD' }))).not.toBe(base);
    expect(fingerprint(request({ fulfillmentMethod: 'DELIVERY', deliveryAddress: 'Calle 1' }))).not.toBe(base);
    expect(fingerprint(request({}, [{ productId: 'p-1', quantity: 3 }, { productId: 'p-2', quantity: 1 }]))).not.toBe(base);
    expect(fingerprint(request({}, [{ productId: 'p-1', quantity: 2 }]))).not.toBe(base);
  });

  it('does not change for what is not part of the order, like an address typed for a pickup', () => {
    expect(fingerprint(request({ deliveryAddress: 'Calle 10' }))).toBe(fingerprint(request()));
  });
});

describe('checkoutIssues: what the service refused, in the words of the person', () => {
  const failure = (overrides: Partial<FailureView>): FailureView => ({ message: 'Revisa los datos ingresados.', reference: 't-1', status: 400, code: 'VALIDATION_ERROR', details: [], ...overrides });

  it('puts what the service named beside the field, and never shows its English text', () => {
    const issues = checkoutIssues(failure({ details: [{ field: 'contactName', message: 'must not be blank' }, { field: 'deliveryAddress', message: 'is required for a delivery' }] }));
    expect(issues.fields).toEqual({ contactName: 'Revisa este campo.', deliveryAddress: 'Revisa este campo.' });
    expect(issues.general).toBeNull();
    expect(JSON.stringify(issues)).not.toContain('must not be blank');
  });

  it('tells about the cart when the service names a line', () => {
    const issues = checkoutIssues(failure({ details: [{ field: 'items[0].quantity', message: 'must be a whole number from 1 to 50' }] }));
    expect(issues.general).toBe('Revisa tu carrito: alguno de los productos no es válido.');
  });

  it('says the shop is closed, with its hours', () => {
    const issues = checkoutIssues(failure({ status: 422, code: 'BUSINESS_RULE_VIOLATION', details: [{ field: 'rule', message: 'INV-ORDER-008' }] }));
    expect(issues.general).toBe('La tienda está cerrada. Atendemos de lunes a sábado, de 8:00 a. m. a 12:00 m. y de 2:00 p. m. a 6:00 p. m. (hora de Bogotá). Los domingos no abrimos.');
  });

  it('says a product is no longer available', () => {
    const issues = checkoutIssues(failure({ status: 422, code: 'BUSINESS_RULE_VIOLATION', details: [{ field: 'rule', message: 'PRODUCT_NOT_FOUND' }] }));
    expect(issues.general).toBe('Alguno de los productos de tu carrito ya no está disponible. Quítalo e inténtalo de nuevo.');
  });

  it('says there is not enough stock', () => {
    const issues = checkoutIssues(failure({ status: 422, code: 'BUSINESS_RULE_VIOLATION', details: [{ field: 'rule', message: 'INV-PRODUCT-002' }] }));
    expect(issues.general).toBe('No hay existencias suficientes de alguno de los productos de tu carrito. Reduce la cantidad e inténtalo de nuevo.');
  });

  it('says that the session ended and that buying as a guest is still possible, and that nothing was reserved', () => {
    const issues = checkoutIssues(failure({ status: 401, code: 'UNAUTHORIZED', message: 'x' }, ));
    expect(issues.general).toContain('Puedes volver a confirmar para comprar como invitado.');
  });

  it('says that a lost connection may have placed the order, and that confirming again will not duplicate it', () => {
    const timeout = checkoutIssues(failure({ status: 0, code: 'TIMEOUT', message: 'no answer', details: [] }));
    expect(timeout.general).toContain('Tu pedido pudo haberse creado.');
    expect(timeout.general).toContain('no se duplicará');
    const network = checkoutIssues(failure({ status: 0, code: 'NETWORK' }));
    expect(network.general).toContain('no se duplicará');
  });

  it('says the cart is kept when the service is down', () => {
    const issues = checkoutIssues(failure({ status: 503, code: 'SERVICE_UNAVAILABLE', details: [] }));
    expect(issues.general).toContain('Tu carrito sigue guardado.');
  });

  it('asks for a new key when the service did not like the one sent', () => {
    const issues = checkoutIssues(failure({ details: [{ field: 'Idempotency-Key', message: 'header required, 8 to 128 characters' }] }));
    expect(issues.renewKey).toBe(true);
    expect(issues.general).toBe('No pudimos preparar tu pedido. Inténtalo de nuevo.');
  });

  it('keeps the same key for everything else, which created nothing', () => {
    expect(checkoutIssues(failure({ status: 503, code: 'SERVICE_UNAVAILABLE' })).renewKey).toBe(false);
    expect(checkoutIssues(failure({ status: 422, code: 'BUSINESS_RULE_VIOLATION', details: [{ field: 'rule', message: 'INV-ORDER-008' }] })).renewKey).toBe(false);
  });

  it('uses the message of the shell for anything it has no better words for', () => {
    expect(checkoutIssues(failure({ status: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error en el servidor. Inténtalo más tarde.', details: [] })).general).toBe(
      'Ocurrió un error en el servidor. Inténtalo más tarde.',
    );
  });
});
