// src/components/CombinedProfitChart.jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

const LINE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7"];

function fmtDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length < 3) return d;
  return `${+parts[1]}/${+parts[2]}`;
}

// Props:
//   accounts — ACCOUNTS array
//   seriesByAccount — { [accountId]: [{date, pct}] }
//   profitPct / drawdownPct — reference line values (e.g. +10 / -10)
//   T — theme tokens
export function CombinedProfitChart({ accounts, seriesByAccount, profitPct, drawdownPct, T }) {
  // Merge all per-account series into a single date-indexed array
  const dateSet = new Set();
  for (const acc of accounts) {
    for (const pt of seriesByAccount[acc.id] || []) dateSet.add(pt.date);
  }
  const dates = [...dateSet].sort();

  if (dates.length === 0) {
    return (
      <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: T.hint, fontSize: 12, background: T.surface, borderRadius: 8 }}>
        No trades yet
      </div>
    );
  }

  const data = dates.map(date => {
    const row = { date };
    for (const acc of accounts) {
      const pt = (seriesByAccount[acc.id] || []).find(p => p.date === date);
      if (pt) row[acc.id] = parseFloat(pt.pct.toFixed(2));
    }
    return row;
  });

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.hint }} tickFormatter={fmtDate} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.hint }} tickFormatter={v => v + "%"} width={40} />
          <Tooltip
            formatter={(v, name) => [v + "%", accounts.find(a => a.id === name)?.label || name]}
            labelFormatter={fmtDate}
            contentStyle={{ background: T.card, border: `0.5px solid ${T.border2}`, borderRadius: 6, fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={value => accounts.find(a => a.id === value)?.label || value} />
          {profitPct != null && <ReferenceLine y={profitPct} stroke={T.green} strokeDasharray="4 2" strokeWidth={1} />}
          {drawdownPct != null && <ReferenceLine y={drawdownPct} stroke={T.red} strokeDasharray="4 2" strokeWidth={1} />}
          {accounts.map((acc, i) => (
            <Line key={acc.id} type="monotone" dataKey={acc.id} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls name={acc.id} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
