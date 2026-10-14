import { Link, useLocation } from 'react-router-dom';
import { useSessionInfo } from 'shell/auth';
import { CATALOG_PATH } from '../links';
import { formatWhen } from '../model/dates';
import { fulfillmentLabel, paymentLabel, statusLabel } from '../model/labels';
import { formatPesos } from '../model/money';
import type { Order } from '../model/order';

interface Confirmed {
  readonly order: Order;
  readonly replayed: boolean;
}

/** What the checkout hands over through the address state. A page opened with nothing, or with anything else, has no order. */
function confirmedFrom(state: unknown): Confirmed | null {
  if (typeof state !== 'object' || state === null) return null;
  const { order, replayed } = state as { order?: unknown; replayed?: unknown };
  if (typeof order !== 'object' || order === null) return null;
  const candidate = order as Partial<Order>;
  if (typeof candidate.orderId !== 'string' || !Array.isArray(candidate.items) || typeof candidate.totalFormatted !== 'string') return null;
  return { order: order as Order, replayed: replayed === true };
}

/**
 * The order as the SERVICE made it: the names and prices of the purchase (RN-12) and the total it computed (RN-01), not what the
 * cart showed. There is no route to read one order back, so this lives only as long as the page.
 */
export function ConfirmationPage() {
  const confirmed = confirmedFrom(useLocation().state);
  const { signedIn } = useSessionInfo();

  if (confirmed === null) {
    return (
      <section>
        <h2>Tu pedido</h2>
        <p>No encontramos tu pedido reciente.</p>
        <Link to={CATALOG_PATH} className="btn btn-primary">
          Ir al catálogo
        </Link>
      </section>
    );
  }

  const { order, replayed } = confirmed;
  return (
    <section className="confirmation">
      <h2>Pedido recibido</h2>
      {replayed && (
        <p role="status" className="notice-success">
          Este pedido ya estaba registrado: no se creó uno nuevo.
        </p>
      )}
      <p>
        Número de pedido: <code>{order.orderId}</code>
      </p>
      <p>
        {formatWhen(order.createdAt)} · <strong>{statusLabel(order.status)}</strong>
      </p>

      <ul className="order-lines">
        {order.items.map((line) => (
          <li key={line.productId}>
            <span>
              {line.productName} × {line.quantity}
            </span>
            <span>{formatPesos(BigInt(line.subtotal))}</span>
          </li>
        ))}
      </ul>
      <p className="order-total">
        Total: <strong>{order.totalFormatted}</strong>
      </p>

      <dl className="order-details">
        <dt>Contacto</dt>
        <dd>
          {order.contactName} · {order.contactPhone}
        </dd>
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
      <p className="cart-note">La tienda confirma el pago cuando lo recibe.</p>

      <p className="cart-actions">
        <Link to={CATALOG_PATH} className="btn btn-primary">
          Seguir comprando
        </Link>{' '}
        {signedIn && <Link to="..">Ver mis pedidos</Link>}
      </p>
    </section>
  );
}
