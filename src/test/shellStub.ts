import { vi } from 'vitest';

/**
 * The shell's client, for tests. In the browser `shell/apiClient` is loaded from the shell at run time; here the alias in
 * vitest.config.ts points to this, and a test says what each request answers.
 */
export const apiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};
