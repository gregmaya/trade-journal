// src/utils/tradovate.js

const MICRO_SYMBOLS = ["MNQ", "MES", "MYM", "M2K"];

/**
 * @param {string} symbol
 * @returns {boolean}
 */
function isMicro(symbol) {
  return MICRO_SYMBOLS.some((prefix) => symbol.toUpperCase().startsWith(prefix));
}

/**
 * Determine tick value (dollars per tick per contract) from symbol.
 * @param {string} symbol
 * @returns {number}
 */
function tickValueForSymbol(symbol) {
  const s = symbol.toUpperCase();
  if (s.startsWith("MNQ")) return 0.50;
  if (s.startsWith("NQ")) return 2.00;
  if (s.startsWith("MES")) return 1.25;
  if (s.startsWith("ES")) return 12.50;
  if (s.startsWith("M2K")) return 0.10;
  return 0.50;
}

/**
 * Parse a Tradovate-formatted dollar string: "$275.00" → 275, "$(287.00)" → -287
 * @param {string} s
 * @returns {number}
 */
function parsePnl(s) {
  const str = (s || "").trim();
  const negative = str.includes("(");
  const cleaned = str.replace(/[$(),]/g, "");
  const val = parseFloat(cleaned);
  return negative ? -val : val;
}

/**
 * Parse "MM/DD/YYYY HH:mm:ss" → ISO string "YYYY-MM-DDTHH:mm:ss"
 * @param {string} ts
 * @returns {string}
 */
function parseTimestamp(ts) {
  if (!ts) return "";
  const [datePart, timePart] = ts.trim().split(" ");
  const [mm, dd, yyyy] = datePart.split("/");
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${timePart}`;
}

/**
 * Convert a naive local timestamp (no timezone) from sourceTimezone to NY (America/New_York).
 * Uses the browser Intl API — no external dependencies.
 * @param {string} isoNoTz - "YYYY-MM-DDTHH:mm:ss"
 * @param {string} sourceTimezone - IANA timezone name, e.g. "Europe/Berlin"
 * @returns {string} "YYYY-MM-DDTHH:mm:ss" in NY time
 */
export function convertToNY(isoNoTz, sourceTimezone) {
  if (!isoNoTz || !sourceTimezone || sourceTimezone === "America/New_York") return isoNoTz;
  try {
    // Treat the string as UTC to get a base Date object
    const rawUtc = new Date(isoNoTz + "Z");

    // Format rawUtc in the source timezone to get what wall-clock time that UTC instant shows there
    const fmtParts = (tz, d) => Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).formatToParts(d).map(x => [x.type, x.value])
    );

    const srcParts = fmtParts(sourceTimezone, rawUtc);
    // Build the wall-clock Date in source timezone (treated as UTC to get a comparable ms value)
    const srcHour = srcParts.hour === "24" ? "00" : srcParts.hour;
    const srcWall = new Date(
      `${srcParts.year}-${srcParts.month}-${srcParts.day}T${srcHour}:${srcParts.minute}:${srcParts.second}Z`
    );

    // sourceOffsetMs: how many ms the source timezone is ahead of UTC at this moment
    const sourceOffsetMs = srcWall.getTime() - rawUtc.getTime();

    // actualUtcMs: the real UTC instant when the CSV wall-clock time occurred in sourceTimezone
    const actualUtcMs = rawUtc.getTime() - sourceOffsetMs;

    // Format that UTC instant as NY time
    const nyParts = fmtParts("America/New_York", new Date(actualUtcMs));
    const nyHour = nyParts.hour === "24" ? "00" : nyParts.hour;
    return `${nyParts.year}-${nyParts.month}-${nyParts.day}T${nyHour}:${nyParts.minute}:${nyParts.second}`;
  } catch {
    return isoNoTz;
  }
}

/**
 * Parse a single CSV line respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

/**
 * Parse a Tradovate performance CSV into grouped trades.
 * @param {string} text - Raw CSV text
 * @param {string[]} existingBuyFillIds - buyFillIds already in the journal (for dedup)
 * @param {{ micro: number, mini: number }} commissions
 * @param {number} beThresholdUsd - Dollar amount within which a trade is classified BE
 * @param {string} [sourceTimezone] - IANA timezone of the CSV timestamps (e.g. "Europe/Berlin")
 * @returns {{ trades: import('../types').Trade[], skipped: number, errors: string[] }}
 */
export function parseTradovateCSV(text, existingBuyFillIds, commissions, beThresholdUsd, sourceTimezone) {
  const errors = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Find header row — must contain "buyFillId"
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const cols = parseCSVLine(lines[i]).map((x) => x.toLowerCase());
    if (cols.includes("buyfillid")) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }
  if (headerIdx === -1) {
    return { trades: [], skipped: 0, errors: ["Could not find header row (no buyFillId column)."] };
  }

  const col = (row, name) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };

  // Parse raw rows
  /** @type {Map<string, object[]>} */
  const groups = new Map();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = parseCSVLine(lines[i]);

    const buyFillId = col(row, "buyfillid");
    if (!buyFillId) continue;

    const sellFillId = col(row, "sellfillid");
    const symbol = col(row, "symbol");
    const tickSize = parseFloat(col(row, "_ticksize")) || 0.25;
    const qty = parseInt(col(row, "qty"), 10) || 0;
    const buyPrice = parseFloat(col(row, "buyprice")) || 0;
    const sellPrice = parseFloat(col(row, "sellprice")) || 0;
    const pnl = parsePnl(col(row, "pnl"));
    const boughtTimestamp = col(row, "boughttimestamp");
    const soldTimestamp = col(row, "soldtimestamp");

    if (!groups.has(buyFillId)) groups.set(buyFillId, []);
    groups.get(buyFillId).push({
      buyFillId, sellFillId, symbol, tickSize,
      qty, buyPrice, sellPrice, pnl,
      boughtTimestamp, soldTimestamp,
    });
  }

  const existingSet = new Set(existingBuyFillIds || []);
  let skipped = 0;
  /** @type {object[]} */
  const trades = [];

  for (const [buyFillId, rows] of groups) {
    // Dedup
    if (existingSet.has(buyFillId)) {
      skipped++;
      continue;
    }

    try {
      // Use first row for fields that are constant across partials
      const first = rows[0];
      const symbol = first.symbol;
      const tickSize = first.tickSize;
      const buyPrice = first.buyPrice;

      // Aggregate
      const totalQty = rows.reduce((s, r) => s + r.qty, 0);
      if (totalQty === 0) throw new Error("zero qty");
      const grossPnlDollars = rows.reduce((s, r) => s + r.pnl, 0);
      // Weighted avg sell price
      const avgSellPrice = rows.reduce((s, r) => s + r.sellPrice * r.qty, 0) / totalQty;
      const sellFillIds = rows.map((r) => r.sellFillId).filter(Boolean);

      // Timestamps — first boughtTimestamp, last soldTimestamp, converted to NY time
      const boughtTimestamp = convertToNY(parseTimestamp(first.boughtTimestamp), sourceTimezone);
      const soldTimestamp = convertToNY(parseTimestamp(rows[rows.length - 1].soldTimestamp), sourceTimezone);

      // Duration in seconds
      let durationSec = null;
      if (boughtTimestamp && soldTimestamp) {
        durationSec = Math.round(
          (new Date(soldTimestamp) - new Date(boughtTimestamp)) / 1000
        );
      }

      // Commission
      const commissionPerContract = isMicro(symbol)
        ? (commissions?.micro ?? 1.03)
        : (commissions?.mini ?? 3.50);
      const commissionTotal = totalQty * commissionPerContract;
      const netPnlDollars = grossPnlDollars - commissionTotal;

      // Tick value
      const tickValue = tickValueForSymbol(symbol);

      // Direction — inferred from timestamps: bought first = Long, sold first = Short
      const direction = boughtTimestamp <= soldTimestamp ? "Long" : "Short";

      // pnlTicks — (avgSellPrice - buyPrice) / tickSize is always correctly signed:
      // Long win: sell > buy → positive; Short win: sell > buy (shorted high, covered low) → positive
      const pnlTicks = parseFloat(((avgSellPrice - buyPrice) / tickSize).toFixed(2));

      // netPnlTicks — uses actual net dollars
      const netPnlTicks = netPnlDollars / (tickValue * totalQty);

      // Outcome — dollar-based
      const beUsd = beThresholdUsd ?? 50;
      const outcome = Math.abs(netPnlDollars) <= beUsd ? "be" : netPnlDollars > 0 ? "win" : "loss";

      trades.push({
        fill: {
          buyFillId,
          sellFillIds,
          symbol,
          qty: totalQty,
          buyPrice,
          avgSellPrice,
          tickSize,
          grossPnlDollars,
          commissionTotal,
          netPnlDollars,
          pnlTicks,
          netPnlTicks,
          direction,
          outcome,
          boughtTimestamp,
          soldTimestamp,
          durationSec,
          source: "tradovate",
        },
        journal: {
          accountId: "",
          riskTicks: null,
          rCollected: null,
          strategy: "NONE",
          tags: [],
          notes: "",
          tradingViewUrl: "",
          rating: 0,
        },
      });
    } catch (err) {
      errors.push(`buyFillId ${buyFillId}: ${err.message}`);
    }
  }

  return { trades, skipped, errors };
}
