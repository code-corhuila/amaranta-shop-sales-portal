import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from 'shell/auth';
import './sales/sales.css';
import { CartPage } from './sales/pages/CartPage';
import { CheckoutPage } from './sales/pages/CheckoutPage';
import { ConfirmationPage } from './sales/pages/ConfirmationPage';
import { MyOrdersPage } from './sales/pages/MyOrdersPage';

/**
 * What the shell mounts under /sales (it exposes this as `./App`). The shell owns the router: the routes here are relative to
 * where the shell mounted the portal, so the portal does not know its own prefix.
 *
 * Buying needs no account (the cart, the checkout and the confirmation are open to a visitor); seeing my orders needs a person.
 */
export default function App() {
  return (
    <Routes>
      <Route
        index
        element={
          <RequireAuth>
            <MyOrdersPage />
          </RequireAuth>
        }
      />
      <Route path="cart" element={<CartPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="confirmation" element={<ConfirmationPage />} />
    </Routes>
  );
}
