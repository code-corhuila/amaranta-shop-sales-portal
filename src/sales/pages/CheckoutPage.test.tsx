import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { deferred } from '../../test/fixtures';
import { authState } from '../../test/shellAuthStub';
import { cart, resetCart } from '../../test/shellCartStub';
import type { Order } from '../model/order';

function renderAt(url = '/sales/checkout') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sales/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

const croquetas = { productId: 'p-1', name: 'Croquetas Adulto', price: 189_000, priceFormatted: '$ 189.000', imageUrl: null, quantity: 2 };
const juguete = { productId: 'p-2', name: 'Juguete para gato', price: 8_500, priceFormatted: '$ 8.500', imageUrl: null, quantity: 1 };

const order: Order = {
  orderId: '3f0b6c7e-0000-4000-8000-000000000001',
  status: 'PENDING',
  channel: 'ONLINE',
  total: 386_500,
  totalFormatted: '$ 386.500',
  items: [
    { productId: 'p-1', productName: 'Croquetas Adulto', unitPrice: 189_000, quantity: 2, subtotal: 378_000 },
    { productId: 'p-2', productName: 'Juguete para gato', unitPrice: 8_500, quantity: 1, subtotal: 8_500 },
  ],
  createdAt: '2026-10-14T15:00:00Z',
  fulfillmentMethod: 'PICKUP',
  paymentMethod: 'CASH',
  contactName: 'Ana Torres',
  contactPhone: '3001234567',
};

const created = { status: 201, data: order, location: null };

afterEach(() => {
  resetCart();
  authState.signedIn = true;
  authState.role = 'ADMIN';
});

async function fillPickup() {
  await userEvent.type(screen.getByLabelText(/^Nombre de contacto/), 'Ana Torres');
  await userEvent.type(screen.getByLabelText(/^Teléfono de contacto/), '300 123 4567');
  await userEvent.click(screen.getByLabelText('Recoger en tienda'));
  await userEvent.click(screen.getByLabelText('Efectivo'));
}

describe('placing an order with nothing in the cart', () => {
  it('says there is nothing to order, and shows no form', () => {
    renderAt();
    expect(screen.getByText('Tu carrito está vacío.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalog');
    expect(screen.queryByRole('button', { name: /confirmar pedido/i })).not.toBeInTheDocument();
  });
});

describe('the form of the order', () => {
  it('asks who to contact, how the order is received and how it is paid, each with its label', () => {
    cart.items = [croquetas, juguete];
    renderAt();
    expect(screen.getByRole('heading', { name: 'Confirma tu pedido' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre de contacto/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Teléfono de contacto/)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: '¿Cómo lo recibes?' })).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['PICKUP', 'DELIVERY']);
    expect(within(screen.getByRole('group', { name: '¿Cómo pagas?' })).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['CASH', 'CARD', 'TRANSFER']);
  });

  it('shows what is being bought, with the estimated total, and says the shop confirms the final one', () => {
    cart.items = [croquetas, juguete];
    renderAt();
    const summary = screen.getByRole('region', { name: 'Resumen del pedido' });
    expect(within(summary).getByText(/Croquetas Adulto/)).toBeInTheDocument();
    expect(within(summary).getByText('$ 386.500')).toBeInTheDocument();
    expect(within(summary).getByText(/total estimado/i)).toBeInTheDocument();
  });

  it('asks for the address only when the order is delivered', async () => {
    cart.items = [croquetas];
    renderAt();
    expect(screen.queryByLabelText(/^Dirección de entrega/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('A domicilio'));
    expect(screen.getByLabelText(/^Dirección de entrega/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Recoger en tienda'));
    expect(screen.queryByLabelText(/^Dirección de entrega/)).not.toBeInTheDocument();
  });

  it('says that a visitor buys without an account, and that a person with a session finds the order in theirs', () => {
    cart.items = [croquetas];
    authState.signedIn = false;
    const { unmount } = renderAt();
    expect(screen.getByText(/compras sin cuenta/i)).toBeInTheDocument();
    unmount();

    authState.signedIn = true;
    renderAt();
    expect(screen.getByText(/quedará en tus pedidos/i)).toBeInTheDocument();
  });

  it('says what is wrong beside each field, joined to it for a screen reader, puts the cursor on the first, and sends nothing', async () => {
    cart.items = [croquetas];
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    const name = screen.getByLabelText(/^Nombre de contacto/);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Escribe tu nombre.');
    expect(name).toHaveFocus();
    expect(screen.getByLabelText(/^Teléfono de contacto/)).toHaveAccessibleDescription('Escribe un teléfono de contacto.');
    expect(screen.getByText('Elige cómo quieres recibir tu pedido.')).toBeInTheDocument();
    expect(screen.getByText('Elige cómo vas a pagar.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('asks for the address beside its field when the order is delivered', async () => {
    cart.items = [croquetas];
    renderAt();
    await userEvent.type(screen.getByLabelText(/^Nombre de contacto/), 'Ana Torres');
    await userEvent.type(screen.getByLabelText(/^Teléfono de contacto/), '3001234567');
    await userEvent.click(screen.getByLabelText('A domicilio'));
    await userEvent.click(screen.getByLabelText('Tarjeta'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(screen.getByLabelText(/^Dirección de entrega/)).toHaveAccessibleDescription('Escribe la dirección de entrega.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe('placing the order', () => {
  it('sends the ids and the quantities with a key, empties the cart, and shows the order the service made', async () => {
    cart.items = [croquetas, juguete];
    vi.mocked(apiClient.post).mockResolvedValue(created);
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/orders',
      {
        items: [
          { productId: 'p-1', quantity: 2 },
          { productId: 'p-2', quantity: 1 },
        ],
        fulfillmentMethod: 'PICKUP',
        paymentMethod: 'CASH',
        contactName: 'Ana Torres',
        contactPhone: '300 123 4567',
      },
      { idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    );
    expect(cart.clear).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Pedido recibido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar pedido/i })).not.toBeInTheDocument();
  });

  it('disables the button while it is pending, so a double click cannot place two orders', async () => {
    cart.items = [croquetas];
    const pending = deferred<typeof created>();
    vi.mocked(apiClient.post).mockReturnValue(pending.promise);
    renderAt();
    await fillPickup();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    const button = screen.getByRole('button', { name: 'Procesando…' });
    expect(button).toBeDisabled();
    await userEvent.dblClick(button);
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    pending.resolve(created);
    expect(await screen.findByRole('heading', { name: 'Pedido recibido' })).toBeInTheDocument();
  });

  it('keeps the cart and what was typed when it fails, and says what happened with the reference', async () => {
    cart.items = [croquetas];
    vi.mocked(apiClient.post).mockRejectedValue({ status: 503, code: 'SERVICE_UNAVAILABLE', userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 'trace-5' });
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servicio no está disponible. Inténtalo más tarde.');
    expect(alert).toHaveTextContent('Tu carrito sigue guardado.');
    expect(alert).toHaveTextContent('Referencia: trace-5');
    expect(cart.clear).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Nombre de contacto/)).toHaveValue('Ana Torres');
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled();
  });

  it('says the shop is closed, with its hours, and keeps the cart', async () => {
    cart.items = [croquetas];
    vi.mocked(apiClient.post).mockRejectedValue({
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      userMessage: 'No se pudo completar la operación.',
      traceId: 't',
      details: [{ field: 'rule', message: 'INV-ORDER-008' }],
    });
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La tienda está cerrada. Atendemos de lunes a sábado');
    expect(cart.clear).not.toHaveBeenCalled();
  });

  it('puts what the service refused beside the field it named, without its English text', async () => {
    cart.items = [croquetas];
    vi.mocked(apiClient.post).mockRejectedValue({
      status: 400,
      code: 'VALIDATION_ERROR',
      userMessage: 'Revisa los datos ingresados.',
      traceId: 't',
      details: [{ field: 'contactPhone', message: 'must not be blank' }],
    });
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByLabelText(/^Teléfono de contacto/)).toHaveAccessibleDescription('Revisa este campo.');
    expect(screen.queryByText(/must not be blank/)).not.toBeInTheDocument();
  });
});

describe('the key of the intention (Annex H, CA-X3.2)', () => {
  it('sends the SAME key when the person confirms again after a lost connection, and says that nothing will be duplicated', async () => {
    cart.items = [croquetas];
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce({ status: 0, code: 'TIMEOUT', userMessage: 'La solicitud tardó demasiado. Inténtalo de nuevo.', traceId: 't-1' })
      .mockResolvedValueOnce(created);
    renderAt();
    await fillPickup();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no se duplicará');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByRole('heading', { name: 'Pedido recibido' })).toBeInTheDocument();

    const [first, second] = vi.mocked(apiClient.post).mock.calls;
    expect(first?.[2]).toEqual({ idempotencyKey: expect.any(String) });
    expect(second?.[2]).toEqual(first?.[2]);
    expect(first?.[1]).toEqual(second?.[1]);
  });

  it('sends a NEW key when the person changes the order after a failure: it is another intention', async () => {
    cart.items = [croquetas];
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce({ status: 0, code: 'NETWORK', userMessage: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.', traceId: 't-1' })
      .mockResolvedValueOnce(created);
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('alert');

    await userEvent.click(screen.getByLabelText('Tarjeta'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Pedido recibido' });

    const [first, second] = vi.mocked(apiClient.post).mock.calls;
    expect((second?.[2] as { idempotencyKey: string }).idempotencyKey).not.toBe((first?.[2] as { idempotencyKey: string }).idempotencyKey);
  });

  it('tells a person that the service already had the order when it answers a retry with 200, and empties the cart all the same', async () => {
    cart.items = [croquetas];
    vi.mocked(apiClient.post).mockResolvedValue({ status: 200, data: order, location: null });
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText(/este pedido ya estaba registrado/i)).toBeInTheDocument();
    expect(cart.clear).toHaveBeenCalledTimes(1);
  });
});

describe('the confirmation', () => {
  async function placeAndConfirm(overrides: Partial<Order> = {}) {
    cart.items = [croquetas, juguete];
    vi.mocked(apiClient.post).mockResolvedValue({ status: 201, data: { ...order, ...overrides }, location: null });
    renderAt();
    await fillPickup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Pedido recibido' });
  }

  it('shows the order as the service made it: the names and prices of the purchase, and the total it computed', async () => {
    await placeAndConfirm();
    expect(screen.getByText(/3f0b6c7e/)).toBeInTheDocument();
    expect(screen.getByText('Pendiente de pago')).toBeInTheDocument();
    expect(screen.getByText('$ 378.000')).toBeInTheDocument();
    expect(screen.getByText('$ 386.500')).toBeInTheDocument();
    expect(screen.getByText('Recoger en tienda')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText(/la tienda confirma el pago/i)).toBeInTheDocument();
  });

  it('shows the address of a delivery', async () => {
    await placeAndConfirm({ fulfillmentMethod: 'DELIVERY', deliveryAddress: 'Calle 10 # 5-20' });
    expect(screen.getByText('Calle 10 # 5-20')).toBeInTheDocument();
    expect(screen.getByText('A domicilio')).toBeInTheDocument();
  });

  it('offers to keep buying, and to see my orders to a person who is signed in', async () => {
    await placeAndConfirm();
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/catalog');
    expect(screen.getByRole('link', { name: 'Ver mis pedidos' })).toHaveAttribute('href', '/sales');
  });

  it('does not offer my orders to a visitor, who has none to see', async () => {
    authState.signedIn = false;
    await placeAndConfirm();
    expect(screen.queryByRole('link', { name: 'Ver mis pedidos' })).not.toBeInTheDocument();
  });

  it('says there is no recent order when the page is opened without one, instead of an empty page', () => {
    renderAt('/sales/confirmation');
    expect(screen.getByText('No encontramos tu pedido reciente.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalog');
  });
});
