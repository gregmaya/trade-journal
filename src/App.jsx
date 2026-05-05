import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { fsaSupported, hasHandle, openFile, createFile, readData, writeData, readLocalStorage, defaultData } from "./storage.js";
import { parseTradovateCSV } from "./utils/tradovate.js";
import { fmtDollars, fmtTicks, fmtR as fmtRUtil, computeR, computeWinStats, computeDrawdownSeries } from "./utils/compute.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const DIRECTIONS = ["Long","Short"];

function fmtR(n) { return fmtRUtil(n); }
function fmtD(n) {
  if (n == null) return "—";
  return (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();
}

// ── Tokens ───────────────────────────────────────────────────────────────────
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

// ── Shared UI ─────────────────────────────────────────────────────────────────
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
const CardHead = ({title, action}) => (
  <div style={{padding:"10px 14px", borderBottom:`0.5px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
    <span style={{fontSize:11, fontWeight:500, color:T.hint, textTransform:"uppercase", letterSpacing:"0.8px"}}>{title}</span>
    {action}
  </div>
);

function Tag({s}) {
  const colors = {ORB:[T.green,T.greenBg], ILM:[T.indigo,T.indigoBg], Model:[T.yellow,T.yellowBg], NONE:[T.hint,"transparent"]};
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
function Input({label, ...props}) {
  return <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label&&<label style={{fontSize:11,color:T.hint}}>{label}</label>}
    <input style={{width:"100%"}} {...props}/>
  </div>;
}
function Select({label, children, ...props}) {
  return <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label&&<label style={{fontSize:11,color:T.hint}}>{label}</label>}
    <select style={{width:"100%"}} {...props}>{children}</select>
  </div>;
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({title, onClose, children, footer, width=620}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:T.card,border:`0.5px solid ${T.border2}`,borderRadius:"var(--border-radius-lg)",width:"100%",maxWidth:width,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:15,fontWeight:500}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,lineHeight:1,color:T.hint}}>×</button>
        </div>
        <div style={{padding:"18px"}}>{children}</div>
        {footer && <div style={{padding:"12px 18px",borderTop:`0.5px solid ${T.border}`,display:"flex",gap:8,justifyContent:"flex-end"}}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Trade Detail Panel ────────────────────────────────────────────────────────
function TradeDetailPanel({ trade, strategies, tags, onSave, onClose }) {
  const { fill = {}, journal = {} } = trade || {};

  function fmtDuration(sec) {
    if (sec == null) return "—";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function timeOnly(ts) {
    if (!ts) return "—";
    // ISO: "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss"
    const sep = ts.includes("T") ? "T" : " ";
    const parts = ts.split(sep);
    if (parts.length < 2) return "—";
    return parts[1].slice(0, 8);
  }

  const outcomeColor = (oc) =>
    oc === "win" ? T.green : oc === "loss" ? T.red : T.yellow;
  const oc = fill.outcome;
  const pnlColor = oc ? outcomeColor(oc) : T.muted;

  const [tagInput, setTagInput] = useState("");

  function updateJournal(updates) {
    const updated = { ...trade, journal: { ...journal, ...updates } };
    onSave(updated);
  }

  function handleRiskChange(e) {
    const raw = e.target.value;
    const riskTicks = raw === "" ? null : parseFloat(raw);
    const rCollected = computeR(fill.netPnlTicks, riskTicks);
    updateJournal({ riskTicks: riskTicks ?? null, rCollected });
  }

  function addTag(tag) {
    const t = tag.trim();
    if (!t) return;
    const current = journal.tags || [];
    if (current.includes(t)) return;
    updateJournal({ tags: [...current, t] });
    setTagInput("");
  }

  function removeTag(tag) {
    updateJournal({ tags: (journal.tags || []).filter(x => x !== tag) });
  }

  const LBL = ({ children }) => (
    <label style={{ fontSize: 11, color: T.hint, marginBottom: 4, display: "block" }}>{children}</label>
  );
  const Field = ({ label, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <LBL>{label}</LBL>
      {children}
    </div>
  );

  const date = fill.boughtTimestamp ? fill.boughtTimestamp.slice(0, 10) : "—";
  const symbol = fill.symbol || "—";
  const direction = fill.direction || "—";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 199,
        }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed", right: 0, top: 0,
        height: "100vh", width: 440,
        background: T.card,
        borderLeft: `0.5px solid ${T.border2}`,
        zIndex: 200,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.18)",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: `0.5px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {date} — {symbol} — {direction}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, color: T.hint }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px" }}>

          {/* Fill section */}
          <div style={{ fontSize: 11, fontWeight: 500, color: T.hint, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Fill</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {/* Direction */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Direction</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: fill.direction === "Long" ? T.green : T.red }}>
                {fill.direction === "Long" ? "▲ Long" : fill.direction === "Short" ? "▼ Short" : "—"}
              </div>
            </div>
            {/* Symbol */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Symbol</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fill.symbol || "—"}</div>
            </div>
            {/* Qty */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Qty</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fill.qty ?? "—"}</div>
            </div>
            {/* Entry price */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Entry price</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fill.buyPrice ?? "—"}</div>
            </div>
            {/* Avg exit */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Avg exit</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fill.avgSellPrice ?? "—"}</div>
            </div>
            {/* Gross P&L */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Gross P&L</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: fill.grossPnlDollars >= 0 ? T.green : T.red }}>
                {fmtDollars(fill.grossPnlDollars)}
              </div>
            </div>
            {/* Commission */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Commission</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.red }}>{fmtDollars(fill.commissionTotal)}</div>
            </div>
            {/* Net P&L */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Net P&L</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: pnlColor }}>{fmtDollars(fill.netPnlDollars)}</div>
            </div>
            {/* Net Ticks */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Net Ticks</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: pnlColor }}>{fmtTicks(fill.netPnlTicks)}</div>
            </div>
            {/* Duration */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Duration</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtDuration(fill.durationSec)}</div>
            </div>
            {/* Entry time */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Entry time</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{timeOnly(fill.boughtTimestamp)}</div>
            </div>
            {/* Exit time */}
            <div style={{ background: T.surface, borderRadius: 7, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: T.hint, marginBottom: 3 }}>Exit time</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{timeOnly(fill.soldTimestamp)}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `0.5px solid ${T.border}`, marginBottom: 20 }} />

          {/* Journal section */}
          <div style={{ fontSize: 11, fontWeight: 500, color: T.hint, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Journal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Risk ticks + R collected row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Risk (ticks)">
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 8"
                  value={journal.riskTicks ?? ""}
                  onChange={handleRiskChange}
                  style={{ width: "100%" }}
                />
              </Field>
              <Field label="R collected">
                <div style={{ padding: "6px 10px", background: T.surface, borderRadius: 6, fontSize: 13, fontWeight: 500, color: journal.rCollected != null ? (journal.rCollected > 0.05 ? T.green : journal.rCollected < -0.05 ? T.red : T.yellow) : T.hint }}>
                  {fmtR(journal.rCollected)}
                </div>
              </Field>
            </div>

            {/* Strategy */}
            <Field label="Strategy">
              <select
                value={journal.strategy || ""}
                onChange={e => updateJournal({ strategy: e.target.value || null })}
                style={{ width: "100%" }}
              >
                <option value="">— None —</option>
                {strategies.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            {/* Tags */}
            <Field label="Tags">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {(journal.tags || []).map(t => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 4, background: T.indigoBg, color: T.indigo, border: `0.5px solid ${T.indigo}40` }}>
                    {t}
                    <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: T.hint, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  list="tag-suggestions"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { addTag(tagInput); e.preventDefault(); } }}
                  placeholder="Add tag..."
                  style={{ flex: 1 }}
                />
                <datalist id="tag-suggestions">
                  {tags.filter(t => !(journal.tags || []).includes(t)).map(t => <option key={t} value={t} />)}
                </datalist>
                <button style={btn("ghost")} onClick={() => addTag(tagInput)}>Add</button>
              </div>
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                style={{ width: "100%", minHeight: 80, resize: "vertical" }}
                value={journal.notes || ""}
                onChange={e => updateJournal({ notes: e.target.value })}
                placeholder="Trade notes, observations..."
              />
            </Field>

            {/* TradingView URL */}
            <Field label="TradingView URL">
              <input
                value={journal.tradingViewUrl || ""}
                onChange={e => updateJournal({ tradingViewUrl: e.target.value })}
                placeholder="https://www.tradingview.com/x/..."
                style={{ width: "100%" }}
              />
              {journal.tradingViewUrl && (
                <a href={journal.tradingViewUrl} target="_blank" rel="noreferrer" style={{ color: T.green, fontSize: 12, textDecoration: "none", marginTop: 4, display: "inline-block" }}>
                  View chart ↗
                </a>
              )}
            </Field>

            {/* Rating */}
            <Field label="Rating">
              <Stars value={journal.rating || 0} onChange={v => updateJournal({ rating: v })} />
            </Field>

          </div>
        </div>
      </div>
    </>
  );
}

// ── Account Form ──────────────────────────────────────────────────────────────
const ACCT_DEFAULTS = { id:"", name:"", firmId:"", type:"eval", broker:"Tradovate", firm:"Apex", startingBalance:50000, drawdownBuffer:2000, lockLevel:null };

function AccountForm({acct, onSave, onClose}) {
  const [f,setF]=useState({...ACCT_DEFAULTS,...(acct||{})});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  function handleSave() {
    const lockRaw = f.lockLevel;
    const lockNum = lockRaw === "" || lockRaw === null || lockRaw === undefined ? null : +lockRaw;
    onSave({
      ...f,
      id: f.id || uid(),
      startingBalance: +f.startingBalance,
      drawdownBuffer: +f.drawdownBuffer,
      lockLevel: lockNum === 0 ? null : lockNum,
    });
  }
  return (
    <Modal title={f.id?"Edit account":"Add account"} onClose={onClose}
      footer={<><button style={btn("ghost")} onClick={onClose}>Cancel</button><button style={btn()} onClick={handleSave}>Save</button></>}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Name" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. My Apex Eval"/>
        <Input label="Firm ID" value={f.firmId} onChange={e=>s("firmId",e.target.value)} placeholder="e.g. APEX-526978-06"/>
        <Input label="Firm" value={f.firm} onChange={e=>s("firm",e.target.value)} placeholder="e.g. Apex"/>
        <Input label="Broker" value={f.broker} onChange={e=>s("broker",e.target.value)} placeholder="e.g. Tradovate"/>
        <Select label="Type" value={f.type} onChange={e=>s("type",e.target.value)}>
          <option value="eval">Eval</option>
          <option value="pa">PA</option>
          <option value="personal">Personal</option>
        </Select>
        <Input label="Starting balance ($)" type="number" value={f.startingBalance} onChange={e=>s("startingBalance",e.target.value)}/>
        <Input label="Trailing drawdown buffer ($)" type="number" value={f.drawdownBuffer} onChange={e=>s("drawdownBuffer",e.target.value)}/>
        <Input label="DD lock level ($) — leave blank for eval (no lock)" type="number" value={f.lockLevel ?? ""} onChange={e=>s("lockLevel",e.target.value===""?null:e.target.value)} placeholder="e.g. 50100"/>
      </div>
    </Modal>
  );
}

// ── Tradovate Import Modal ────────────────────────────────────────────────────
function TradovateImportModal({ accounts, settings, existingBuyFillIds, onImport, onClose }) {
  const [step, setStep] = useState("upload");
  const [parsed, setParsed] = useState([]);
  const [skipped, setSkipped] = useState(0);
  const [errors, setErrors] = useState([]);
  const [acctId, setAcctId] = useState(accounts[0]?.id || "");
  const [drag, setDrag] = useState(false);
  const [parseErr, setParseErr] = useState("");
  const fileRef = useRef();

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseTradovateCSV(
        e.target.result,
        existingBuyFillIds || [],
        settings.commissions,
        settings.beThresholdTicks
      );
      if (result.errors.length > 0 && result.trades.length === 0) {
        setParseErr(result.errors[0]);
        return;
      }
      setParsed(result.trades);
      setSkipped(result.skipped);
      setErrors(result.errors);
      setParseErr("");
      setStep("preview");
    };
    reader.onerror = () => setParseErr("Failed to read file.");
    reader.readAsText(file);
  }

  function fmtDuration(sec) {
    if (sec == null) return "—";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function outcomeColor(outcome) {
    return outcome === "win" ? T.green : outcome === "loss" ? T.red : T.yellow;
  }

  function handleConfirm() {
    const withAccount = parsed.map(t => ({
      ...t,
      journal: { ...t.journal, accountId: acctId },
    }));
    onImport(withAccount);
  }

  const canConfirm = parsed.length > 0 && (accounts.length === 0 || acctId);

  return (
    <Modal title="Import Tradovate CSV" onClose={onClose} width={780}
      footer={<>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        {step === "preview" && (
          <button style={btn()} disabled={!canConfirm} onClick={handleConfirm}>
            Import {parsed.length} trade{parsed.length !== 1 ? "s" : ""}
          </button>
        )}
      </>}>
      {step === "upload" && <>
        <div style={{marginBottom:14,padding:12,background:T.surface,borderRadius:8,fontSize:12,lineHeight:1.7,color:T.muted}}>
          <strong style={{color:T.text}}>How to export from Tradovate:</strong><br/>
          1. Log in to Tradovate → Performance tab<br/>
          2. Set your date range, then click Export → CSV<br/>
          3. Upload the file below
        </div>
        {parseErr && (
          <div style={{color:T.red,fontSize:12,marginBottom:12,padding:"8px 12px",background:T.redBg,borderRadius:6}}>
            {parseErr}
          </div>
        )}
        <div
          style={{border:`2px dashed ${drag?T.green:T.border2}`,borderRadius:10,padding:"50px 40px",textAlign:"center",cursor:"pointer",background:drag?T.greenBg:"transparent",transition:"all 0.15s"}}
          onDragOver={e=>{e.preventDefault();setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
          onClick={()=>fileRef.current.click()}>
          <div style={{fontSize:32,marginBottom:10}}>📂</div>
          <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Drop CSV file here or click to browse</div>
          <div style={{fontSize:12,color:T.hint}}>Export from Tradovate as .csv</div>
          <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)handleFile(f);}}/>
        </div>
      </>}
      {step === "preview" && <>
        <div style={{display:"flex",gap:12,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,color:T.muted}}>
            Found <strong style={{color:T.text}}>{parsed.length}</strong> trade{parsed.length!==1?"s":""}
          </span>
          {skipped > 0 && (
            <span style={{fontSize:12,color:T.yellow}}>
              <strong>{skipped}</strong> skipped (already imported)
            </span>
          )}
          {accounts.length > 0 && (
            <Select value={acctId} onChange={e=>setAcctId(e.target.value)} style={{marginLeft:"auto"}}>
              <option value="">— Select account —</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
          <button style={btn("ghost")} onClick={()=>setStep("upload")}>← Back</button>
        </div>
        {errors.length > 0 && (
          <div style={{color:T.red,fontSize:11,marginBottom:10,padding:"8px 12px",background:T.redBg,borderRadius:6,lineHeight:1.7}}>
            {errors.map((e,i)=><div key={i}>{e}</div>)}
          </div>
        )}
        <div style={{maxHeight:340,overflow:"auto",border:`0.5px solid ${T.border}`,borderRadius:8}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr>
                {["Date","Symbol","Dir","Qty","Gross P&L","Net P&L","Ticks","Duration"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"7px 10px",borderBottom:`0.5px solid ${T.border}`,color:T.hint,fontWeight:500,fontSize:10,textTransform:"uppercase",letterSpacing:"0.6px",whiteSpace:"nowrap",position:"sticky",top:0,background:T.card}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0,100).map((t,i)=>{
                const f = t.fill;
                const oc = outcomeColor(f.outcome);
                return (
                  <tr key={i} style={{borderBottom:`0.5px solid ${T.border}`}}>
                    <td style={{padding:"6px 10px",whiteSpace:"nowrap"}}>{f.boughtTimestamp?.slice(0,10)||"—"}</td>
                    <td style={{padding:"6px 10px",fontWeight:500}}>{f.symbol}</td>
                    <td style={{padding:"6px 10px",color:f.direction==="Long"?T.green:T.red,fontWeight:500}}>{f.direction==="Long"?"▲ Long":"▼ Short"}</td>
                    <td style={{padding:"6px 10px",color:T.muted}}>{f.qty}</td>
                    <td style={{padding:"6px 10px",color:f.grossPnlDollars>=0?T.green:T.red}}>{fmtDollars(f.grossPnlDollars)}</td>
                    <td style={{padding:"6px 10px",color:oc,fontWeight:500}}>{fmtDollars(f.netPnlDollars)}</td>
                    <td style={{padding:"6px 10px",color:oc}}>{fmtTicks(f.netPnlTicks)}</td>
                    <td style={{padding:"6px 10px",color:T.muted}}>{fmtDuration(f.durationSec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {parsed.length > 100 && (
          <div style={{fontSize:11,color:T.hint,marginTop:6}}>Showing first 100 of {parsed.length}</div>
        )}
      </>}
    </Modal>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({trades, accounts}) {
  const wins=trades.filter(t=>t.fill?.outcome==="win");
  const losses=trades.filter(t=>t.fill?.outcome==="loss");
  const bes=trades.filter(t=>t.fill?.outcome==="be");
  const netDollars=trades.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0);
  const netTicks=trades.reduce((s,t)=>s+(t.fill?.netPnlTicks||0),0);
  const stats=computeWinStats(trades);
  const grossWins=wins.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0);
  const grossLoss=Math.abs(losses.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0));
  const pf=grossLoss>0?grossWins/grossLoss:null;
  const todayStr=new Date().toISOString().slice(0,10);
  const todayCount=trades.filter(t=>(t.fill?.boughtTimestamp||"").startsWith(todayStr)).length;

  // equity curve — sort by boughtTimestamp, cumulative netPnlDollars
  const sorted=[...trades].sort((a,b)=>{
    const da=a.fill?.boughtTimestamp||"";
    const db=b.fill?.boughtTimestamp||"";
    return da>db?1:-1;
  });
  let cum=0;
  const eqData=sorted.map((t,i)=>{cum+=(t.fill?.netPnlDollars||0);return{n:i+1,pnl:parseFloat(cum.toFixed(2))};});

  // strat breakdown — net dollars per strategy
  const stratData=["ORB","ILM","Model","NONE"].map(s=>{
    const g=trades.filter(t=>t.journal?.strategy===s);
    const netD=parseFloat(g.reduce((sum,t)=>sum+(t.fill?.netPnlDollars||0),0).toFixed(2));
    return {s, count:g.length, netD};
  }).filter(x=>x.count>0);

  // calendar — current month, group by fill.boughtTimestamp date
  const now=new Date(); const yr=now.getFullYear(), mo=now.getMonth();
  const byDate={};
  trades.forEach(t=>{
    const ts=t.fill?.boughtTimestamp||"";
    if(!ts) return;
    try{
      const d=new Date(ts);
      if(d.getFullYear()===yr&&d.getMonth()===mo){
        const k=d.getDate();
        if(!byDate[k]) byDate[k]=[];
        byDate[k].push(t);
      }
    }catch{}
  });
  const fd=new Date(yr,mo,1).getDay();
  const calDim=new Date(yr,mo+1,0).getDate();

  const Metric=({label, value, color=T.text, sub})=>(
    <div style={{background:T.surface,borderRadius:"var(--border-radius-md)",padding:"12px 14px"}}>
      <div style={{fontSize:11,color:T.hint,marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:500,color}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.hint,marginTop:2}}>{sub}</div>}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
        <Metric label="Net P&L ($)" value={fmtDollars(netDollars)} color={netDollars>=0?T.green:T.red} sub={`${trades.length} trades`}/>
        <Metric label="Net P&L (ticks)" value={fmtTicks(netTicks)} color={netTicks>=0?T.green:T.red}/>
        <Metric label="Win %" value={stats.winPct!=null?stats.winPct.toFixed(0)+"%":"—"} color={stats.winPct==null?T.hint:stats.winPct>=50?T.green:stats.winPct>=40?T.yellow:T.red} sub={`${stats.wins}W / ${stats.losses}L`}/>
        <Metric label="BE %" value={stats.bePct!=null?stats.bePct.toFixed(0)+"%":"—"} color={T.yellow} sub={`${stats.bes} BE`}/>
        <Metric label="Profit factor" value={pf!=null?pf.toFixed(2):"—"} color={pf==null?T.hint:pf>=1.5?T.green:pf>=1?T.yellow:T.red}/>
        <Metric label="Trades today" value={todayCount} color={T.text}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <CardHead title="Cumulative P&L ($)"/>
          <div style={{padding:"14px 14px 10px"}}>
            {eqData.length>1
              ? <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={eqData} margin={{top:4,right:4,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                    <XAxis dataKey="n" hide/>
                    <YAxis tickLine={false} axisLine={false} tick={{fontSize:10,fill:T.hint}} tickFormatter={v=>fmtDollars(v)} width={48}/>
                    <Tooltip formatter={v=>[fmtDollars(v),"Cumulative P&L"]} contentStyle={{background:T.card,border:`0.5px solid ${T.border2}`,borderRadius:6,fontSize:11}}/>
                    <ReferenceLine y={0} stroke={T.border2} strokeDasharray="3 3"/>
                    <Line type="monotone" dataKey="pnl" stroke={T.green} strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              : <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:T.hint,fontSize:12}}>No trades yet</div>
            }
          </div>
        </Card>

        <Card>
          <CardHead title="Strategy performance"/>
          <div style={{padding:"14px"}}>
            {stratData.length>0
              ? <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stratData} layout="vertical" margin={{top:0,right:50,left:0,bottom:0}}>
                    <XAxis type="number" hide/>
                    <YAxis dataKey="s" type="category" tickLine={false} axisLine={false} tick={{fontSize:11,fill:T.muted}} width={36}/>
                    <Tooltip formatter={v=>[fmtDollars(v),"Net P&L"]} contentStyle={{background:T.card,border:`0.5px solid ${T.border2}`,borderRadius:6,fontSize:11}}/>
                    <ReferenceLine x={0} stroke={T.border2}/>
                    <Bar dataKey="netD" radius={3} fill={T.green}
                      label={{position:"right",fontSize:10,fill:T.muted,formatter:v=>fmtDollars(v)}}
                      shape={p=><rect {...p} fill={p.value>=0?T.green:T.red} fillOpacity={0.8}/>}/>
                  </BarChart>
                </ResponsiveContainer>
              : <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:T.hint,fontSize:12}}>No trades yet</div>
            }
          </div>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <CardHead title={`Performance calendar — ${now.toLocaleString("default",{month:"long"})} ${yr}`}/>
          <div style={{padding:"12px 14px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:10,color:T.hint,padding:"2px 0"}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
              {Array.from({length:fd},(_,i)=><div key={"e"+i}/>)}
              {Array.from({length:calDim},(_,i)=>{
                const day=i+1, ts=byDate[day];
                const dayPnl=ts?ts.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0):null;
                const dayCount=ts?ts.length:0;
                const [bg,color]=dayPnl==null?[T.surface,T.hint]:dayPnl>0?[T.greenBg,T.green]:dayPnl<0?[T.redBg,T.red]:[T.yellowBg,T.yellow];
                return (
                  <div key={day} style={{aspectRatio:"1",borderRadius:4,background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:9,color}}>
                    <span>{day}</span>
                    {dayPnl!=null&&<span style={{fontSize:8,opacity:0.9}}>{fmtDollars(dayPnl)}</span>}
                    {dayCount>0&&<span style={{fontSize:7,opacity:0.7}}>{dayCount} {dayCount===1?"trade":"trades"}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Accounts"/>
          <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
            {accounts.map(a=>{
              const pnl=a.currentBalance-a.startingBalance;
              const buf=a.currentBalance-a.currentDrawdown;
              const bufStart=a.startingBalance-a.startingDrawdown;
              const pct=bufStart>0?Math.max(0,Math.min(100,buf/bufStart*100)):0;
              return (
                <div key={a.id} style={{padding:"10px 12px",background:T.surface,borderRadius:8,border:`0.5px solid ${T.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500}}>{a.name}</div>
                      <div style={{fontSize:10,color:T.hint}}>{a.type} · {a.broker}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:500,color:pnl>=0?T.green:T.red}}>{fmtD(pnl)}</div>
                      <div style={{fontSize:9,color:T.hint}}>P&L</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                    {[["Balance",fmtD(a.currentBalance),T.text],["DD Floor",fmtD(a.currentDrawdown),T.red],["Buffer",fmtD(buf),buf<1000?T.red:T.yellow]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:T.hint,marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:500,color:c}}>{v}</div></div>
                    ))}
                  </div>
                  <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:pct>50?T.green:pct>25?T.yellow:T.red,borderRadius:2,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{fontSize:9,color:T.hint,marginTop:3,textAlign:"right"}}>{pct.toFixed(0)}% buffer remaining</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Trade Log ─────────────────────────────────────────────────────────────────
function TradeLog({trades, accounts, onEdit, onDelete}) {
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

  const TH=({children,style={}})=><th style={{textAlign:"left",padding:"7px 10px",borderBottom:`0.5px solid ${T.border}`,color:T.hint,fontWeight:500,fontSize:10,textTransform:"uppercase",letterSpacing:"0.6px",whiteSpace:"nowrap",...style}}>{children}</th>;
  const TD=({children,style={}})=><td style={{padding:"7px 10px",borderBottom:`0.5px solid ${T.border}`,fontSize:12,...style}}>{children}</td>;

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
                  const oc=f.outcome;
                  const pnlColor=oc?outcomeColor(oc):T.muted;
                  return (
                    <tr key={f.buyFillId||i} style={{cursor:"pointer"}} onClick={()=>onEdit(t)}>
                      <TD style={{whiteSpace:"nowrap"}}>{f.boughtTimestamp?f.boughtTimestamp.slice(0,10):"—"}</TD>
                      <TD><span style={{fontWeight:500,color:f.direction==="Long"?T.green:T.red}}>{f.direction==="Long"?"▲ L":f.direction==="Short"?"▼ S":"—"}</span></TD>
                      <TD style={{fontWeight:500}}>{f.symbol||"—"}</TD>
                      <TD style={{color:T.muted}}>{f.qty??"—"}</TD>
                      <TD style={{color:pnlColor,fontWeight:500}}>{fmtDollars(f.netPnlDollars)}</TD>
                      <TD style={{color:pnlColor}}>{fmtTicks(f.netPnlTicks)}</TD>
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

// ── Analytics ─────────────────────────────────────────────────────────────────
function Analytics({trades}) {
  const [dim,setDim]=useState("strategy");
  const total=trades.length;

  // Summary metrics using netPnlDollars
  const wTrades=trades.filter(t=>t.fill?.outcome==="win");
  const lTrades=trades.filter(t=>t.fill?.outcome==="loss");
  const beTrades=trades.filter(t=>t.fill?.outcome==="be");
  const wins=wTrades.length;
  const losses=lTrades.length;
  const bes=beTrades.length;
  const netDollars=trades.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0);
  const netTicks=trades.reduce((s,t)=>s+(t.fill?.netPnlTicks||0),0);
  const avgWin=wins?wTrades.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0)/wins:null;
  const avgLoss=losses?lTrades.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0)/losses:null;
  const allPnls=trades.map(t=>t.fill?.netPnlDollars||0);
  const bestTrade=total?Math.max(...allPnls):null;
  const worstTrade=total?Math.min(...allPnls):null;
  let maxWS=0,maxLS=0,curS=0;
  [...trades].sort((a,b)=>{
    const da=a.fill?.boughtTimestamp||"";
    const db=b.fill?.boughtTimestamp||"";
    return da>db?1:-1;
  }).forEach(t=>{
    const oc=t.fill?.outcome;
    if(oc==="win"){curS=curS>0?curS+1:1;maxWS=Math.max(maxWS,curS);}
    else if(oc==="loss"){curS=curS<0?curS-1:-1;maxLS=Math.max(maxLS,-curS);}
    else curS=0;
  });

  // Grouping helpers
  function grpByField(accessor, labels) {
    return labels.map(l=>{
      const g=trades.filter(t=>accessor(t)===l);
      const w=g.filter(t=>t.fill?.outcome==="win").length;
      const lo=g.filter(t=>t.fill?.outcome==="loss").length;
      const be=g.filter(t=>t.fill?.outcome==="be").length;
      const nd=g.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0);
      const nt=g.reduce((s,t)=>s+(t.fill?.netPnlTicks||0),0);
      return {name:l,count:g.length,wins:w,losses:lo,bes:be,winPct:g.length?w/g.length*100:0,netDollars:nd,netTicks:nt};
    }).filter(x=>x.count>0);
  }

  const DOW=["Mon","Tue","Wed","Thu","Fri"];
  const dowData=DOW.map(day=>{
    const g=trades.filter(t=>{
      try{const d=new Date(t.fill?.boughtTimestamp||"");const m={1:"Mon",2:"Tue",3:"Wed",4:"Thu",5:"Fri"};return m[d.getDay()]===day;}
      catch{return false;}
    });
    const w=g.filter(t=>t.fill?.outcome==="win").length;
    const lo=g.filter(t=>t.fill?.outcome==="loss").length;
    const be=g.filter(t=>t.fill?.outcome==="be").length;
    const nd=g.reduce((s,t)=>s+(t.fill?.netPnlDollars||0),0);
    const nt=g.reduce((s,t)=>s+(t.fill?.netPnlTicks||0),0);
    return {name:day,count:g.length,wins:w,losses:lo,bes:be,winPct:g.length?w/g.length*100:0,netDollars:nd,netTicks:nt};
  }).filter(x=>x.count>0);

  // Unique symbols from data
  const symbols=[...new Set(trades.map(t=>t.fill?.symbol).filter(Boolean))].sort();

  const chartData={
    strategy:grpByField(t=>t.journal?.strategy,["ORB","ILM","Model","NONE"]),
    direction:grpByField(t=>t.fill?.direction,["Long","Short"]),
    symbol:grpByField(t=>t.fill?.symbol,symbols),
    dow:dowData,
  };
  const data=chartData[dim]||[];

  const Metric=({label,value,color=T.text})=>(
    <div style={{background:T.surface,borderRadius:"var(--border-radius-md)",padding:"10px 12px"}}>
      <div style={{fontSize:10,color:T.hint,marginBottom:3}}>{label}</div>
      <div style={{fontSize:18,fontWeight:500,color}}>{value}</div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:11,color:T.hint}}>{total} trades</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <Metric label="Net P&L ($)" value={fmtDollars(netDollars)} color={netDollars>=0?T.green:T.red}/>
        <Metric label="Net P&L (ticks)" value={fmtTicks(netTicks)} color={netTicks>=0?T.green:T.red}/>
        <Metric label="Win %" value={total?(wins/total*100).toFixed(0)+"%":"—"} color={total&&wins/total>=0.5?T.green:T.red}/>
        <Metric label="BE %" value={total?(bes/total*100).toFixed(0)+"%":"—"} color={T.yellow}/>
        <Metric label="Avg win ($)" value={avgWin!=null?fmtDollars(avgWin):"—"} color={T.green}/>
        <Metric label="Avg loss ($)" value={avgLoss!=null?fmtDollars(avgLoss):"—"} color={T.red}/>
        <Metric label="Best trade" value={bestTrade!=null?fmtDollars(bestTrade):"—"} color={T.green}/>
        <Metric label="Worst trade" value={worstTrade!=null?fmtDollars(worstTrade):"—"} color={T.red}/>
        <Metric label="Max win streak" value={maxWS} color={T.green}/>
        <Metric label="Max loss streak" value={maxLS} color={T.red}/>
      </div>

      <Card>
        <CardHead title="Breakdown" action={
          <div style={{display:"flex",gap:6}}>
            {[["strategy","Strategy"],["direction","Direction"],["symbol","Symbol"],["dow","Day"]].map(([v,l])=>(
              <button key={v} style={{...btn(dim===v?"primary":"ghost"),padding:"4px 10px",fontSize:11}} onClick={()=>setDim(v)}>{l}</button>
            ))}
          </div>
        }/>
        <div style={{padding:"14px"}}>
          {data.length>0
            ? <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fontSize:11,fill:T.muted}}/>
                  <YAxis yAxisId="pnl" tickLine={false} axisLine={false} tick={{fontSize:10,fill:T.hint}} tickFormatter={v=>fmtDollars(v)} width={48}/>
                  <YAxis yAxisId="wr" orientation="right" tickLine={false} axisLine={false} tick={{fontSize:10,fill:T.yellow}} tickFormatter={v=>v+"%"} domain={[0,100]} width={32}/>
                  <Tooltip contentStyle={{background:T.card,border:`0.5px solid ${T.border2}`,borderRadius:6,fontSize:11}} formatter={(v,n)=>[n==="wr"?v.toFixed(0)+"%":fmtDollars(v),n==="wr"?"Win rate":"Net P&L ($)"]}/>
                  <ReferenceLine yAxisId="pnl" y={0} stroke={T.border2}/>
                  <Bar yAxisId="pnl" dataKey="netDollars" radius={[3,3,0,0]} name="netDollars" fill={T.green} shape={p=><rect {...p} fill={p.value>=0?T.green:T.red} fillOpacity={0.75}/>}/>
                  <Bar yAxisId="wr" dataKey="winPct" radius={[3,3,0,0]} name="wr" fill={T.yellow} fillOpacity={0.3}/>
                </BarChart>
              </ResponsiveContainer>
            : <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:T.hint,fontSize:12}}>No data</div>
          }
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {[["By strategy",chartData.strategy],["By direction",chartData.direction],["By symbol",chartData.symbol]].map(([title,rows])=>(
          <Card key={title}>
            <CardHead title={title}/>
            <div style={{padding:"12px 14px"}}>
              {rows.length===0?<div style={{fontSize:12,color:T.hint,textAlign:"center",padding:"20px 0"}}>No data</div>:
              <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
                <thead><tr>
                  {["Label","#","W","L","BE","Win%","Net P&L ($)"].map(h=><th key={h} style={{textAlign:h==="Label"?"left":"right",color:T.hint,fontWeight:500,fontSize:10,padding:"3px 0",paddingBottom:6,borderBottom:`0.5px solid ${T.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map(x=>(
                    <tr key={x.name}>
                      <td style={{padding:"5px 0",color:T.muted}}>{x.name}</td>
                      <td style={{textAlign:"right",color:T.muted}}>{x.count}</td>
                      <td style={{textAlign:"right",color:T.green}}>{x.wins}</td>
                      <td style={{textAlign:"right",color:T.red}}>{x.losses}</td>
                      <td style={{textAlign:"right",color:T.yellow}}>{x.bes}</td>
                      <td style={{textAlign:"right",color:x.winPct>=50?T.green:x.winPct>=40?T.yellow:T.red,fontWeight:500}}>{x.winPct.toFixed(0)}%</td>
                      <td style={{textAlign:"right",fontWeight:500,color:x.netDollars>=0?T.green:T.red}}>{fmtDollars(x.netDollars)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Accounts Page ─────────────────────────────────────────────────────────────
const TYPE_LABELS = { eval:"Eval", pa:"PA", personal:"Personal" };

function AccountCard({a, trades, onEdit, onDelete}) {
  const accountTrades = trades.filter(t => t.journal?.accountId === a.id);
  const netPnl = accountTrades.reduce((s,t) => s + (t.fill?.netPnlDollars||0), 0);
  const currentBalance = a.startingBalance + netPnl;
  const pnl = currentBalance - a.startingBalance;

  const showChart = a.type === "eval" || a.type === "pa";
  const series = showChart ? computeDrawdownSeries(a, accountTrades) : [];
  const lastEntry = series.length > 0 ? series[series.length - 1] : null;

  // Buffer metric
  let bufferPct = null;
  let bufferColor = T.hint;
  if (lastEntry && a.drawdownBuffer > 0) {
    bufferPct = (lastEntry.buffer / a.drawdownBuffer) * 100;
    bufferColor = bufferPct > 50 ? T.green : bufferPct >= 25 ? T.yellow : T.red;
  }

  // Stats
  const wins = accountTrades.filter(t => t.fill?.outcome === "win").length;
  const losses = accountTrades.filter(t => t.fill?.outcome === "loss").length;
  const decisive = wins + losses;
  const winPct = decisive > 0 ? (wins / decisive * 100) : null;

  // XAxis label formatter
  function fmtDate(d) {
    if (!d) return "";
    const parts = d.split("-");
    if (parts.length < 3) return d;
    return `${+parts[1]}/${+parts[2]}`;
  }

  // Tooltip formatter
  function ChartTooltip({active, payload, label}) {
    if (!active || !payload || !payload.length) return null;
    const eod = payload.find(p => p.dataKey === "eodBalance");
    const fl = payload.find(p => p.dataKey === "floor");
    const buf = eod && fl ? eod.value - fl.value : null;
    return (
      <div style={{background:T.card,border:`0.5px solid ${T.border2}`,borderRadius:6,padding:"8px 10px",fontSize:11}}>
        <div style={{color:T.hint,marginBottom:4}}>{fmtDate(label)}</div>
        {eod&&<div style={{color:T.green}}>Balance: {fmtDollars(eod.value)}</div>}
        {fl&&<div style={{color:T.red}}>Floor: {fmtDollars(fl.value)}</div>}
        {buf!=null&&<div style={{color:T.muted}}>Buffer: {fmtDollars(buf)}</div>}
      </div>
    );
  }

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
            {series.length > 0 ? (
              <div style={{height:140,marginBottom:6}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{top:4,right:4,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id={`balGrad-${a.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.green} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={T.green} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:9,fill:T.hint}} tickFormatter={fmtDate} interval="preserveStartEnd"/>
                    <YAxis domain={["auto","auto"]} hide/>
                    <Tooltip content={<ChartTooltip/>}/>
                    {a.lockLevel != null && (
                      <ReferenceLine y={a.lockLevel} stroke={T.indigo} strokeDasharray="3 3" strokeWidth={1}/>
                    )}
                    <Line type="monotone" dataKey="eodBalance" stroke={T.green} strokeWidth={2} dot={false} name="Balance"/>
                    <Line type="monotone" dataKey="floor" stroke={T.red} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Floor"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{height:140,display:"flex",alignItems:"center",justifyContent:"center",color:T.hint,fontSize:12,marginBottom:6,background:T.surface,borderRadius:8}}>
                No trades yet
              </div>
            )}

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

function AccountsPage({accounts, trades, onAdd, onEdit, onDelete}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontSize:18,fontWeight:600}}>Accounts</span>
        <button style={btn()} onClick={onAdd}>+ Add account</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:16}}>
        {accounts.map(a=>(
          <AccountCard key={a.id} a={a} trades={trades} onEdit={onEdit} onDelete={onDelete}/>
        ))}
        {accounts.length===0&&(
          <Card style={{padding:60,textAlign:"center",gridColumn:"1/-1"}}>
            <div style={{fontSize:32,marginBottom:10}}>🏦</div>
            <div style={{fontSize:14,fontWeight:500}}>No accounts yet</div>
            <div style={{fontSize:12,color:T.hint,marginTop:4}}>Click "+ Add account" to get started</div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage({data, onDataChange}) {
  const [newTag,setNewTag]=useState("");
  const [newStrat,setNewStrat]=useState("");
  const [toast,setToast]=useState("");
  const toast_=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  const settings = data.settings || {};
  const strategies = settings.strategies || [];
  const tags = settings.tags || [];
  const beThreshold = settings.beThresholdTicks ?? 3;
  const commissions = settings.commissions || { micro: 1.03, mini: 3.50 };

  function patchSettings(patch) {
    onDataChange({...data, settings:{...settings, ...patch}});
  }

  function exportJSON(){
    const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`trade_journal_${new Date().toISOString().slice(0,10)}.json`;a.click();toast_("Exported ✓");
  }
  function exportCSV(){
    const h=["boughtTimestamp","soldTimestamp","symbol","direction","qty","grossPnlDollars","netPnlDollars","netPnlTicks","strategy","riskTicks","rCollected","accountId","tags","notes","tradingViewUrl","rating"];
    const rows=data.trades.map(t=>h.map(k=>{
      const v=t[k];
      if(Array.isArray(v)) return JSON.stringify(v.join("|"));
      return JSON.stringify(v??'');
    }).join(","));
    const b=new Blob([[h.join(","),...rows].join("\n")],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="trades_export.csv";a.click();toast_("CSV exported ✓");
  }
  function importJSON(e){
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>{try{const p=JSON.parse(ev.target.result);if(!p.trades)throw 0;onDataChange(p);toast_("Restored "+p.trades.length+" trades ✓");}catch{toast_("Invalid file");}};r.readAsText(f);
  }

  const inputStyle = {
    padding:"5px 8px", borderRadius:5, fontSize:12, border:`0.5px solid ${T.border2}`,
    background:T.surface, color:T.text, fontFamily:"var(--font-sans)", width:"100%", boxSizing:"border-box",
  };
  const labelStyle = {fontSize:11, color:T.muted, marginBottom:4, display:"block"};
  const numberInputStyle = {...inputStyle, width:100};

  return (
    <div style={{maxWidth:560,display:"flex",flexDirection:"column",gap:14}}>
      {toast&&<div style={{position:"fixed",bottom:24,right:24,background:T.card,border:`0.5px solid ${T.green}`,color:T.green,padding:"10px 18px",borderRadius:8,fontSize:12,zIndex:999}}>{toast}</div>}

      {/* Section 1: Data management */}
      <Card>
        <CardHead title="Data management"/>
        <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button style={btn()} onClick={exportJSON}>Export backup (JSON)</button>
            <button style={btn("ghost")} onClick={exportCSV}>Export trades (CSV)</button>
            <label style={{...btn("ghost"),cursor:"pointer"}}>Restore backup<input type="file" accept=".json" style={{display:"none"}} onChange={importJSON}/></label>
          </div>
          <div style={{fontSize:11,color:T.hint,lineHeight:1.7}}>All data is stored as a local .json file on your machine. Export JSON backups regularly. The CSV export contains all trade fields for use in spreadsheets.</div>
        </div>
      </Card>

      {/* Section 2: Trade classification */}
      <Card>
        <CardHead title="Trade classification"/>
        <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <label style={labelStyle}>Break-even threshold (ticks) — trades within ±N ticks of entry are classified as BE</label>
            <input
              type="number" min={0} step={1}
              value={beThreshold}
              onChange={e=>patchSettings({beThresholdTicks:Math.max(0,parseInt(e.target.value)||0)})}
              style={numberInputStyle}
            />
          </div>
        </div>
      </Card>

      {/* Section 3: Commissions */}
      <Card>
        <CardHead title="Commissions"/>
        <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <label style={labelStyle}>Micro contract commission ($/contract) — MNQ, MES, MYM, M2K</label>
            <input
              type="number" step={0.01} min={0}
              value={commissions.micro}
              onChange={e=>patchSettings({commissions:{...commissions,micro:parseFloat(e.target.value)||0}})}
              style={numberInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Mini contract commission ($/contract) — NQ, ES, YM</label>
            <input
              type="number" step={0.01} min={0}
              value={commissions.mini}
              onChange={e=>patchSettings({commissions:{...commissions,mini:parseFloat(e.target.value)||0}})}
              style={numberInputStyle}
            />
          </div>
          <div style={{fontSize:11,color:T.hint,lineHeight:1.7}}>Commissions are deducted from Tradovate gross P&amp;L to calculate net figures.</div>
        </div>
      </Card>

      {/* Section 4: Strategies */}
      <Card>
        <CardHead title="Strategies"/>
        <div style={{padding:"14px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {strategies.map(s=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:6,background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:6,padding:"4px 10px"}}>
                <span style={{fontSize:12,color:T.text}}>{s}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.hint,fontSize:16,lineHeight:1,padding:0}} onClick={()=>patchSettings({strategies:strategies.filter(x=>x!==s)})}>×</button>
              </div>
            ))}
            {strategies.length===0&&<span style={{fontSize:12,color:T.hint}}>No strategies yet</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input
              value={newStrat}
              onChange={e=>setNewStrat(e.target.value)}
              placeholder="New strategy..."
              style={{...inputStyle,flex:1}}
              onKeyDown={e=>{if(e.key==="Enter"&&newStrat.trim()){patchSettings({strategies:[...strategies,newStrat.trim()]});setNewStrat("");}}}
            />
            <button style={btn()} onClick={()=>{if(newStrat.trim()){patchSettings({strategies:[...strategies,newStrat.trim()]});setNewStrat("");}}}>Add</button>
          </div>
        </div>
      </Card>

      {/* Section 5: Tags */}
      <Card>
        <CardHead title="Tags"/>
        <div style={{padding:"14px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {tags.map(t=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:4,background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:6,padding:"4px 10px",fontSize:12}}>
                <span style={{color:T.text}}>{t}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.hint,fontSize:16,lineHeight:1,padding:0}} onClick={()=>patchSettings({tags:tags.filter(x=>x!==t)})}>×</button>
              </div>
            ))}
            {tags.length===0&&<span style={{fontSize:12,color:T.hint}}>No tags yet</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input
              value={newTag}
              onChange={e=>setNewTag(e.target.value)}
              placeholder="New tag..."
              style={{...inputStyle,flex:1}}
              onKeyDown={e=>{if(e.key==="Enter"&&newTag.trim()){patchSettings({tags:[...tags,newTag.trim()]});setNewTag("");}}}
            />
            <button style={btn()} onClick={()=>{if(newTag.trim()){patchSettings({tags:[...tags,newTag.trim()]});setNewTag("");}}}>Add</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Boot Screen ───────────────────────────────────────────────────────────────
function BootScreen({ onOpen, onCreate }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        background: T.card,
        border: `0.5px solid ${T.border2}`,
        borderRadius: 16,
        padding: "40px 48px",
        maxWidth: 420,
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📈</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: T.text, marginBottom: 8 }}>
          Trade Journal
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 32, lineHeight: 1.6 }}>
          Select your journal file to continue, or create a new one.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onOpen}
            style={{
              padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: "pointer", border: "none", background: T.text, color: T.card,
            }}
          >
            Open existing file
          </button>
          <button
            onClick={onCreate}
            style={{
              padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: "pointer", border: `0.5px solid ${T.border2}`, background: "transparent", color: T.muted,
            }}
          >
            Create new journal
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.hint, marginTop: 24, lineHeight: 1.6 }}>
          Your data is stored as a local .json file on your machine.
          No account or cloud required.
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData_] = useState(defaultData);
  const [storageReady, setStorageReady] = useState(false);
  const [storageFallback, setStorageFallback] = useState(false);
  const [writeError, setWriteError] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [detailTrade, setDetailTrade] = useState(null);
  const openingRef = useRef(false);

  useEffect(() => {
    async function init() {
      if (!fsaSupported()) {
        setData_(readLocalStorage());
        setStorageFallback(true);
        setStorageReady(true);
        return;
      }
      // storageReady stays false — BootScreen will render until user opens/creates a file
    }
    init();
  }, []);

  const setData = useCallback(async (d) => {
    setData_(d);
    try {
      await writeData(d);
    } catch (err) {
      setWriteError("Failed to save to file. Check that the file isn't locked or read-only.");
      setTimeout(() => setWriteError(null), 5000);
    }
  }, []);

  async function handleOpenFile() {
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const ok = await openFile();
      if (!ok) return;
      const d = await readData();
      setData_(d || defaultData());
      setStorageReady(true);
    } finally {
      openingRef.current = false;
    }
  }
  async function handleCreateFile() {
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const ok = await createFile();
      if (!ok) return;
      setData_(defaultData());
      setStorageReady(true);
    } finally {
      openingRef.current = false;
    }
  }

  if (!storageReady && fsaSupported()) {
    return <BootScreen onOpen={handleOpenFile} onCreate={handleCreateFile} />;
  }

  function saveTrade(t) {
    const id=t.fill?.buyFillId;
    const exists=id&&data.trades.find(x=>x.fill?.buyFillId===id);
    setData({...data,trades:exists?data.trades.map(x=>x.fill?.buyFillId===id?t:x):[...data.trades,t]});
    setModal(null);
  }
  function deleteTrade(buyFillId) {
    if(!confirm("Delete this trade?"))return;
    setData({...data,trades:data.trades.filter(t=>t.fill?.buyFillId!==buyFillId)});
  }
  function saveAccount(a) {
    const exists=data.accounts.find(x=>x.id===a.id);
    setData({...data,accounts:exists?data.accounts.map(x=>x.id===a.id?a:x):[...data.accounts,a]});
    setModal(null);
  }
  function deleteAccount(id) {
    if(!confirm("Delete this account?"))return;
    setData({...data,accounts:data.accounts.filter(a=>a.id!==id)});
  }
  function importTrades(ts) {
    setData({...data,trades:[...data.trades,...ts]});
    setModal(null);
  }

  const PAGES=[["dashboard","Dashboard"],["trades","Trades"],["analytics","Analytics"],["accounts","Accounts"],["settings","Settings"]];

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"var(--font-sans)"}}>
      <h2 className="sr-only">EDGE Trade Journal — trading analytics dashboard</h2>

      {/* Fallback warning banner */}
      {storageFallback&&(
        <div style={{background:"rgba(245,158,11,0.12)",borderBottom:"0.5px solid rgba(245,158,11,0.3)",padding:"8px 20px",fontSize:12,color:"#f59e0b",textAlign:"center"}}>
          Your browser doesn't support the File System API. Data is being saved to localStorage — export backups regularly.
        </div>
      )}
      {/* Write error banner */}
      {writeError&&(
        <div style={{background:T.redBg,borderBottom:`0.5px solid ${T.red}40`,padding:"8px 20px",fontSize:12,color:T.red,textAlign:"center"}}>
          {writeError}
        </div>
      )}

      {/* Top bar */}
      <div style={{background:T.card,borderBottom:`0.5px solid ${T.border}`,padding:"0 20px",height:50,display:"flex",alignItems:"center",gap:20,position:"sticky",top:0,zIndex:50}}>
        <span style={{fontSize:15,fontWeight:500,letterSpacing:"-0.3px",minWidth:60}}>EDGE</span>
        <div style={{display:"flex",gap:2,flex:1}}>
          {PAGES.map(([p,l])=>(
            <button key={p} onClick={()=>setPage(p)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px 12px",fontSize:13,borderRadius:6,color:page===p?T.text:T.hint,fontFamily:"var(--font-sans)",fontWeight:page===p?500:400,background:page===p?T.surface:"transparent"}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={btn("ghost")} onClick={()=>{setEditItem(null);setModal("import");}}>↑ Import CSV</button>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"20px",maxWidth:1100,margin:"0 auto"}}>
        {page==="dashboard"&&<Dashboard trades={data.trades} accounts={data.accounts}/>}
        {page==="trades"&&<TradeLog trades={data.trades} accounts={data.accounts} onEdit={setDetailTrade} onDelete={deleteTrade}/>}
        {page==="analytics"&&<Analytics trades={data.trades}/>}
        {page==="accounts"&&<AccountsPage accounts={data.accounts} trades={data.trades} onAdd={()=>{setEditItem(null);setModal("account");}} onEdit={a=>{setEditItem(a);setModal("account");}} onDelete={deleteAccount}/>}
        {page==="settings"&&<SettingsPage data={data} onDataChange={setData}/>}
      </div>

      {modal==="account"&&<AccountForm acct={editItem} onSave={saveAccount} onClose={()=>setModal(null)}/>}
      {modal==="import"&&<TradovateImportModal accounts={data.accounts} settings={data.settings} existingBuyFillIds={data.trades.map(t=>t.fill?.buyFillId).filter(Boolean)} onImport={importTrades} onClose={()=>setModal(null)}/>}
      {detailTrade&&(
        <TradeDetailPanel
          trade={detailTrade}
          strategies={data.settings?.strategies||[]}
          tags={data.settings?.tags||[]}
          onSave={(updated)=>{
            setDetailTrade(updated);
            setData({...data,trades:data.trades.map(t=>t.fill?.buyFillId===updated.fill?.buyFillId?updated:t)});
          }}
          onClose={()=>setDetailTrade(null)}
        />
      )}
    </div>
  );
}
