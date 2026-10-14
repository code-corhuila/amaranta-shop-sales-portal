import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Module Federation (Annex H, React). This portal is a REMOTE: the shell loads `./App` when the route /sales is opened,
 * and this portal borrows `shell/apiClient` from the shell. It never makes an HTTP client of its own, and it does not
 * know where the gateway is.
 */
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'salesPortal',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.tsx' },
      remotes: {
        shell: { type: 'module', name: 'shell', entry: 'http://localhost:4200/remoteEntry.js' },
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.0.0' },
      },
      shareStrategy: 'loaded-first',
    }),
  ],
  server: { port: 4202, strictPort: true },
  build: { target: 'esnext' },
});
