// src/connector/mtconnect.js
// v2 connector: mtconnectapi.com. Swap this file for v3 (Python) without touching anything else.

import { mapMtConnectTrade } from '../utils/mapMtConnect.js'

const BASE_URL = 'https://www.mtconnectapi.com'

function toHex(str) {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Resolves broker friendly name → IP:port via mtconnectapi.com /Search.
 * Call once per account during setup; store result in accounts.js.
 */
export async function resolveBrokerAddress(serverName, apiKey) {
  const url = `${BASE_URL}/?a=Search&apikey=${encodeURIComponent(apiKey)}&s=${encodeURIComponent(serverName)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Server lookup failed: HTTP ${res.status}`)
  const data = await res.json()
  const first = Array.isArray(data) ? data[0] : data
  const addr = first?.address ?? first?.Address
  if (!addr) throw new Error(`No address found for: ${serverName}`)
  return addr
}

/**
 * Fetches trade history for one account.
 *
 * @param {Object} account     — from ACCOUNTS (serverAddress must be filled in)
 * @param {Object} credentials — { apiKey: string, investorPasswords: { [accountId]: string } }
 * @param {number} [lastTicket=0] — 0 = full history
 * @returns {Promise<import('../utils/tradeSchema.js').Trade[]>}
 */
export async function fetchTrades(account, credentials, lastTicket = 0) {
  const { apiKey, investorPasswords } = credentials
  const password = investorPasswords[account.id]

  if (!apiKey)   throw new Error('Missing API key')
  if (!password) throw new Error(`No investor password for ${account.label}`)
  if (!account.serverAddress) throw new Error(`Server address not set for ${account.label} — run resolveBrokerAddress() first`)

  const params = new URLSearchParams({
    a: 'getTradeHistory',
    apikey: apiKey,
    ac: account.login,
    t: account.serverAddress,
    p: toHex(password),
    pl: 'MT5',
    l: String(lastTicket),
  })

  const res = await fetch(`${BASE_URL}/?${params}`)
  if (!res.ok) throw new Error(`MT5 fetch failed: HTTP ${res.status}`)

  const data = await res.json()
  if (data?.status === 'error' || data?.Status === 'Error') {
    throw new Error(data.message ?? data.Message ?? 'API returned error')
  }

  const rawTrades = Array.isArray(data) ? data
    : (data.data ?? data.Data ?? data.trades ?? data.Trades ?? [])
  return rawTrades.map(raw => mapMtConnectTrade(raw, account.id))
}
