function toValidDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local date only. Example: "29 Jul 2026" */
export function formatLocalDate(value: string | number | Date): string {
  const date = toValidDate(value);
  if (!date) return '';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Local time only. Example: "6:45 PM" */
export function formatLocalTime(value: string | number | Date): string {
  const date = toValidDate(value);
  if (!date) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats an ISO timestamp for display in the user's local timezone.
 * Example: "29 Jul 2026 • 6:45 PM"
 */
export function formatLocalDateTime(value: string | number | Date): string {
  const datePart = formatLocalDate(value);
  const timePart = formatLocalTime(value);
  if (!datePart || !timePart) return '';
  return `${datePart} • ${timePart}`;
}
