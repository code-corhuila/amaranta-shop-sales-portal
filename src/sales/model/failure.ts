/** One invalid field, as the services name it. */
export interface FieldIssue {
  readonly field: string;
  readonly message: string;
}

/**
 * What the shell's client throws when a request fails (its `ApiError`): the portal does not import that class, it only
 * relies on these fields, which Annex H promises every failure has. `code` and `details` come from the services' envelope.
 */
export interface ShellFailure {
  readonly status: number;
  /** The text for the person. Decided by the shell, in one place, by status. */
  readonly userMessage: string;
  /** The reference a person can give, and the line to find in the logs. */
  readonly traceId: string;
  readonly code?: string;
  readonly details?: readonly unknown[];
}

export interface FailureView {
  readonly message: string;
  readonly reference: string | null;
  readonly status: number | null;
  readonly code: string | null;
  /** The invalid fields the service named, so a form can say what is wrong next to each one. */
  readonly details: readonly FieldIssue[];
}

const UNEXPECTED = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

function isShellFailure(value: unknown): value is ShellFailure {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['status'] === 'number' && typeof candidate['userMessage'] === 'string' && typeof candidate['traceId'] === 'string';
}

function issues(details: readonly unknown[] | undefined): FieldIssue[] {
  return (details ?? []).flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { field, message } = entry as Record<string, unknown>;
    return typeof field === 'string' && typeof message === 'string' ? [{ field, message }] : [];
  });
}

/** What a screen shows for a failure. Anything that did not come from the shell gets a neutral text, never its own. */
export function describeFailure(failure: unknown): FailureView {
  if (isShellFailure(failure)) {
    return {
      message: failure.userMessage,
      reference: failure.traceId,
      status: failure.status,
      code: typeof failure.code === 'string' ? failure.code : null,
      details: issues(failure.details),
    };
  }
  return { message: UNEXPECTED, reference: null, status: null, code: null, details: [] };
}

/** A request the screen cancelled because a newer one replaced it: that is not a failure to show. */
export function isCancelled(failure: unknown): boolean {
  return failure instanceof DOMException && failure.name === 'AbortError';
}
