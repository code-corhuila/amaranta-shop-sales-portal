import { describe, expect, it } from 'vitest';

/**
 * The rule Annex H builds the whole split on: the HTTP client and the session live in the shell, and only there. A portal
 * that makes its own client ends up with one more place that handles a token, and its requests leave with no token and no
 * correlation id, in silence. These read the source of the portal and fail the build if it breaks the rule.
 */
const files = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx', '!./test/**', '!./**/*.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Comments may explain the rule, so they are not what is checked. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const forbidden: [string, RegExp][] = [
  ['its own HTTP call (fetch)', /(^|[^.\w])fetch\s*\(/],
  ['its own HTTP call (XMLHttpRequest)', /XMLHttpRequest/],
  ['an HTTP library of its own', /from ['"](axios|ky|got|superagent|node-fetch)['"]/],
  ['a token handled here (Authorization / Bearer)', /Authorization|Bearer/],
  ['browser storage, where a token could be kept', /localStorage|sessionStorage|document\.cookie/],
  ['the address of the gateway', /localhost:8000|\/\/gateway/],
  ['an internal route of a service', /\/internal\//],
];

describe('the portal obeys the rule of the shell (Annex H)', () => {
  it('has source files to check', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  it.each(forbidden)('contains no %s', (_name, pattern) => {
    const offenders = Object.entries(files)
      .filter(([, source]) => pattern.test(code(source)))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('names the routes of the API only in the api/ modules', () => {
    const users = Object.entries(files)
      .filter(([, source]) => /\/api\/v1\//.test(code(source)))
      .map(([path]) => path);
    for (const path of users) expect(path).toMatch(/^\.\/sales\/api\/[A-Za-z]+\.ts$/);
  });

  it('reaches the API only through shell/apiClient', () => {
    const users = Object.entries(files).filter(([, source]) => /\/api\/v1\//.test(code(source)));
    for (const [path, source] of users) expect(code(source), path).toContain("from 'shell/apiClient'");
  });

  it('does not keep a cart of its own: it uses the one the shell keeps, through shell/cart', () => {
    const cartUsers = Object.entries(files).filter(([, source]) => /useCart|cartStore|CartStore/.test(code(source)));
    for (const [path, source] of cartUsers) expect(code(source), path).toContain("from 'shell/cart'");
  });

  it('does not read the session except through shell/auth, which never hands over the token', () => {
    const sessionUsers = Object.entries(files).filter(([, source]) => /useSession|SessionStore|sessionStore/.test(code(source)));
    for (const [path, source] of sessionUsers) expect(code(source), path).toContain("from 'shell/auth'");
  });
});
