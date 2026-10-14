import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from 'shell/apiClient';
import App from './App';

describe('App, the component the shell mounts under /sales', () => {
  it('shows my orders at the route the shell mounted it on', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter initialEntries={['/sales']}>
        <Routes>
          <Route path="/sales/*" element={<App />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Mis pedidos' })).toBeInTheDocument();
  });
});
