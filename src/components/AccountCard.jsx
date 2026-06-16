import { fmtDollars, computeDrawdownSeries } from "../utils/compute.js";
import { DrawdownChart } from "./DrawdownChart.jsx";
import { T, btn, Card } from "../utils/theme.jsx";
import { getOutcome } from "../utils/tradeHelpers.js";

const TYPE_LABELS = { eval:"Eval", pa:"PA", personal:"Personal" };

// ── AccountCard ───────────────────────────────────────────────────────────────
export function AccountCard({a, trades, settings={}, onEdit, onDelete}) {
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
          <div style={{display:"flex",gap:8}}>
            <button style={btn("ghost")} onClick={()=>onEdit(a)}>Edit</button>
            <button style={btn("danger")} onClick={()=>onDelete(a.id)}>✕</button>
          </div>
        </div>

        {/* Balance row */}
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
      </div>
    </Card>
  );
}
