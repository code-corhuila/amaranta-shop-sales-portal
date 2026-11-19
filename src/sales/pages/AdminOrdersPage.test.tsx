import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { authState } from '../../test/shellAuthStub';
import type { AdminOrder } from '../model/order';

function renderAt(url = '/sales/admin/orders') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sales/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

function order(id: string, overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    orderId: `${id}0000-0000-4000-8000-000000000001`,
    status: 'PENDING',
    channel: 'ONLINE',
    total: 386_500,
    totalFormatted: '$ 386.500',
    units: 3,
    items: [{ productId: 'p-1', productName: 'Croquetas Adulto', unitPrice: 189_000, quantity: 2, subtotal: 378_000 }],
    createdAt: '2026-10-14T15:00:00Z',
    fulfillmentMethod: 'PICKUP',
    paymentMethod: 'CASH',
    contactName: 'Ana Torres',
    contactPhone: '3001234567',
    customerId: '11111111-1111-4111-8111-111111111111',
    registeredCustomer: true,
    ...overrides,
  };
}

const page = (orders: AdminOrder[], meta: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) => ({
  status: 200,
  location: null,
  data: { data: orders, meta: { page: 1, limit: 20, total: orders.length, totalPages: orders.length === 0 ? 0 : 1, ...meta } },
});

afterEach(() => {
  authState.signedIn = true;
  authState.role = 'ADMIN';
  vi.mocked(apiClient.get).mockReset();
});

describe('the orders of the shop, for the administrator', () => {
  it('lists every order and says who placed each one: an account, a visitor or the counter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      page([
        order('aaaaaaaa'),
        order('bbbbbbbb', { contactName: 'Luis Pérez', registeredCustomer: false }),
        order('cccccccc', { contactName: 'Marta Ruiz', registeredCustomer: false, channel: 'IN_STORE', status: 'PAID' }),
      ]),
    );
    renderAt();

    const table = await screen.findByRole('table');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/orders?page=1&limit=20', expect.anything());
    expect(within(table).getByText('3 pedidos en total')).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Ana Torres')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Cliente con cuenta')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Invitado, sin cuenta')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Venta en mostrador')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Pagado')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('$ 386.500')).toBeInTheDocument();
  });

  it('asks the next page when the administrator moves on', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([order('aaaaaaaa')], { total: 30, totalPages: 2 }));
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/v1/admin/orders?page=2&limit=20', expect.anything());
  });

  it('says so when nobody has ordered yet', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([]));
    renderAt();
    expect(await screen.findByText(/nadie ha hecho un pedido/i)).toBeInTheDocument();
  });

  it('shows the failure, with a way to try again, when the service does not answer', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('down'));
    renderAt();
    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('does not show the orders of everyone to a customer, and does not even ask for them', () => {
    authState.role = 'CUSTOMER';
    renderAt();
    expect(screen.getByRole('alert')).toHaveTextContent(/no tienes permiso/i);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
