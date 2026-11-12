import type { FailureView } from '../model/failure';

interface Props {
  readonly failure: FailureView;
  readonly onRetry: () => void;
  /** False when trying again cannot help (the thing does not exist, or the address is not valid). */
  readonly retryable?: boolean;
}

/** The error state of a screen: what happened for a person, the reference to give, and a way to try again. */
export function FailureNotice({ failure, onRetry, retryable = true }: Props) {
  return (
    <div role="alert">
      <p>{failure.message}</p>
      {failure.reference && <p>Referencia: {failure.reference}</p>}
      {retryable && (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
