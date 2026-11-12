import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stepper } from './Stepper';

describe('the steps of the order', () => {
  it('lists the three steps in the order the person goes through them', () => {
    render(<Stepper current={1} />);
    const steps = within(screen.getByRole('list', { name: 'Pasos del pedido' })).getAllByRole('listitem');
    expect(steps.map((step) => step.querySelector('.step-label')?.textContent)).toEqual(['Carrito', 'Tus datos', 'Confirmación']);
  });

  it('says which step the person is on, for a screen reader', () => {
    render(<Stepper current={2} />);
    const current = screen.getAllByRole('listitem').filter((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Tus datos');
  });

  it('shows the steps already taken as done, with a check, and the ones to come as pending', () => {
    render(<Stepper current={3} />);
    const [cart, data, confirmation] = screen.getAllByRole('listitem');
    expect(cart).toHaveClass('step-done');
    expect(cart).toHaveTextContent('✓');
    expect(data).toHaveClass('step-done');
    expect(confirmation).toHaveClass('step-current');
  });

  it('shows the number of a step that has not been taken yet', () => {
    render(<Stepper current={1} />);
    const [, data, confirmation] = screen.getAllByRole('listitem');
    expect(data).toHaveClass('step-todo');
    expect(data).toHaveTextContent('2');
    expect(confirmation).toHaveTextContent('3');
  });
});
