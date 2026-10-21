import { FieldReport } from './types';

export function severityStyle(value: string, styles: any) {
  if (value === 'Mild') return styles.severityBlue;
  if (value === 'Moderate') return styles.severityAmber;
  if (value === 'Severe') return styles.severityOrange;
  if (value === 'Highly severe') return styles.severityRed;
  return styles.severityMuted;
}

export function shortProvince(province: string) {
  return province === 'Negros Oriental'
    ? 'Oriental'
    : province === 'Negros Occidental'
    ? 'Occidental'
    : province;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase())
      .join('') || 'S'
  );
}

export function formatDate(value: string) {
  if (!value) return '—';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-PH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

export function roleName(role: string) {
  return role
    .replace(/^ROLE_/, '')
    .toLowerCase()
    .replace(/(^|_)\w/g, value => value.replace('_', ' ').toUpperCase());
}
