import { Link, useSearchParams } from 'react-router-dom';
import { listAllOrders } from '../api/ordersApi';
import { FailureNotice } from '../components/FailureNotice';
import { Pager } from '../components/Pager';
import { useRequest } from '../hooks/useRequest';
import { formatWhen } from '../model/dates';
import { channelLabel, fulfillmentLabel, paymentLabel, statusLabel } from '../model/labels';

const PAGE_SIZE = 20;

/** The page the address asks for; anything that is not a whole number from 1 up is the first page. */
function parsePage(raw: string | null): number {
  return raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
}

/**
 * Every order of the shop, for the administrator: when, who placed it (an account, a visitor or the counter), how it is paid and
 * delivered, and how much. It is behind RequireRole in the routes, and the service checks the role again on every request.
 */
export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get('page'));
  const { state, retry } = useRequest((signal) => listAllOrders({ page, limit: PAGE_SIZE }, signal), `admin-orders:${page}`);

  return (
    <section>
      <p>
        <Link to="/admin">← Administración</Link>
      </p>
      <h2>Pedidos de la tienda</h2>
      <p className="cart-note">Todos los pedidos, del más reciente al más antiguo.</p>

      {state.status === 'loading' && <p role="status">Cargando los pedidos…</p>}
      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} />}

      {state.status === 'success' && state.data.data.length === 0 && <p>Todavía nadie ha hecho un pedido.</p>}

      {state.status === 'success' && state.data.data.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <caption>{`${state.data.meta.total} ${state.data.meta.total === 1 ? 'pedido' : 'pedidos'} en total`}</caption>
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Quién compró</th>
                  <th scope="col">Entrega y pago</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="cell-number">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.data.data.map((order) => (
                  <tr key={order.orderId}>
                    <th scope="row">#{order.orderId.slice(0, 8).toUpperCase()}</th>
                    <td>{formatWhen(order.createdAt)}</td>
                    <td>
                      <strong>{order.contactName}</strong>
                      <br />
                      <span className="cart-note">{order.contactPhone}</span>
                      <br />
                      {order.registeredCustomer ? (
                        <span className="chip chip-stock">Cliente con cuenta</span>
                      ) : (
                        <span className="chip chip-category">{order.channel === 'IN_STORE' ? 'Venta en mostrador' : 'Invitado, sin cuenta'}</span>
                      )}
                      <span className="chip chip-category">{channelLabel(order.channel)}</span>
                    </td>
                    <td>
                      {fulfillmentLabel(order.fulfillmentMethod)}
                      {order.deliveryAddress ? <span className="cart-note">{` · ${order.deliveryAddress}`}</span> : null}
                      <br />
                      <span className="cart-note">{paymentLabel(order.paymentMethod)}</span>
                    </td>
                    <td>
                      <span className={order.status === 'PAID' ? 'chip chip-stock' : 'chip chip-category'}>{statusLabel(order.status)}</span>
                    </td>
                    <td className="cell-number">
                      <strong>{order.totalFormatted}</strong>
                      <br />
                      <span className="cart-note">{`${order.units} ${order.units === 1 ? 'unidad' : 'unidades'}`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager current={state.data.meta.page} totalPages={state.data.meta.totalPages} onPage={(next) => setParams(next > 1 ? { page: String(next) } : {})} />
        </>
      )}
    </section>
  );
}
