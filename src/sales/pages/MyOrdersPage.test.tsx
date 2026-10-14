import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { authState } from '../../test/shellAuthStub';
import type { Order } from '../model/order';

function renderAt(url = '/sales') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sales/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

function order(id: string, overrides: Partial<Order> = {}): Order {
  return {
    orderId: `${id}0000-0000-4000-8000-000000000001`,
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
    ...overrides,
  };
}

const page = (orders: Order[], meta: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) => ({
  status: 200,
  location: null,
  data: { data: orders, meta: { page: 1, limit: 20, total: orders.length, totalPages: orders.length === 0 ? 0 : 1, ...meta } },
});

afterEach(() => {
  authState.signedIn = true;
  authState.role = 'ADMIN';
});

describe('my orders', () => {
  it('asks a visitor to sign in, without asking the service for anything', () => {
    authState.signedIn = false;
    renderAt();
    expect(screen.getByRole('alert')).toHaveTextContent('Inicia sesión');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('says it is loading while it waits', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    renderAt();
    expect(screen.getByRole('heading', { name: 'Mis pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/cargando tus pedidos/i);
  });

  it('asks for a page of 20, from the address', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([order('3f0b6c7e')]));
    renderAt('/sales?page=2');
    await screen.findByRole('list', { name: 'Mis pedidos' });
    expect(vi.mocked(apiClient.get).mock.calls[0]?.[0]).toBe('/api/v1/orders?page=2&limit=20');
  });

  it('shows each order as it was made: its number, when, its state in words, what it holds, and the total the service computed', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([order('3f0b6c7e'), order('9a1d2c4b', { status: 'PAID', fulfillmentMethod: 'DELIVERY', deliveryAddress: 'Calle 10 # 5-20', paymentMethod: 'CARD', totalFormatted: '$ 8.500', items: [{ productId: 'p-2', productName: 'Juguete para gato', unitPrice: 8_500, quantity: 1, subtotal: 8_500 }] })]));
    renderAt();
    const list = await screen.findByRole('list', { name: 'Mis pedidos' });
    // The cards are the direct children of the list: the lines of each order are lists inside them.
    const [first, second] = Array.from(list.children) as [HTMLElement, HTMLElement];

    expect(within(first).getByText('#3F0B6C7E')).toBeInTheDocument();
    expect(within(first).getByText('Pendiente de pago')).toBeInTheDocument();
    expect(within(first).getByText(/Croquetas Adulto × 2/)).toBeInTheDocument();
    expect(within(first).getByText(/Juguete para gato × 1/)).toBeInTheDocument();
    expect(within(first).getByText('$ 386.500')).toBeInTheDocument();
    expect(within(first).getByText(/2026/)).toBeInTheDocument();
    expect(within(first).getByText('Recoger en tienda')).toBeInTheDocument();
    expect(within(first).getByText('Efectivo')).toBeInTheDocument();

    expect(within(second).getByText('Pagado')).toBeInTheDocument();
    expect(within(second).getByText('A domicilio')).toBeInTheDocument();
    expect(within(second).getByText('Calle 10 # 5-20')).toBeInTheDocument();
  });

  it('keeps the order the service gave: newest first', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([order('aaaaaaaa'), order('bbbbbbbb'), order('cccccccc')]));
    renderAt();
    const list = await screen.findByRole('list', { name: 'Mis pedidos' });
    expect(within(list).getAllByText(/^#[A-F0-9]{8}$/).map((n) => n.textContent)).toEqual(['#AAAAAAAA', '#BBBBBBBB', '#CCCCCCCC']);
  });

  it('says there is nothing yet, and takes the person to the catalog', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([]));
    renderAt();
    expect(await screen.findByText('Todavía no tienes pedidos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalog');
  });

  it('says what went wrong, with the reference, and tries again when asked', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ status: 503, code: 'SERVICE_UNAVAILABLE', userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 'trace-3' })
      .mockResolvedValueOnce(page([order('3f0b6c7e')]));
    renderAt();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servicio no está disponible. Inténtalo más tarde.');
    expect(alert).toHaveTextContent('Referencia: trace-3');
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('list', { name: 'Mis pedidos' })).toBeInTheDocument();
  });

  it('moves one page at a time', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      const requested = Number(new URL(path, 'http://x').searchParams.get('page'));
      return page([order(`p${requested}000000`.slice(0, 8))], { page: requested, total: 45, totalPages: 3 });
    });
    renderAt();
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('offers to keep buying', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([order('3f0b6c7e')]));
    renderAt();
    await screen.findByRole('list', { name: 'Mis pedidos' });
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/catalog');
  });
});
