// Compact currency for a calendar cell: "$87", "$1.2k", "-$450", "-$1.1k".
// Amounts round to whole dollars from $10 and to one decimal in "k" above
// $1000, so even large earnings stay within a ~44px cell without wrapping.
export function compactMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 100000) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 1000) {
    const k = Math.round((abs / 1000) * 10) / 10;
    // 999.96+ rounds to 1000.0 — drop the trailing ".0".
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  if (abs >= 10) return `${sign}$${Math.round(abs)}`;
  // Tiny amounts (under $10): keep cents when they matter, trimming trailing
  // zeros so "4.50" renders as "$4.5" and "4.00" as "$4".
  const cents = (Math.round(abs * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return `${sign}$${cents}`;
}
