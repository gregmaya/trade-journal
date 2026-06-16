import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { fmtDollars } from "../utils/compute.js";
import { T } from "../utils/theme.jsx";

// XAxis label formatter
function fmtDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length < 3) return d;
  return `${+parts[1]}/${+parts[2]}`;
}

// Tooltip content component
function ChartTooltip({active, payload, label}) {
  if (!active || !payload || !payload.length) return null;
  const eod = payload.find(p => p.dataKey === "eodBalance");
  const fl = payload.find(p => p.dataKey === "floor");
  const dd = payload.find(p => p.dataKey === "trailingDD");
  const buf = eod && fl ? eod.value - fl.value : null;
  return (
    <div style={{background:T.card,border:`0.5px solid ${T.border2}`,borderRadius:6,padding:"8px 10px",fontSize:11}}>
      <div style={{color:T.hint,marginBottom:4}}>{fmtDate(label)}</div>
      {eod&&<div style={{color:T.green}}>Balance: {fmtDollars(eod.value)}</div>}
      {fl&&<div style={{color:T.red}}>Floor: {fmtDollars(fl.value)}</div>}
      {dd!=null&&<div style={{color:T.yellow}}>Trailing DD: {fmtDollars(dd.value)}</div>}
      {buf!=null&&<div style={{color:T.muted}}>Buffer: {fmtDollars(buf)}</div>}
    </div>
  );
}

// ── DrawdownChart ─────────────────────────────────────────────────────────────
// Props:
//   seriesWithDD — array of { date, eodBalance, floor, trailingDD, ... }
//   account      — account object (for domain, profitTarget, lockLevel)
//   profitTargetLine — number (startingBalance + profitTarget)
export function DrawdownChart({ seriesWithDD, account, profitTargetLine }) {
  if (seriesWithDD.length === 0) {
    return (
      <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:T.hint,fontSize:12,marginBottom:6,background:T.surface,borderRadius:8}}>
        No trades yet
      </div>
    );
  }

  return (
    <div style={{height:160,marginBottom:6}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={seriesWithDD} margin={{top:4,right:44,left:0,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:9,fill:T.hint}} tickFormatter={fmtDate} interval="preserveStartEnd"/>
          <YAxis yAxisId="bal"
            domain={[account.startingBalance-(account.drawdownBuffer||2000)-200, account.startingBalance+(account.profitTarget||3000)+200]}
            tickLine={false} axisLine={false}
            tick={{fontSize:9,fill:T.hint}}
            tickFormatter={v=>"$"+(v/1000).toFixed(1)+"k"}
            width={42}
            label={{ value: 'Balance', angle: -90, position: 'insideLeft', offset: 10, style: { fill: T.muted, fontSize: 11 } }}
          />
          <YAxis yAxisId="dd" orientation="right" tickLine={false} axisLine={false}
            tick={{fontSize:9,fill:T.yellow}}
            tickFormatter={v=>"$"+(v/1000).toFixed(1)+"k"}
            width={38}
            label={{ value: 'DD Floor', angle: 90, position: 'insideRight', offset: 10, style: { fill: T.muted, fontSize: 11 } }}
          />
          <Tooltip content={<ChartTooltip/>}/>
          {account.profitTarget>0&&<ReferenceLine yAxisId="bal" y={profitTargetLine} stroke={T.green} strokeDasharray="4 2" strokeWidth={1}/>}
          {account.lockLevel != null && (
            <ReferenceLine yAxisId="bal" y={account.lockLevel} stroke={T.indigo} strokeDasharray="3 3" strokeWidth={1}/>
          )}
          <Line yAxisId="bal" type="monotone" dataKey="eodBalance" stroke={T.green} strokeWidth={2} dot={false} name="Balance"/>
          <Line yAxisId="bal" type="monotone" dataKey="floor" stroke={T.red} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Floor"/>
          <Line yAxisId="dd" type="monotone" dataKey="trailingDD" stroke={T.yellow} strokeWidth={1.5} strokeDasharray="3 2" dot={false} name="Trailing DD"/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
