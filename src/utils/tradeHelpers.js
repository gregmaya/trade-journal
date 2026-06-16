// src/utils/tradeHelpers.js
// Shared trade computation helpers

// Compute outcome dynamically from stored dollars + current USD threshold
export function getOutcome(trade, settings) {
  const dollars = trade.fill?.netPnlDollars ?? 0;
  const threshold = settings?.beThresholdUsd ?? 50;
  if (Math.abs(dollars) <= threshold) return "be";
  return dollars > 0 ? "win" : "loss";
}

// Direction-aware timestamp helpers
export function entryTimestamp(fill) {
  return fill.direction === "Short" ? fill.soldTimestamp : fill.boughtTimestamp;
}

export function exitTimestamp(fill) {
  return fill.direction === "Short" ? fill.boughtTimestamp : fill.soldTimestamp;
}

export function fmtTicksInt(n) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + Math.round(n) + "t";
}
