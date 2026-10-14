import type { ReactNode } from 'react';

/**
 * The shell's `shell/auth`, for tests: a test says who is signed in by changing `authState`. In the browser the real one
 * is loaded from the shell, where `RequireRole` also sends a visitor to the sign-in and back.
 */
export const authState: { signedIn: boolean; role: string | null } = { signedIn: true, role: 'ADMIN' };

export function useSessionInfo() {
  return { signedIn: authState.signedIn, role: authState.signedIn ? authState.role : null, subject: authState.signedIn ? 'u-1' : null };
}

export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  if (!authState.signedIn) return <p role="alert">Inicia sesión para continuar.</p>;
  if (authState.role !== role) return <p role="alert">No tienes permiso para ver esta sección.</p>;
  return <>{children}</>;
}
