export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function fmtDate(d: string): string {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${m}/${dd}/${y.slice(2)}`;
}

export function daysUntil(d: string): number | null {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - new Date(todayStr()).getTime()) / 86400000);
}
