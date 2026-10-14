import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App, the component the shell mounts under /sales', () => {
  it('names the area it shows, at the route the shell mounted it on', () => {
    render(
      <MemoryRouter initialEntries={['/sales']}>
        <Routes>
          <Route path="/sales/*" element={<App />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Ventas' })).toBeInTheDocument();
  });
});
