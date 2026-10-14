import { Link } from 'react-router-dom';
import { MAX_QUANTITY, useCart } from 'shell/cart';
import { CATALOG_PATH } from '../links';
import { cartTotal, formatPesos, lineSubtotal } from '../model/money';

/** What the person chose, before placing the order. The cart is the shell's; this only shows it and changes it. */
export function CartPage() {
  const { items, setQuantity, remove } = useCart();

  return (
    <section>
      <h2>Tu carrito</h2>

      {items.length === 0 ? (
        <div>
          <p>Tu carrito está vacío.</p>
          <Link to={CATALOG_PATH} className="btn btn-primary">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <>
          <ul className="cart-lines">
            {items.map((item) => (
              <li key={item.productId} aria-label={item.name} className="cart-line">
                {item.imageUrl && <img className="cart-photo" src={item.imageUrl} alt="" loading="lazy" width={64} height={64} />}
                <div className="cart-line-info">
                  <h3>{item.name}</h3>
                  <p>{item.priceFormatted}</p>
                </div>
                <div className="cart-quantity">
                  <button
                    type="button"
                    aria-label={`Una unidad menos de ${item.name}`}
                    disabled={item.quantity <= 1}
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Una unidad más de ${item.name}`}
                    disabled={item.quantity >= MAX_QUANTITY}
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <p className="cart-subtotal">{formatPesos(lineSubtotal(item))}</p>
                <button type="button" className="btn-danger" aria-label={`Quitar ${item.name} del carrito`} onClick={() => remove(item.productId)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-total">
            <p>
              Total estimado: <strong>{formatPesos(cartTotal(items))}</strong>
            </p>
            <p className="cart-note">El total final lo confirma la tienda al hacer el pedido.</p>
          </div>

          <p className="cart-actions">
            <Link to="../checkout" className="btn btn-primary">
              Continuar con el pedido
            </Link>{' '}
            <Link to={CATALOG_PATH}>Seguir comprando</Link>
          </p>
        </>
      )}
    </section>
  );
}
