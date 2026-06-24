// src/utils/compute.js

/**
 * Format dollar amount: $1,234.00 or -$1,234.00
 * @param {number|null} n
 * @returns {string}
 */
export function fmtDollars(n) {
  if (n == null) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}
