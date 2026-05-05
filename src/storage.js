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
    return JSON.parse(text);
  } catch {
    return defaultData();
  }
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
    return JSON.parse(localStorage.getItem(LS_KEY)) || defaultData();
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
      beThresholdTicks: 3,
      commissions: { micro: 1.03, mini: 3.50 },
    },
  };
}
