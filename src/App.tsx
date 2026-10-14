import { Route, Routes } from 'react-router-dom';
import { CartPage } from './sales/pages/CartPage';

/**
 * What the shell mounts under /sales (it exposes this as `./App`). The shell owns the router: the routes here are relative to
 * where the shell mounted the portal, so the portal does not know its own prefix.
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<h2>Ventas</h2>} />
      <Route path="cart" element={<CartPage />} />
    </Routes>
  );
}
