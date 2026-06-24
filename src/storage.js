// src/storage.js
let _handle = null;
const LS_KEY = "trade_journal_v1";
const LS_WARN_KEY = "trade_journal_fsa_warned";

export function fsaSupported() {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export function hasHandle() {
  return _handle !== null;
}

export async function openFile() {
  // Show file picker — user picks existing .json or creates new one
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Trade Journal", accept: { "application/json": [".json"] } }],
      multiple: false,
    });
    _handle = handle;
    return true;
  } catch (e) {
    if (e.name === "AbortError") return false;
    throw e;
  }
}

export async function createFile() {
  // For creating a new file
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "trade-journal.json",
      types: [{ description: "Trade Journal", accept: { "application/json": [".json"] } }],
    });
    _handle = handle;
    // Intentionally overwrites any existing file content — user chose "create new"
    await writeData(defaultData());
    return true;
  } catch (e) {
    if (e.name === "AbortError") return false;
    throw e;
  }
}

export async function readData() {
  if (!_handle) return null;
  const file = await _handle.getFile();
  const text = await file.text();
  try {
    return normalizeData(JSON.parse(text));
  } catch {
    return defaultData();
  }
}

/**
 * Backfills top-level keys missing from older persisted data and runs
 * one-time migrations (e.g. BE classification removal).
 * @param {object} data
 * @returns {object}
 */
function normalizeData(data) {
  return migrateClassifications({ ...defaultData(), ...data });
}

export async function writeData(data) {
  if (!_handle) {
    // fallback to localStorage
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return;
  }
  const writable = await _handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export function readLocalStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    return raw ? normalizeData(raw) : defaultData();
  } catch {
    return defaultData();
  }
}

export function defaultData() {
  return {
    trades: [],
    accounts: [],
    settings: {
      strategies: ["ORB", "ILM", "IMPULSE TRADE", "None"],
      tags: [],
      commissions: { micro: 1.03, mini: 3.50 },
    },
    dailyBotAssignments: {},
    mt5Accounts: [],
    bots: [],
    accountOverrides: {},
  };
}

/**
 * One-time normalizer: rewrites any persisted 'be' MT5 trade classification
 * to strict binary win/loss, since the BE concept no longer exists.
 * Idempotent — safe to run on every load.
 * @param {object} data
 * @returns {object}
 */
export function migrateClassifications(data) {
  if (!data?.trades?.some(t => t.classification === 'be')) return data;
  return {
    ...data,
    trades: data.trades.map(t =>
      t.classification === 'be'
        ? { ...t, classification: t.pnl > 0 ? 'win' : 'loss' }
        : t
    ),
  };
}

/**
 * Merges incoming trades into existing ones, deduplicating by id.
 * Existing trade wins on conflict so manual notes/tags/strategy are preserved.
 * @param {import('./utils/tradeSchema.js').Trade[]} existing
 * @param {import('./utils/tradeSchema.js').Trade[]} incoming
 * @returns {import('./utils/tradeSchema.js').Trade[]}
 */
export function mergeTrades(existing, incoming) {
  const byId = new Map(existing.map(t => [t.id, t]))
  for (const t of incoming) {
    if (!byId.has(t.id)) byId.set(t.id, t)
  }
  return Array.from(byId.values())
}
