// What the shell lends to every portal (Annex H): the ONE HTTP client, already wired to the gateway and the session.
// It is loaded at run time through Module Federation; its types are written here because its code is not in this repository.
// A portal never calls `fetch` against the API and never handles a token: it asks for `/api/v1/...` through this.
declare module 'shell/apiClient' {
  export interface ShellApiResponse<T> {
    readonly status: number;
    readonly data: T;
    readonly location: string | null;
  }

  export interface ShellRequestOptions {
    /** A newer request cancels the older one with this, so the answer that arrives last cannot win. */
    readonly signal?: AbortSignal;
    /** One per intention, reused when the same intention is retried. */
    readonly idempotencyKey?: string;
  }

  export interface ShellApiClient {
    get<T = unknown>(path: string, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    post<T = unknown>(path: string, body?: unknown, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    put<T = unknown>(path: string, body?: unknown, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    patch<T = unknown>(path: string, body?: unknown, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    delete<T = unknown>(path: string, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
  }

  export const apiClient: ShellApiClient;
}

// What the shell lends so a screen can ask who is signed in WITHOUT holding the token: the role and the subject, and a guard
// for a screen that only one role may use. The services check the role again on every request.
declare module 'shell/auth' {
  import type { ReactNode } from 'react';

  export interface SessionInfo {
    readonly signedIn: boolean;
    readonly role: string | null;
    readonly subject: string | null;
  }

  export function useSessionInfo(): SessionInfo;
  export function RequireRole(props: { readonly role: string; readonly children: ReactNode }): ReactNode;
}

// The cart the shell keeps for every portal: this portal adds to it and the sales portal buys from it. It holds what a person
// chose (with the name and the price they saw) and never decides a total: that is the service's.
declare module 'shell/cart' {
  /** What the service accepts for one line of an order. */
  export const MAX_QUANTITY: number;

  export interface CartProduct {
    readonly productId: string;
    readonly name: string;
    /** Whole pesos. */
    readonly price: number;
    readonly priceFormatted: string;
    readonly imageUrl: string | null;
  }

  export interface CartItem extends CartProduct {
    readonly quantity: number;
  }

  export interface CartView {
    readonly items: readonly CartItem[];
    /** Units, not lines. */
    readonly count: number;
    /** Adds to the line of that product. `capped` says the line stopped at the limit. */
    add(product: CartProduct, quantity?: number): { readonly capped: boolean };
    setQuantity(productId: string, quantity: number): void;
    remove(productId: string): void;
    clear(): void;
  }

  export function useCart(): CartView;
}
