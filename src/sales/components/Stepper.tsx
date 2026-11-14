const STEPS = ['Carrito', 'Tus datos', 'Confirmación'] as const;

/**
 * Where the person is in placing an order: cart, their data, confirmation. The steps already taken are checked, the current one is
 * the one that is lit (and the one a screen reader is told about), and the ones to come show their number. It draws no logic of its
 * own: each page says which step it is.
 */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="stepper" aria-label="Pasos del pedido">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'todo';
        return (
          <li key={label} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot" aria-hidden="true">
              {state === 'done' ? '✓' : number}
            </span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
