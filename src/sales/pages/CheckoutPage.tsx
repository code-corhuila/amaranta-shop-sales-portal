import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSessionInfo } from 'shell/auth';
import { useCart } from 'shell/cart';
import { placeOrder } from '../api/ordersApi';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { CATALOG_PATH } from '../links';
import { checkoutIssues, emptyCheckoutForm, fingerprint, validateCheckout, type CheckoutErrors, type CheckoutField, type CheckoutValues } from '../model/checkoutForm';
import { describeFailure, isCancelled } from '../model/failure';
import { cartTotal, formatPesos, lineSubtotal } from '../model/money';

/** The order the fields are in on the screen: the first one that is wrong gets the cursor. */
const ORDER: readonly CheckoutField[] = ['contactName', 'contactPhone', 'fulfillmentMethod', 'deliveryAddress', 'paymentMethod'];

const FULFILLMENT = [
  { value: 'PICKUP', label: 'Recoger en tienda' },
  { value: 'DELIVERY', label: 'A domicilio' },
];

const PAYMENT = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

interface TextFieldProps {
  readonly name: CheckoutField;
  readonly label: string;
  readonly hint?: string;
  readonly error: string | undefined;
  readonly children: (aria: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
}

/** A label, the field, and what is wrong with it beside it, joined for a screen reader (Annex H). */
function Field({ name, label, hint, error, children }: TextFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children({ id: name, 'aria-invalid': error !== undefined, 'aria-describedby': error ? errorId : hint ? hintId : undefined })}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface ChoiceProps {
  readonly name: CheckoutField;
  readonly legend: string;
  readonly options: readonly { value: string; label: string }[];
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  readonly register: (element: HTMLElement | null) => void;
}

/** A choice between a few things as cards the whole size of a finger: native radios, so the keyboard and the screen reader work. */
function Choice({ name, legend, options, value, error, onChange, register }: ChoiceProps) {
  const errorId = `${name}-error`;
  return (
    <fieldset className="choice" aria-describedby={error ? errorId : undefined}>
      <legend>{legend}</legend>
      <div className="choice-cards">
        {options.map((option, index) => (
          <label key={option.value} className="choice-card">
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} ref={index === 0 ? register : undefined} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Places the order. It validates first and says what is wrong beside each field, sends once (the button is disabled while a request
 * is pending), and sends with the key of the INTENTION: confirming the same order again after a lost connection reuses it, so the
 * service returns the order it made and nothing is duplicated; changing the order is another intention with another key.
 */
export function CheckoutPage() {
  const { items, clear } = useCart();
  const { signedIn } = useSessionInfo();
  const navigate = useNavigate();
  const idempotency = useIdempotencyKey();

  const [values, setValues] = useState<CheckoutValues>(emptyCheckoutForm());
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [general, setGeneral] = useState<{ message: string; reference: string | null } | null>(null);
  const [pending, setPending] = useState(false);
  const fields = useRef<Partial<Record<CheckoutField, HTMLElement | null>>>({});

  const set = (name: keyof CheckoutValues) => (value: string) => setValues((current) => ({ ...current, [name]: value }));
  const register = (name: CheckoutField) => (element: HTMLElement | null) => {
    fields.current[name] = element;
  };

  function show(next: CheckoutErrors) {
    setErrors(next);
    const first = ORDER.find((name) => next[name] !== undefined);
    if (first) fields.current[first]?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setGeneral(null);

    const checked = validateCheckout(values, items);
    if (!checked.ok) {
      if (checked.errors.items) setGeneral({ message: checked.errors.items, reference: null });
      return show(checked.errors);
    }
    setErrors({});

    setPending(true);
    try {
      const { order, replayed } = await placeOrder(checked.request, idempotency.keyFor(fingerprint(checked.request)));
      idempotency.renew();
      // Leave first, then empty the cart: the other way round, this screen would show an empty cart for a moment.
      void navigate('../confirmation', { replace: true, state: { order, replayed } });
      clear();
    } catch (failure) {
      if (isCancelled(failure)) return;
      const view = describeFailure(failure);
      const issues = checkoutIssues(view);
      if (issues.renewKey) idempotency.renew();
      show(issues.fields);
      setGeneral({ message: issues.general ?? 'Revisa los campos marcados.', reference: view.reference });
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0 && !pending) {
    return (
      <section>
        <h2>Confirma tu pedido</h2>
        <p>Tu carrito está vacío.</p>
        <Link to={CATALOG_PATH} className="btn btn-primary">
          Ir al catálogo
        </Link>
      </section>
    );
  }

  const delivery = values.fulfillmentMethod === 'DELIVERY';

  return (
    <section>
      <h2>Confirma tu pedido</h2>
      <p>
        <Link to="../cart">Volver al carrito</Link>
      </p>
      <p className="cart-note">{signedIn ? 'Este pedido quedará en tus pedidos.' : 'Compras sin cuenta: no necesitas iniciar sesión.'}</p>

      <div className="checkout-layout">
        <form onSubmit={submit} noValidate className="checkout-form">
          {general && (
            <div role="alert">
              <p>{general.message}</p>
              {general.reference && <p>Referencia: {general.reference}</p>}
            </div>
          )}

          <Field name="contactName" label="Nombre de contacto" error={errors.contactName}>
            {(aria) => <input {...aria} ref={register('contactName')} value={values.contactName} onChange={(e) => set('contactName')(e.target.value)} autoComplete="name" />}
          </Field>

          <Field name="contactPhone" label="Teléfono de contacto" hint="Para avisarte cuando tu pedido esté listo." error={errors.contactPhone}>
            {(aria) => <input {...aria} ref={register('contactPhone')} value={values.contactPhone} onChange={(e) => set('contactPhone')(e.target.value)} inputMode="tel" autoComplete="tel" />}
          </Field>

          <Choice
            name="fulfillmentMethod"
            legend="¿Cómo lo recibes?"
            options={FULFILLMENT}
            value={values.fulfillmentMethod}
            error={errors.fulfillmentMethod}
            onChange={set('fulfillmentMethod')}
            register={register('fulfillmentMethod')}
          />

          {delivery && (
            <Field name="deliveryAddress" label="Dirección de entrega" error={errors.deliveryAddress}>
              {(aria) => (
                <input {...aria} ref={register('deliveryAddress')} value={values.deliveryAddress} onChange={(e) => set('deliveryAddress')(e.target.value)} autoComplete="street-address" />
              )}
            </Field>
          )}

          <Choice
            name="paymentMethod"
            legend="¿Cómo pagas?"
            options={PAYMENT}
            value={values.paymentMethod}
            error={errors.paymentMethod}
            onChange={set('paymentMethod')}
            register={register('paymentMethod')}
          />
          <p className="cart-note">El pago se confirma en la tienda, cuando recibes o recoges tu pedido.</p>

          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Procesando…' : 'Confirmar pedido'}
          </button>
        </form>

        <section aria-label="Resumen del pedido" className="checkout-summary">
          <h3>Tu pedido</h3>
          <ul>
            {items.map((item) => (
              <li key={item.productId}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatPesos(lineSubtotal(item))}</span>
              </li>
            ))}
          </ul>
          <p>
            Total estimado: <strong>{formatPesos(cartTotal(items))}</strong>
          </p>
          <p className="cart-note">El total final lo confirma la tienda al hacer el pedido.</p>
        </section>
      </div>
    </section>
  );
}
