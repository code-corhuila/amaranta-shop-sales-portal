import { describe, expect, it } from 'vitest';
import css from './sales.css?raw';

/**
 * The portal draws with the tokens the SHELL defines (src/styles/tokens.css in amaranta-shop-front), so the whole application
 * changes colour in one place and a portal cannot drift from the design system (ADR-007). This list is the part of that
 * contract the portal relies on; a token the shell does not define would silently draw nothing.
 */
const SHELL_TOKENS = new Set([
  '--color-ember-50', '--color-ember-100', '--color-ember-200', '--color-ember-300', '--color-ember-400', '--color-ember-500', '--color-ember-600', '--color-ember-700',
  '--color-ocean-50', '--color-ocean-100', '--color-ocean-200', '--color-ocean-600', '--color-ocean-700',
  '--color-cream-50', '--color-cream-100', '--color-ink-900', '--color-ink-muted',
  '--font-family-display', '--font-family-sans',
  '--radius-lg', '--radius-xl2', '--radius-full', '--shadow-card',
  '--surface', '--field-border', '--field-error', '--alert-success-bg', '--alert-success-text', '--alert-success-border',
]);

const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the stylesheet of the portal', () => {
  it('has rules to check', () => {
    expect(rules.length).toBeGreaterThan(500);
  });

  it('takes every colour from a token of the shell: it has no colour of its own', () => {
    // A literal colour is a hex, an rgb()/hsl() or a named colour that is not a keyword.
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rules).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  it('uses only tokens the shell defines', () => {
    const used = [...rules.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string);
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((name) => !SHELL_TOKENS.has(name))).toEqual([]);
  });

  it('never takes away the ring that shows the keyboard where it is', () => {
    expect(rules).not.toMatch(/outline\s*:\s*(none|0)\b/);
  });

  it('puts the form and the summary side by side on a wide screen and one above the other on a narrow one', () => {
    expect(rules).toMatch(/\.checkout-layout\s*\{[^}]*display:\s*grid/);
    expect(rules).toMatch(/@media \(max-width:[^)]+\)\s*\{[^}]*\.checkout-layout\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('highlights the choice that is selected, the way the design system does for a radio inside a card', () => {
    expect(rules).toMatch(/\.choice-card:has\(input:checked\)\s*\{[^}]*border-color:\s*var\(--color-ember-400\)/);
    expect(rules).toMatch(/\.choice-card:has\(input:focus-visible\)/);
  });

  it('draws the way the design system asks: cards with the large radius and the tinted shadow', () => {
    expect(rules).toMatch(/\.order-card\s*\{[^}]*border-radius:\s*var\(--radius-xl2\)/);
    expect(rules).toMatch(/\.order-card\s*\{[^}]*box-shadow:\s*var\(--shadow-card\)/);
  });
});
