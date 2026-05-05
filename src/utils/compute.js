// src/utils/compute.js

/**
 * Parse a timestamp into YYYY-MM-DD.
 * Handles:
 *   - ISO: "YYYY-MM-DDTHH:mm:ss" → "YYYY-MM-DD"
 *   - Legacy: "MM/DD/YYYY HH:mm:ss" → "YYYY-MM-DD"
 * @param {string} ts
 * @returns {string}
 */
export function timestampToDate(ts) {
  if (!ts) return "";
  // ISO format: YYYY-MM-DDT...
  if (ts.includes("T")) {
    return ts.split("T")[0];
  }
  // Legacy MM/DD/YYYY HH:mm:ss
  const datePart = ts.split(" ")[0];
  if (datePart.includes("/")) {
    const [mm, dd, yyyy] = datePart.split("/");
    if (yyyy) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return datePart;
}

/**
 * Compute R collected given pnlTicks and riskTicks.
 * Returns null if riskTicks is null/0.
 * @param {number|null} pnlTicks
 * @param {number|null} riskTicks
 * @returns {number|null}
 */
export function computeR(pnlTicks, riskTicks) {
  if (!riskTicks) return null;
  return parseFloat((pnlTicks / riskTicks).toFixed(2));
}

/**
 * Compute outcome for a trade given netPnlTicks and beThresholdTicks.
 * @param {number} netPnlTicks
 * @param {number} beThresholdTicks
 * @returns {"win"|"be"|"loss"}
 */
export function computeOutcome(netPnlTicks, beThresholdTicks) {
  if (Math.abs(netPnlTicks) <= beThresholdTicks) return "be";
  return netPnlTicks > 0 ? "win" : "loss";
}

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

/**
 * Format ticks: +55.0t or -12.0t
 * @param {number|null} n
 * @returns {string}
 */
export function fmtTicks(n) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "t";
}

/**
 * Format R: +5.5R or -1.2R
 * @param {number|null} n
 * @returns {string}
 */
export function fmtR(n) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "R";
}

/**
 * Compute win%, BE%, loss% stats for a set of trades.
 * BE trades are excluded from the win%/loss% denominator.
 * @param {object[]} trades
 * @returns {{ wins: number, losses: number, bes: number, total: number, winPct: number|null, bePct: number|null, lossPct: number|null }}
 */
export function computeWinStats(trades) {
  const wins = trades.filter((t) => t.fill.outcome === "win").length;
  const losses = trades.filter((t) => t.fill.outcome === "loss").length;
  const bes = trades.filter((t) => t.fill.outcome === "be").length;
  const total = trades.length;
  const decisive = wins + losses;
  return {
    wins,
    losses,
    bes,
    total,
    winPct: decisive > 0 ? (wins / decisive) * 100 : null,
    bePct: total > 0 ? (bes / total) * 100 : null,
    lossPct: decisive > 0 ? (losses / decisive) * 100 : null,
  };
}

/**
 * Compute EOD balance and trailing drawdown floor series for an account.
 *
 * Account shape expected:
 *   { startingBalance: number, drawdownBuffer: number, lockLevel?: number|null }
 *
 * lockLevel: once the trailing floor reaches this value it stops climbing
 * (i.e. floor = Math.min(floor, lockLevel) when floor >= lockLevel).
 *
 * @param {{ startingBalance: number, drawdownBuffer: number, lockLevel?: number|null }} account
 * @param {object[]} trades - all trades for this account
 * @returns {{ date: string, eodBalance: number, floor: number, buffer: number }[]}
 */
export function computeDrawdownSeries(account, trades) {
  // Group trades by date (YYYY-MM-DD from fill.soldTimestamp)
  /** @type {Map<string, number>} */
  const byDate = new Map();

  for (const trade of trades) {
    const date = timestampToDate(trade.fill?.soldTimestamp || "");
    if (!date) continue;
    const pnl = trade.fill?.netPnlDollars ?? 0;
    byDate.set(date, (byDate.get(date) || 0) + pnl);
  }

  // Sort dates ascending
  const sortedDates = [...byDate.keys()].sort();

  if (sortedDates.length === 0) return [];

  const result = [];
  let balance = account.startingBalance;
  let highWaterMark = account.startingBalance;
  const drawdownBuffer = account.drawdownBuffer ?? 0;
  const lockLevel = account.lockLevel ?? null;

  for (const date of sortedDates) {
    balance += byDate.get(date);
    highWaterMark = Math.max(highWaterMark, balance);

    let floor = highWaterMark - drawdownBuffer;

    // lockLevel: once the floor reaches lockLevel it stops increasing further
    if (lockLevel != null && floor >= lockLevel) {
      floor = lockLevel;
    }

    const buffer = balance - floor;
    result.push({ date, eodBalance: balance, floor, buffer });
  }

  return result;
}
