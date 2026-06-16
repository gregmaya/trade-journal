import { useState, useMemo } from "react";
import { fmtDollars, fmtR } from "../utils/compute.js";

// ── Tokens (duplicated from App.jsx — module-level constant) ──────────────────
const T = {
  bg: "var(--color-background-tertiary)",
  surface: "var(--color-background-secondary)",
  card: "var(--color-background-primary)",
  border: "var(--color-border-tertiary)",
  border2: "var(--color-border-secondary)",
  text: "var(--color-text-primary)",
  muted: "var(--color-text-secondary)",
  hint: "var(--color-text-tertiary)",
  green: "#10b981", greenBg: "rgba(16,185,129,0.12)",
  red: "#ef4444", redBg: "rgba(239,68,68,0.12)",
  yellow: "#f59e0b", yellowBg: "rgba(245,158,11,0.1)",
  indigo: "#6366f1", indigoBg: "rgba(99,102,241,0.12)",
};

const btn = (variant="primary") => ({
  padding:"6px 14px", borderRadius:6, fontSize:12, fontWeight:500, cursor:"pointer", border:"0.5px solid",
  fontFamily:"var(--font-sans)",
  ...(variant==="primary" ? { background:T.text, color:T.card, borderColor:"transparent" }
    : variant==="ghost" ? { background:"transparent", color:T.muted, borderColor:T.border2 }
    : variant==="danger" ? { background:T.redBg, color:T.red, borderColor:"transparent" }
    : {})
});

const Card = ({children, style={}}) => (
  <div style={{background:T.card, border:`0.5px solid ${T.border}`, borderRadius:"var(--border-radius-lg)", ...style}}>
    {children}
  </div>
);

function TH({children,style={}}) {
  return <th style={{textAlign:"left",padding:"7px 10px",borderBottom:`0.5px solid ${T.border}`,color:T.hint,fontWeight:500,fontSize:10,textTransform:"uppercase",letterSpacing:"0.6px",whiteSpace:"nowrap",...style}}>{children}</th>;
}
function TD({children,style={}}) {
  return <td style={{padding:"7px 10px",borderBottom:`0.5px solid ${T.border}`,fontSize:12,...style}}>{children}</td>;
}

function Tag({s}) {
  const colors = {ORB:[T.green,T.greenBg], ILM:[T.indigo,T.indigoBg], "IMPULSE TRADE":[T.yellow,T.yellowBg], None:[T.hint,"transparent"]};
  const [color,bg] = colors[s]||[T.hint,"transparent"];
  return <span style={{fontSize:10, fontWeight:500, padding:"2px 7px", borderRadius:4, background:bg, color, border:`0.5px solid ${color}40`}}>{s}</span>;
}

function Stars({value=0, onChange}) {
  const [h,setH]=useState(0);
  return <div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(i=>(
    <span key={i} style={{cursor:onChange?"pointer":"default",color:(h||value)>=i?T.yellow:T.hint,fontSize:14}}
      onMouseEnter={()=>onChange&&setH(i)} onMouseLeave={()=>onChange&&setH(0)}
      onClick={()=>onChange&&onChange(i)}>★</span>
  ))}</div>;
}

function getOutcome(trade, settings) {
  const dollars = trade.fill?.netPnlDollars ?? 0;
  const threshold = settings?.beThresholdUsd ?? 50;
  if (Math.abs(dollars) <= threshold) return "be";
  return dollars > 0 ? "win" : "loss";
}

function fmtTicksInt(n) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + Math.round(n) + "t";
}

function entryTimestamp(fill) {
  return fill.direction === "Short" ? fill.soldTimestamp : fill.boughtTimestamp;
}

// ── TradeLog ──────────────────────────────────────────────────────────────────
export function TradeLog({trades, accounts, settings={}, onEdit, onDelete}) {
  const [filters,setFilters]=useState({strategy:"",direction:"",account:"",search:""});
  const setF=(k,v)=>setFilters(f=>({...f,[k]:v}));
  const aMap=Object.fromEntries(accounts.map(a=>[a.id,a.name]));

  const filtered=useMemo(()=>{
    let r=[...trades];
    if(filters.strategy) r=r.filter(t=>t.journal?.strategy===filters.strategy);
    if(filters.direction) r=r.filter(t=>t.fill?.direction===filters.direction);
    if(filters.account) r=r.filter(t=>t.journal?.accountId===filters.account);
    if(filters.search){
      const q=filters.search.toLowerCase();
      r=r.filter(t=>
        (t.fill?.symbol||"").toLowerCase().includes(q)||
        (t.fill?.boughtTimestamp||"").includes(q)||
        (t.journal?.notes||"").toLowerCase().includes(q)||
        (t.journal?.strategy||"").toLowerCase().includes(q)
      );
    }
    return r.sort((a,b)=>{
      const da=a.fill?.boughtTimestamp||"";
      const db=b.fill?.boughtTimestamp||"";
      return db>da?1:-1;
    });
  },[trades,filters]);

  // Unique strategies for filter dropdown
  const strategyOptions = useMemo(()=>{
    const s=new Set(trades.map(t=>t.journal?.strategy).filter(Boolean));
    return [...s].sort();
  },[trades]);


  function outcomeColor(oc){return oc==="win"?T.green:oc==="loss"?T.red:T.yellow;}

  return (
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        <input placeholder="Search..." value={filters.search} onChange={e=>setF("search",e.target.value)} style={{width:140}}/>
        <select value={filters.strategy} onChange={e=>setF("strategy",e.target.value)} style={{width:"auto"}}>
          <option value="">All strategies</option>
          {strategyOptions.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.direction} onChange={e=>setF("direction",e.target.value)} style={{width:"auto"}}>
          <option value="">All directions</option>
          <option value="Long">Long</option>
          <option value="Short">Short</option>
        </select>
        <select value={filters.account} onChange={e=>setF("account",e.target.value)} style={{width:"auto"}}>
          <option value="">All accounts</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span style={{fontSize:11,color:T.hint,marginLeft:"auto"}}>{filtered.length} trades</span>
      </div>
      {filtered.length===0
        ? <Card style={{padding:60,textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>📋</div><div style={{fontSize:14,fontWeight:500,marginBottom:6}}>No trades</div><div style={{fontSize:12,color:T.hint}}>Import a CSV to add trades</div></Card>
        : <Card><div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <TH>Date</TH>
                <TH>Time (NY)</TH>
                <TH>Dir</TH>
                <TH>Symbol</TH>
                <TH>Qty</TH>
                <TH>Net P&L</TH>
                <TH>Ticks</TH>
                <TH>R</TH>
                <TH>Strategy</TH>
                <TH>Account</TH>
                <TH>★</TH>
                <TH></TH>
              </tr></thead>
              <tbody>
                {filtered.map((t,i)=>{
                  const f=t.fill||{};
                  const j=t.journal||{};
                  const oc=getOutcome(t,settings);
                  const pnlColor=outcomeColor(oc);
                  const ets=entryTimestamp(f);
                  const timeStr=ets&&ets.includes("T")?ets.split("T")[1].slice(0,5):"—";
                  return (
                    <tr key={f.buyFillId||i} style={{cursor:"pointer"}} onClick={()=>onEdit(t)}>
                      <TD style={{whiteSpace:"nowrap"}}>{ets?ets.slice(0,10):"—"}</TD>
                      <TD style={{whiteSpace:"nowrap",color:T.muted,fontSize:11}}>{timeStr}</TD>
                      <TD><span style={{fontWeight:500,color:f.direction==="Long"?T.green:T.red}}>{f.direction==="Long"?"▲ L":f.direction==="Short"?"▼ S":"—"}</span></TD>
                      <TD style={{fontWeight:500}}>{f.symbol||"—"}</TD>
                      <TD style={{color:T.muted}}>{f.qty??"—"}</TD>
                      <TD style={{color:pnlColor,fontWeight:500}}>{fmtDollars(f.netPnlDollars)}</TD>
                      <TD style={{color:pnlColor}}>{fmtTicksInt(f.netPnlTicks)}</TD>
                      <TD style={{color:j.rCollected!=null?(j.rCollected>0.05?T.green:j.rCollected<-0.05?T.red:T.yellow):T.hint}}>{j.rCollected!=null?fmtR(j.rCollected):"—"}</TD>
                      <TD>{j.strategy?<Tag s={j.strategy}/>:"—"}</TD>
                      <TD style={{color:T.muted,fontSize:11}}>{aMap[j.accountId]||"—"}</TD>
                      <TD><Stars value={j.rating||0}/></TD>
                      <TD onClick={e=>e.stopPropagation()}>
                        <button style={btn("danger")} onClick={()=>onDelete(f.buyFillId)}>✕</button>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></Card>
      }
    </div>
  );
}
