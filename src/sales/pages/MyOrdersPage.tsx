import { Link, useSearchParams } from 'react-router-dom';
import { listMyOrders } from '../api/ordersApi';
import { FailureNotice } from '../components/FailureNotice';
import { Pager } from '../components/Pager';
import { useRequest } from '../hooks/useRequest';
import { CATALOG_PATH } from '../links';
import { formatWhen } from '../model/dates';
import { fulfillmentLabel, paymentLabel, statusLabel } from '../model/labels';

const PAGE_SIZE = 20;

/** The page the address asks for; anything that is not a whole number from 1 up is the first page. */
function parsePage(raw: string | null): number {
  return raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
}

/**
 * My orders, newest first, with the four states of Annex H. It is behind RequireAuth: the gateway refuses a request with no
 * credential, and the service answers only with the orders of the person the token names.
 */
export function MyOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get('page'));
  const { state, retry } = useRequest((signal) => listMyOrders({ page, limit: PAGE_SIZE }, signal), `orders:${page}`);

  return (
    <section>
      <h2>Mis pedidos</h2>

      {state.status === 'loading' && <p role="status">Cargando tus pedidos…</p>}
      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} />}

      {state.status === 'success' && state.data.data.length === 0 && (
        <div>
          <p>Todavía no tienes pedidos.</p>
          <Link to={CATALOG_PATH} className="btn btn-primary">
            Ir al catálogo
          </Link>
        </div>
      )}

      {state.status === 'success' && state.data.data.length > 0 && (
        <>
          <ol className="orders" aria-label="Mis pedidos">
            {state.data.data.map((order) => (
              <li key={order.orderId} className="order-card">
                <div className="order-head">
                  <h3>
                    <span aria-label="Número de pedido">#{order.orderId.slice(0, 8).toUpperCase()}</span>
                  </h3>
                  <span className={order.status === 'PAID' ? 'chip chip-stock' : 'chip chip-category'}>{statusLabel(order.status)}</span>
                </div>
                <p className="cart-note">{formatWhen(order.createdAt)}</p>
                <ul className="order-lines">
                  {order.items.map((line) => (
                    <li key={line.productId}>
                      {line.productName} × {line.quantity}
                    </li>
                  ))}
                </ul>
                <p className="order-total">
                  Total: <strong>{order.totalFormatted}</strong>
                </p>
                <dl className="order-details">
                  <dt>Entrega</dt>
                  <dd>{fulfillmentLabel(order.fulfillmentMethod)}</dd>
                  {order.deliveryAddress && (
                    <>
                      <dt>Dirección</dt>
                      <dd>{order.deliveryAddress}</dd>
                    </>
                  )}
                  <dt>Pago</dt>
                  <dd>{paymentLabel(order.paymentMethod)}</dd>
                </dl>
              </li>
            ))}
          </ol>
          <Pager current={state.data.meta.page} totalPages={state.data.meta.totalPages} onPage={(next) => setParams(next > 1 ? { page: String(next) } : {})} />
          <p>
            <Link to={CATALOG_PATH}>Seguir comprando</Link>
          </p>
        </>
      )}
    </section>
  );
}
