import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure, isCancelled, type FailureView } from '../model/failure';

export type RequestState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly failure: FailureView }
  | { readonly status: 'success'; readonly data: T };

/**
 * Runs one request per `key` and gives the screen the state to draw: loading, error or success.
 *
 * A newer request replaces the older one (Annex H): the older is cancelled when the key changes or the screen goes away,
 * and even if its answer arrives after all, it is ignored. Without that, a slow answer overwrites a fast one and the
 * screen shows the filter the person already left.
 */
export function useRequest<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<RequestState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    latest.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      },
      (failure: unknown) => {
        // A request this screen cancelled is not a failure, and neither is an answer that arrives after it left.
        if (controller.signal.aborted || isCancelled(failure)) return;
        setState({ status: 'error', failure: describeFailure(failure) });
      },
    );
    return () => controller.abort();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
