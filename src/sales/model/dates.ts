const WHEN = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

/** An instant in the shop's time. The service sends UTC; what a person reads is Bogotá time, whatever time zone the browser is in. */
export function formatWhen(iso: string): string {
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? iso : WHEN.format(instant);
}
