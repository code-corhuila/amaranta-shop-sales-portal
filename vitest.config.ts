import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests do not load Module Federation: `shell/apiClient` is replaced by a stub, and a test says what each request answers.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Tests run in a Linux container, where the path of the URL is the path of the file.
    alias: {
      'shell/apiClient': new URL('./src/test/shellStub.ts', import.meta.url).pathname,
      'shell/auth': new URL('./src/test/shellAuthStub.tsx', import.meta.url).pathname,
      'shell/cart': new URL('./src/test/shellCartStub.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Vitest empties every imported stylesheet unless told to process it, and the style test reads the CSS itself.
    css: { include: [/src\/sales\/.*\.css/] },
    restoreMocks: true,
  },
});
