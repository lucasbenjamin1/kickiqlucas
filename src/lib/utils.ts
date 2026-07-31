export function formatPercentage(numerator: number, denominator: number): string {
  if (denominator === 0) return '--%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
