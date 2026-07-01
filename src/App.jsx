import { useState, useEffect, useCallback, useRef } from "react";
import { fsaSupported, openFile, createFile, readData, writeData, readLocalStorage, defaultData, mergeTrades } from "./storage.js";
import { fmtDollars } from "./utils/compute.js";
import { Mt5ImportModal } from "./components/Mt5ImportModal.jsx";
import { Mt5AccountAnalytics } from "./components/Mt5AccountAnalytics.jsx";
import { BotsPage } from "./components/BotsPage.jsx";
import { AccountsPage } from "./components/AccountsPage.jsx";
import { T, btn, Card } from "./utils/theme.jsx";
import { CrossAccountDashboard } from './components/CrossAccountDashboard.jsx';
import { ACCOUNTS } from './accounts.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const CardHead = ({title, action}) => (
  <div style={{padding:"10px 14px", borderBottom:`0.5px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
    <span style={{fontSize:11, fontWeight:500, color:T.hint, textTransform:"uppercase", letterSpacing:"0.8px"}}>{title}</span>
    {action}
  </div>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
// MT5 account deep-dive — single-select, renders Mt5AccountAnalytics for the
// chosen account. Reached by clicking an Overview card or the account picker.
function Dashboard({selectedId, accounts, mt5Trades, fmtDollars}) {
  const fallback = accounts.find(a => !a.deprecated) || accounts[0];
  const acc = accounts.find(a => a.id === selectedId) || fallback;

  if (!acc) {
    return <div style={{padding:40,textAlign:"center",color:T.hint,fontSize:13}}>No accounts yet — import an MT5 report to create one.</div>;
  }

  return (
    <Mt5AccountAnalytics
      account={acc}
      trades={mt5Trades.filter(t=>t.accountId===acc.id)}
      T={T}
      fmtDollars={fmtDollars}
    />
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage({data, onDataChange}) {
  const [toast,setToast]=useState("");
  const toast_=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  function exportJSON(){
    const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`trade_journal_${new Date().toISOString().slice(0,10)}.json`;a.click();toast_("Exported ✓");
  }
  function exportCSV(){
    const h=["openTime","closeTime","symbol","direction","volume","pnl","classification","accountId","commission","swap"];
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

  return (
    <div style={{maxWidth:560,display:"flex",flexDirection:"column",gap:14}}>
      {toast&&<div style={{position:"fixed",bottom:24,right:24,background:T.card,border:`0.5px solid ${T.green}`,color:T.green,padding:"10px 18px",borderRadius:8,fontSize:12,zIndex:999}}>{toast}</div>}

      <Card>
        <CardHead title="Data management"/>
        <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button style={btn()} onClick={exportJSON}>Export backup (JSON)</button>
            <button style={btn("ghost")} onClick={exportCSV}>Export trades (CSV)</button>
            <label style={{...btn("ghost"),cursor:"pointer"}}>Restore backup<input type="file" accept=".json" style={{display:"none"}} onChange={importJSON}/></label>
          </div>
          <div style={{fontSize:11,color:T.hint,lineHeight:1.7}}>All data is stored as a local .json file on your machine. Export JSON backups regularly. The CSV export contains all MT5 trade fields for use in spreadsheets.</div>
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
  const [page, setPage] = useState("overview");
  const [modal, setModal] = useState(null);
  const [selectedMt5AccId, setSelectedMt5AccId] = useState(null);
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

  function createMt5Account(account) {
    setData({ ...data, mt5Accounts: [...(data.mt5Accounts || []), account] });
  }

  async function handleMerge(incomingTrades) {
    const merged = mergeTrades(data.trades, incomingTrades);
    setData({ ...data, trades: merged });
  }

  function saveBot(b) {
    const bots = data.bots || [];
    const exists = bots.find(x => x.id === b.id);
    setData({ ...data, bots: exists ? bots.map(x => x.id === b.id ? b : x) : [...bots, { ...b, id: b.id || uid() }] });
  }
  function deleteBot(id) {
    if (!confirm("Delete this bot?")) return;
    setData({ ...data, bots: (data.bots || []).filter(b => b.id !== id) });
  }

  function saveAccountOverride(accountId, patch) {
    setData({
      ...data,
      accountOverrides: {
        ...data.accountOverrides,
        [accountId]: { ...(data.accountOverrides?.[accountId] || {}), ...patch },
      },
    });
  }
  function setDeprecated(accountId, deprecated) {
    if (deprecated) {
      const acc = mt5Accounts.find(a => a.id === accountId);
      const today = new Date().toISOString().slice(0, 10);
      const daysSurvived = acc?.openedDate
        ? Math.max(0, Math.floor((new Date(today) - new Date(acc.openedDate)) / 86400000))
        : null;
      saveAccountOverride(accountId, {
        deprecated: true,
        deprecatedDate: today,
        daysSurvived,
        stageAtDeprecation: acc?.phase ?? null,
      });
    } else {
      saveAccountOverride(accountId, { deprecated: false, deprecatedDate: null, daysSurvived: null, stageAtDeprecation: null });
    }
  }

  const PAGES=[["overview","Overview"],["dashboard","Dashboard"],["bots","Bots"],["accounts","Accounts"],["settings","Settings"]];
  const mt5Accounts = [...ACCOUNTS, ...(data.mt5Accounts || [])]
    .map(a => ({ ...a, ...(data.accountOverrides?.[a.id] || {}) }));

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
          <button style={btn("ghost")} onClick={()=>setModal("import-mt5")}>↑ Import MT5</button>
        </div>
      </div>

      {/* MT5 account picker — shown on Dashboard, single-select */}
      {page==="dashboard"&&(
        <div style={{background:T.card,borderBottom:`0.5px solid ${T.border}`,padding:"6px 20px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:T.hint,marginRight:2}}>Account:</span>
          {mt5Accounts.filter(a=>!a.deprecated).map(a=>(
            <button key={a.id}
              onClick={()=>setSelectedMt5AccId(a.id)}
              style={{...btn(selectedMt5AccId===a.id?"primary":"ghost"),padding:"3px 10px",fontSize:11}}
            >{a.label} · #{a.login}</button>
          ))}
          {mt5Accounts.some(a=>a.deprecated)&&(<>
            <span style={{fontSize:11,color:T.hint,marginLeft:12}}>Deprecated:</span>
            {mt5Accounts.filter(a=>a.deprecated).map(a=>(
              <button key={a.id}
                onClick={()=>setSelectedMt5AccId(a.id)}
                style={{...btn(selectedMt5AccId===a.id?"primary":"ghost"),padding:"3px 10px",fontSize:11,opacity:0.55}}
              >{a.label} · #{a.login}</button>
            ))}
          </>)}
        </div>
      )}

      {/* Content */}
      <div style={{padding:"20px",maxWidth:1100,margin:"0 auto"}}>
        {page==="overview"&&(
          <CrossAccountDashboard
            accounts={mt5Accounts.filter(a=>!a.deprecated)}
            allTrades={data.trades}
            T={T}
            fmtDollars={fmtDollars}
            onSelectAccount={id=>{setSelectedMt5AccId(id);setPage("dashboard");}}
          />
        )}
        {page==="dashboard"&&(
          <Dashboard
            selectedId={selectedMt5AccId}
            accounts={mt5Accounts}
            mt5Trades={data.trades.filter(t=>t.platform==="mt5")}
            fmtDollars={fmtDollars}
          />
        )}
        {page==="bots"&&<BotsPage bots={data.bots||[]} onSave={saveBot} onDelete={deleteBot}/>}
        {page==="accounts"&&<AccountsPage accounts={mt5Accounts} onSaveOverride={saveAccountOverride} onSetDeprecated={setDeprecated}/>}
        {page==="settings"&&<SettingsPage data={data} onDataChange={setData}/>}
      </div>

      {modal==="import-mt5"&&(
        <Mt5ImportModal
          accounts={mt5Accounts}
          onImport={(trades)=>{ handleMerge(trades); setModal(null); }}
          onCreateAccount={createMt5Account}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  );
}
