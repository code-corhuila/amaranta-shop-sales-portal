import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { cart, resetCart } from '../../test/shellCartStub';

function renderAt(url = '/sales/cart') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sales/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

const croquetas = { productId: 'p-1', name: 'Croquetas Adulto', price: 189_000, priceFormatted: '$ 189.000', imageUrl: 'https://example.test/a.png', quantity: 2 };
const juguete = { productId: 'p-2', name: 'Juguete para gato', price: 8_500, priceFormatted: '$ 8.500', imageUrl: null, quantity: 3 };

afterEach(resetCart);

describe('an empty cart', () => {
  it('says so, and takes the person to the catalog', () => {
    renderAt();
    expect(screen.getByRole('heading', { name: 'Tu carrito' })).toBeInTheDocument();
    expect(screen.getByText('Tu carrito está vacío.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalog');
    expect(screen.queryByRole('link', { name: /continuar con el pedido/i })).not.toBeInTheDocument();
  });
});

describe('a cart with products', () => {
  it('shows every line with its unit price, its quantity and its subtotal, computed exactly', () => {
    cart.items = [croquetas, juguete];
    renderAt();
    const first = screen.getByRole('listitem', { name: 'Croquetas Adulto' });
    expect(within(first).getByText('$ 189.000')).toBeInTheDocument();
    expect(within(first).getByText('2')).toBeInTheDocument();
    expect(within(first).getByText('$ 378.000')).toBeInTheDocument();

    const second = screen.getByRole('listitem', { name: 'Juguete para gato' });
    expect(within(second).getByText('$ 25.500')).toBeInTheDocument();
  });

  it('shows the total as an estimate, because the shop confirms the final one when the order is placed', () => {
    cart.items = [croquetas, juguete];
    renderAt();
    expect(screen.getByText('$ 403.500')).toBeInTheDocument();
    expect(screen.getByText(/total estimado/i)).toBeInTheDocument();
    expect(screen.getByText(/el total final lo confirma la tienda/i)).toBeInTheDocument();
  });

  it('adds a unit to a line, and takes one away', async () => {
    cart.items = [croquetas];
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Una unidad más de Croquetas Adulto' }));
    expect(cart.setQuantity).toHaveBeenCalledWith('p-1', 3);
    await userEvent.click(screen.getByRole('button', { name: 'Una unidad menos de Croquetas Adulto' }));
    expect(cart.setQuantity).toHaveBeenCalledWith('p-1', 1);
  });

  it('does not take the last unit away: removing a line is its own button', () => {
    cart.items = [{ ...croquetas, quantity: 1 }];
    renderAt();
    expect(screen.getByRole('button', { name: 'Una unidad menos de Croquetas Adulto' })).toBeDisabled();
  });

  it('does not offer more than the 50 the service accepts for a line', () => {
    cart.items = [{ ...croquetas, quantity: 50 }];
    renderAt();
    expect(screen.getByRole('button', { name: 'Una unidad más de Croquetas Adulto' })).toBeDisabled();
  });

  it('removes a line', async () => {
    cart.items = [croquetas, juguete];
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Juguete para gato del carrito' }));
    expect(cart.remove).toHaveBeenCalledWith('p-2');
  });

  it('goes on to place the order, and back to the catalog', () => {
    cart.items = [croquetas];
    renderAt();
    expect(screen.getByRole('link', { name: 'Continuar con el pedido' })).toHaveAttribute('href', '/sales/checkout');
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/catalog');
  });
});
