import { useState } from "react";
import { fmtDollars, computeDrawdownSeries } from "../utils/compute.js";
import { DrawdownChart } from "./DrawdownChart.jsx";
import { T, btn, Card } from "../utils/theme.jsx";
import { getOutcome } from "../utils/tradeHelpers.js";
import {
  computeStats, computeSessionBreakdown,
  computeSymbolBreakdown, computeDailyPnl, computeHourHeatmap,
} from "../utils/analytics.js";
import { SessionChart }    from "./SessionChart.jsx";
import { SymbolTable }     from "./SymbolTable.jsx";
import { HeatmapChart }    from "./HeatmapChart.jsx";
import { MonthlyCalendar } from "./MonthlyCalendar.jsx";

// Classify NY-time hour into session label
function sessionLabel(hourNY) {
  if (hourNY >= 3  && hourNY < 8)  return 'london';
  if (hourNY >= 8  && hourNY < 10) return 'overlap';
  if (hourNY >= 9  && hourNY < 17) return 'new_york';
  return 'other';
}

// Convert a raw App.jsx trade to the shape analytics.js functions expect
function toAnalyticsTrade(t, settings) {
  const openTime = t.fill?.boughtTimestamp || "";
  let sl = 'other';
  if (openTime) {
    try {
      const d = new Date(openTime);
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/New_York',
      }).formatToParts(d);
      const h = parseInt(parts.find(p => p.type === 'hour').value);
      sl = sessionLabel(h);
    } catch {}
  }
  return {
    pnl:           t.fill?.netPnlDollars ?? 0,
    classification: getOutcome(t, settings ?? {}),
    openTime,
    closeTime:     t.fill?.soldTimestamp || "",
    symbol:        t.fill?.symbol || "—",
    sessionLabel:  sl,
  };
}

const Metric = ({ label, value, color = T.text }) => (
  <div style={{ background: T.surface, borderRadius: 6, padding: '10px 12px' }}>
    <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 500, color }}>{value}</div>
  </div>
);

const TYPE_LABELS = { eval:"Eval", pa:"PA", personal:"Personal" };

// ── AccountCard ───────────────────────────────────────────────────────────────
export function AccountCard({a, trades, settings={}, onEdit, onDelete}) {
  const [tab, setTab]           = useState("overview");
  const [calYear, setCalYear]   = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);

  const accountTrades = trades.filter(t => t.journal?.accountId === a.id);
  const netPnl = accountTrades.reduce((s,t) => s + (t.fill?.netPnlDollars||0), 0);
  const currentBalance = a.startingBalance + netPnl;
  const pnl = currentBalance - a.startingBalance;

  const showChart = a.type === "eval" || a.type === "pa";
  const series = showChart ? computeDrawdownSeries(a, accountTrades) : [];
  const lastEntry = series.length > 0 ? series[series.length - 1] : null;
  let _peakBal = series.length > 0 ? series[0].eodBalance : 0;
  const seriesWithDD = series.map(pt => {
    if (pt.eodBalance > _peakBal) _peakBal = pt.eodBalance;
    return { ...pt, trailingDD: parseFloat((_peakBal - pt.eodBalance).toFixed(2)) };
  });
  const profitTargetLine = a.startingBalance + (a.profitTarget || 0);

  // Buffer metric
  let bufferPct = null;
  let bufferColor = T.hint;
  if (lastEntry && a.drawdownBuffer > 0) {
    bufferPct = (lastEntry.buffer / a.drawdownBuffer) * 100;
    bufferColor = bufferPct > 50 ? T.green : bufferPct >= 25 ? T.yellow : T.red;
  }

  // Stats
  const wins = accountTrades.filter(t => getOutcome(t, settings) === "win").length;
  const losses = accountTrades.filter(t => getOutcome(t, settings) === "loss").length;
  const decisive = wins + losses;
  const winPct = decisive > 0 ? (wins / decisive * 100) : null;

  const typeBadgeColor = a.type === "pa" ? [T.indigo, T.indigoBg] : a.type === "personal" ? [T.hint, T.surface] : [T.green, T.greenBg];

  // Analytics adapter — convert trades to analytics.js shape once
  const analyticsTrades = accountTrades.map(t => toAnalyticsTrade(t, settings));

  return (
    <Card>
      <div style={{padding:"14px 16px"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <span style={{fontSize:15,fontWeight:500}}>{a.name}</span>
              <span style={{fontSize:10,fontWeight:500,padding:"2px 7px",borderRadius:4,background:typeBadgeColor[1],color:typeBadgeColor[0],border:`0.5px solid ${typeBadgeColor[0]}40`}}>
                {TYPE_LABELS[a.type] || a.type}
              </span>
            </div>
            <div style={{fontSize:11,color:T.hint}}>{a.firm} · {a.broker}{a.firmId ? ` · ${a.firmId}` : ""}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {/* Tab buttons */}
            {[["overview","Overview"],["analytics","Analytics"]].map(([v,l]) => (
              <button key={v} style={{...btn(tab===v?"primary":"ghost"),padding:"3px 10px",fontSize:11}} onClick={()=>setTab(v)}>{l}</button>
            ))}
            <button style={btn("ghost")} onClick={()=>onEdit(a)}>Edit</button>
            <button style={btn("danger")} onClick={()=>onDelete(a.id)}>✕</button>
          </div>
        </div>

        {/* Balance row — always visible */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[
            ["Starting", fmtDollars(a.startingBalance), T.text],
            ["Current", fmtDollars(currentBalance), T.text],
            ["P&L", fmtDollars(pnl), pnl >= 0 ? T.green : T.red],
          ].map(([l,v,c]) => (
            <div key={l} style={{background:T.surface,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,color:T.hint,marginBottom:2}}>{l}</div>
              <div style={{fontSize:13,fontWeight:500,color:c}}>{v}</div>
            </div>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <>
            {/* Drawdown chart */}
            {showChart && (
              <>
                <DrawdownChart seriesWithDD={seriesWithDD} account={a} profitTargetLine={profitTargetLine}/>

                {/* Buffer metric */}
                {lastEntry != null && (
                  <div style={{fontSize:12,color:bufferColor,marginBottom:10,fontWeight:500}}>
                    Buffer: {fmtDollars(lastEntry.buffer)}{bufferPct != null ? ` (${bufferPct.toFixed(0)}%)` : ""}
                  </div>
                )}
              </>
            )}

            {/* Stats row */}
            <div style={{display:"flex",gap:16,fontSize:11,color:T.hint,borderTop:`0.5px solid ${T.border}`,paddingTop:10,marginTop:4}}>
              <span>Trades: <strong style={{color:T.text}}>{accountTrades.length}</strong></span>
              <span>Win%: <strong style={{color:winPct != null ? (winPct >= 50 ? T.green : T.red) : T.hint}}>{winPct != null ? winPct.toFixed(0)+"%" : "—"}</strong></span>
              <span>Net P&amp;L: <strong style={{color:pnl >= 0 ? T.green : T.red}}>{fmtDollars(pnl)}</strong></span>
            </div>
          </>
        )}

        {/* ── Analytics tab ── */}
        {tab === "analytics" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {accountTrades.length === 0 ? (
              <div style={{fontSize:12,color:T.hint,textAlign:"center",padding:"24px 0"}}>No trades yet for this account.</div>
            ) : (() => {
              const s = computeStats(analyticsTrades);
              return (
                <>
                  {/* KPI summary row */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                    <Metric label="Win Rate"      value={`${Math.round(s.winRate * 100)}%`}            color={s.winRate >= 0.5 ? T.green : T.red} />
                    <Metric label="Profit Factor" value={s.profitFactor != null ? s.profitFactor.toFixed(2) : "—"} color={s.profitFactor != null ? (s.profitFactor >= 1.5 ? T.green : s.profitFactor >= 1 ? T.yellow : T.red) : T.hint} />
                    <Metric label="Avg Win"       value={`$${s.avgWin.toFixed(2)}`}                    color={T.green} />
                    <Metric label="Avg Loss"      value={`-$${s.avgLoss.toFixed(2)}`}                  color={T.red} />
                    <Metric label="Expectancy"    value={`$${s.expectancy.toFixed(2)}`}                color={s.expectancy >= 0 ? T.green : T.red} />
                    <Metric label="Best Trade"    value={`$${s.bestTrade.toFixed(2)}`}                 color={T.green} />
                    <Metric label="Worst Trade"   value={`$${s.worstTrade.toFixed(2)}`}                color={T.red} />
                  </div>

                  <SessionChart breakdown={computeSessionBreakdown(analyticsTrades)} T={T} />

                  <SymbolTable breakdown={computeSymbolBreakdown(analyticsTrades)} T={T} />

                  <HeatmapChart cells={computeHourHeatmap(analyticsTrades)} T={T} />

                  {/* Monthly calendar with month/year picker */}
                  <div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <select value={calMonth} onChange={e=>setCalMonth(Number(e.target.value))}
                        style={{background:T.surface,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 8px"}}>
                        {Array.from({length:12},(_,i) => (
                          <option key={i+1} value={i+1}>
                            {new Date(2000,i).toLocaleString('default',{month:'long'})}
                          </option>
                        ))}
                      </select>
                      <select value={calYear} onChange={e=>setCalYear(Number(e.target.value))}
                        style={{background:T.surface,color:T.text,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 8px"}}>
                        {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <MonthlyCalendar
                      dailyPnl={computeDailyPnl(analyticsTrades)}
                      year={calYear} month={calMonth} T={T} />
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </Card>
  );
}
