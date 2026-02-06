import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Building2, Users, CreditCard, FileText, AlertTriangle, TrendingUp, ChevronRight, Search, Plus, Eye, Send, Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, LayoutDashboard, Store, Receipt, FileCheck, RefreshCw, X, Loader2, ExternalLink, Download, DollarSign, Package, ChevronLeft, ChevronsLeft, ChevronsRight, FileDown, Columns, Edit3, Save, Upload, Filter, ChevronDown, Trash2, Link, Unlink, Info, Copy } from "lucide-react";

// ─── CONFIG ─────────────────────────────────────────────────
const SUPABASE_URL = "https://pjbdgzkcvbajfcrlrzbs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYmRnemtjdmJhamZjcmxyemJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYyODMsImV4cCI6MjA4NTY1MjI4M30.6YGpHPOWHiaTqlO5ZsqjcAYp9Eddxmo3i1KrmcflqMw";
const N8N_BASE = "https://francescomeli.app.n8n.cloud/webhook";
const PAGE_SIZE = 50;

// ─── SUPABASE HELPERS ───────────────────────────────────────
const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const sb = async (table, params = "") => {
  const sep = params ? "?" + params : "";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${sep}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase error: ${r.status}`);
  return r.json();
};
const sbCount = async (table, params = "") => {
  const sep = params ? "&" + params : "";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count${sep}`, { headers: { ...sbHeaders, Prefer: "count=exact" } });
  const count = r.headers.get("content-range")?.split("/")[1];
  return parseInt(count || "0");
};
const sbPost = async (table, data) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const txt = await r.text(); throw new Error(`POST ${table}: ${r.status} - ${txt}`); }
  return r.json();
};
const sbPatch = async (table, filter, data) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const txt = await r.text(); throw new Error(`PATCH ${table}: ${r.status} - ${txt}`); }
  return r.json();
};
const sbDelete = async (table, filter) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: sbHeaders });
  if (!r.ok) throw new Error(`DELETE ${table}: ${r.status}`);
};

// ─── FORMATTERS ─────────────────────────────────────────────
const eur = (v) => v == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);
const eurShort = (v) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return `€${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `€${(v / 1e3).toFixed(1)}K`;
  return eur(v);
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("it-IT") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

const STATUS_MAP = {
  attivo_regolare: { label: "Attivo", color: "bg-emerald-100 text-emerald-800" },
  attivo_in_attesa: { label: "In Attesa", color: "bg-amber-100 text-amber-800" },
  sospeso_insoluto: { label: "Sospeso", color: "bg-red-100 text-red-800" },
  cessato: { label: "Cessato", color: "bg-gray-100 text-gray-600" },
  in_onboarding: { label: "Onboarding", color: "bg-blue-100 text-blue-800" },
  bozza_solo_cliente: { label: "Bozza Cliente", color: "bg-slate-100 text-slate-600" },
  bozza_nuovo: { label: "Bozza Nuovo", color: "bg-slate-100 text-slate-500" },
};
const SUB_STATUS_MAP = {
  active: { label: "Active", color: "bg-emerald-100 text-emerald-800" },
  past_due: { label: "Past Due", color: "bg-red-100 text-red-800" },
  canceled: { label: "Canceled", color: "bg-gray-200 text-gray-500" },
  trialing: { label: "Trial", color: "bg-blue-100 text-blue-800" },
  incomplete: { label: "Incomplete", color: "bg-amber-100 text-amber-800" },
  unpaid: { label: "Unpaid", color: "bg-red-200 text-red-900" },
};

// ─── CSV EXPORT ─────────────────────────────────────────────
function exportCSV(rows, columns, filename) {
  if (!rows.length) return;
  const sep = ";";
  const header = columns.map(c => c.label).join(sep);
  const lines = rows.map(row =>
    columns.map(c => {
      let val = c.accessor(row);
      if (val == null) val = "";
      val = String(val).replace(/"/g, '""');
      if (String(val).includes(sep) || String(val).includes('"') || String(val).includes("\n")) val = `"${val}"`;
      return val;
    }).join(sep)
  );
  const bom = "\uFEFF";
  const csv = bom + header + "\n" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── SHARED COMPONENTS ──────────────────────────────────────
const Spinner = () => (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>);
const EmptyState = ({ icon: Icon, text }) => (<div className="flex flex-col items-center justify-center py-12 text-gray-400"><Icon size={40} className="mb-3 opacity-40" /><p className="text-sm font-medium">{text}</p></div>);
const Badge = ({ children, color = "gray" }) => {
  const colors = { green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", gray: "bg-gray-100 text-gray-600", purple: "bg-purple-100 text-purple-800", slate: "bg-gray-200 text-gray-500" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[color] || colors.gray}`}>{children}</span>;
};
const SearchBar = ({ value, onChange, placeholder = "Cerca..." }) => (<div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" /></div>);
const FilterChip = ({ label, active, onClick, count }) => (<button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${active ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{label}{count != null ? ` (${count})` : ""}</button>);

const Modal = ({ open, onClose, title, children, wide, extraWide }) => {
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4" onClick={onClose}>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
    <div className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[88vh] overflow-y-auto ${extraWide ? "w-full max-w-6xl" : wide ? "w-full max-w-4xl" : "w-full max-w-2xl"}`} onClick={(e) => e.stopPropagation()}>
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>);
};

const Pagination = ({ page, totalPages, total, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (<div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
    <span className="text-xs text-gray-500">{total} risultati — Pagina {page + 1} di {totalPages}</span>
    <div className="flex gap-1">
      <button onClick={() => onPageChange(0)} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronsLeft size={16} /></button>
      <button onClick={() => onPageChange(page - 1)} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
      <span className="px-3 py-1.5 text-xs font-bold text-gray-600">{page + 1}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
      <button onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronsRight size={16} /></button>
    </div>
  </div>);
};

function ExportButton({ rows, allColumns, filename }) {
  const [open, setOpen] = useState(false);
  const [selectedCols, setSelectedCols] = useState(() => allColumns.map((_, i) => i));
  const toggle = (i) => setSelectedCols(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  return (<div className="relative">
    <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200"><FileDown size={14} /> CSV</button>
    {open && (<div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 w-64 max-h-72 overflow-y-auto">
      <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-gray-700">Colonne</span>
        <div className="flex gap-1"><button onClick={() => setSelectedCols(allColumns.map((_, i) => i))} className="text-[10px] text-indigo-600 hover:underline">Tutte</button><button onClick={() => setSelectedCols([])} className="text-[10px] text-gray-400 hover:underline">Nessuna</button></div>
      </div>
      {allColumns.map((c, i) => (<label key={i} className="flex items-center gap-2 py-0.5 text-xs cursor-pointer"><input type="checkbox" checked={selectedCols.includes(i)} onChange={() => toggle(i)} className="rounded" />{c.label}</label>))}
      <button onClick={() => { exportCSV(rows, selectedCols.map(i => allColumns[i]), filename); setOpen(false); }} disabled={selectedCols.length === 0} className="mt-2 w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-30">Scarica CSV ({rows.length} righe)</button>
    </div>)}
  </div>);
}

// ─── DATA HOOK ──────────────────────────────────────────────
function useData(table, params = "", deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await sb(table, params); setData(d); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [table, params]);
  useEffect(() => { load(); }, [load, ...deps]);
  return { data, loading, error, reload: load };
}

const KpiCard = ({ icon: Icon, title, value, subtitle, accent = "blue", onClick, small }) => {
  const accents = { blue: "from-blue-500 to-blue-600", green: "from-emerald-500 to-emerald-600", red: "from-red-500 to-red-600", amber: "from-amber-500 to-amber-600", purple: "from-purple-500 to-purple-600", indigo: "from-indigo-500 to-indigo-600" };
  return (<button onClick={onClick} className={`bg-white border border-gray-100 rounded-2xl ${small ? "p-4" : "p-5"} text-left hover:shadow-lg hover:border-gray-200 transition-all w-full group`}>
    <div className="flex items-start justify-between">
      <div className={`${small ? "p-1.5" : "p-2"} bg-gradient-to-br ${accents[accent]} rounded-xl shadow-sm`}><Icon size={small ? 14 : 18} className="text-white" /></div>
      {onClick && <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 mt-1" />}
    </div>
    <p className={`${small ? "text-lg" : "text-2xl"} font-bold text-gray-900 mt-3`}>{value}</p>
    <p className={`${small ? "text-[10px]" : "text-xs"} font-medium text-gray-500 mt-0.5`}>{title}</p>
    {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
  </button>);
};

const shortName = (name) => {
  if (!name) return "—";
  return name.replace(/BS-/g, "").replace(/ - LICENZA.*$/i, "").replace(/ LICENZA.*$/i, "").trim();
};

// ─── STATUS MSG COMPONENT ───────────────────────────────────
const StatusMessage = ({ msg, onClear }) => {
  if (!msg) return null;
  return (<div className={`p-3 rounded-xl text-sm flex items-center justify-between ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
    <span>{msg.text}</span>
    <button onClick={onClear} className="ml-2 p-0.5 rounded hover:bg-white/50"><X size={14} /></button>
  </div>);
};

// ─── FORM INPUT HELPERS ─────────────────────────────────────
const FormField = ({ label, children, hint }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
  </div>
);
const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";
const selectCls = "w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";

// ─── ADVANCED FILTER PANEL ──────────────────────────────────
function AdvancedFilters({ filters, onFilterChange, filterConfig, totalCount, filteredCount }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v !== "" && v !== "all";
    return v != null;
  }).length;

  return (<div className="space-y-2">
    <button onClick={() => setExpanded(!expanded)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeCount > 0 ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"}`}>
      <Filter size={14} /> Filtri {activeCount > 0 && <span className="bg-indigo-600 text-white rounded-full px-1.5 py-0.5 text-[10px]">{activeCount}</span>}
      <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && (<div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filterConfig.map((cfg) => (
          <div key={cfg.key}>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{cfg.label}</label>
            {cfg.type === "multi-select" ? (
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                {cfg.options.map(opt => {
                  const active = (filters[cfg.key] || []).includes(opt.value);
                  return (<button key={opt.value} onClick={() => {
                    const current = filters[cfg.key] || [];
                    onFilterChange(cfg.key, active ? current.filter(x => x !== opt.value) : [...current, opt.value]);
                  }} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${active ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                    {opt.label}{opt.count != null ? ` (${opt.count})` : ""}
                  </button>);
                })}
              </div>
            ) : cfg.type === "select" ? (
              <select value={filters[cfg.key] || ""} onChange={e => onFilterChange(cfg.key, e.target.value)} className={selectCls + " text-xs py-1.5"}>
                <option value="">Tutti</option>
                {cfg.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : cfg.type === "date-range" ? (
              <div className="flex gap-1">
                <input type="date" value={filters[cfg.key + "_from"] || ""} onChange={e => onFilterChange(cfg.key + "_from", e.target.value)} className={inputCls + " text-[10px] py-1.5"} placeholder="Da" />
                <input type="date" value={filters[cfg.key + "_to"] || ""} onChange={e => onFilterChange(cfg.key + "_to", e.target.value)} className={inputCls + " text-[10px] py-1.5"} placeholder="A" />
              </div>
            ) : cfg.type === "text-contains" ? (
              <input type="text" value={filters[cfg.key] || ""} onChange={e => onFilterChange(cfg.key, e.target.value)} placeholder={cfg.placeholder || "Contiene..."} className={inputCls + " text-xs py-1.5"} />
            ) : null}
          </div>
        ))}
      </div>
      {activeCount > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">{filteredCount} di {totalCount} risultati</span>
          <button onClick={() => { filterConfig.forEach(cfg => { if (cfg.type === "date-range") { onFilterChange(cfg.key + "_from", ""); onFilterChange(cfg.key + "_to", ""); } else if (cfg.type === "multi-select") { onFilterChange(cfg.key, []); } else { onFilterChange(cfg.key, ""); } }); }} className="text-xs text-red-500 hover:text-red-700 font-bold">Reset filtri</button>
        </div>
      )}
    </div>)}
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// CFO DASHBOARD with MRR Breakdown
// ═══════════════════════════════════════════════════════════════
function CfoDashboard() {
  const { data: mrrBreakdown, loading: l1 } = useData("v_mrr_breakdown");
  const { data: mrrByProduct, loading: l2 } = useData("v_mrr_by_product_detail", "order=product_mrr.desc");
  const { data: mrrByCustomer } = useData("v_mrr_by_customer_detail", "order=customer_mrr.desc&limit=50");
  const { data: esercizi } = useData("v_esercizi_full", "select=esercizio_id,nome_esercizio,customer_id,status,tipologia,citta,stripe_subscription_id,sub_status");
  const { data: openInvoices } = useData("v_invoices_with_payments", "status=eq.open&order=due_date.asc");

  const [drillDown, setDrillDown] = useState(null);

  const loading = l1 || l2;
  if (loading) return <Spinner />;

  const s = mrrBreakdown?.[0] || {};
  const chartProducts = (mrrByProduct || []).slice(0, 10).map((p) => ({ ...p, short_name: shortName(p.product_name) }));
  const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95"];

  const esCount = esercizi?.length || 0;
  const esActive = esercizi?.filter(e => e.status === "attivo_regolare").length || 0;
  const esNoSub = esercizi?.filter(e => !e.stripe_subscription_id).length || 0;
  const overdueCount = openInvoices?.filter(inv => inv.due_date && new Date(inv.due_date) < new Date()).length || 0;

  return (<div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">Dashboard CFO</h1><p className="text-sm text-gray-500 mt-0.5">Biorsaf — Stripe Finance Intelligence Hub</p></div>

    {/* KPI ROW */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard icon={TrendingUp} title="MRR Totale" value={eur(s.mrr_total)} subtitle={`Active: ${eur(s.mrr_active)} | Past Due: ${eur(s.mrr_past_due)}`} accent="green" onClick={() => setDrillDown("mrr")} />
      <KpiCard icon={DollarSign} title="ARR" value={eur((s.mrr_total || 0) * 12)} subtitle={`${s.subs_active || 0} subs attive + ${s.subs_past_due || 0} past due`} accent="blue" onClick={() => setDrillDown("arr")} />
      <KpiCard icon={Store} title="Esercizi" value={esCount} subtitle={`${esActive} attivi — ${esNoSub} senza sub`} accent="purple" />
      <KpiCard icon={AlertTriangle} title="Fatture Scadute" value={overdueCount} subtitle={overdueCount > 0 ? `su ${openInvoices?.length || 0} aperte` : "Nessuna scaduta"} accent={overdueCount > 0 ? "red" : "green"} onClick={() => setDrillDown("overdue")} />
    </div>

    {/* MRR BREAKDOWN */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 col-span-2">
        <h3 className="text-sm font-bold text-gray-700 mb-1">MRR per Prodotto</h3>
        <p className="text-[10px] text-gray-400 mb-4">Inclusi unit price range per prodotto</p>
        {chartProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(220, chartProducts.length * 38)}>
            <BarChart data={chartProducts} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={eurShort} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="short_name" width={120} tick={{ fontSize: 10, fill: "#6b7280" }} interval={0} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (<div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                  <p className="font-bold text-gray-900 mb-1">{d.product_name}</p>
                  <p>MRR: <span className="font-bold text-emerald-700">{eur(d.product_mrr)}</span></p>
                  <p>Subs: {d.subs_count} — Utenze: {d.total_utenze}</p>
                  <p>Prezzo unit: {eur(d.min_unit_price_eur)} — {eur(d.max_unit_price_eur)}</p>
                  {d.distinct_unit_prices > 1 && <p className="text-amber-600 font-bold mt-1">⚠ {d.distinct_unit_prices} prezzi diversi</p>}
                </div>);
              }} />
              <Bar dataKey="product_mrr" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState icon={Package} text="Nessun dato MRR" />}
      </div>

      {/* MRR Summary sidebar */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Breakdown MRR</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" /> Active ({s.subs_active || 0} subs)</span><span className="text-sm font-bold text-emerald-700">{eur(s.mrr_active)}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> Past Due ({s.subs_past_due || 0} subs)</span><span className="text-sm font-bold text-red-600">{eur(s.mrr_past_due)}</span></div>
            {s.mrr_trialing > 0 && <div className="flex items-center justify-between"><span className="text-xs text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-500 rounded-full inline-block" /> Trialing ({s.subs_trialing || 0})</span><span className="text-sm font-bold text-blue-600">{eur(s.mrr_trialing)}</span></div>}
            <div className="border-t border-gray-100 pt-2 flex items-center justify-between"><span className="text-xs font-bold text-gray-700">Totale</span><span className="text-base font-bold text-gray-900">{eur(s.mrr_total)}</span></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Price Variation</h3>
          <div className="space-y-2">
            {(mrrByProduct || []).filter(p => p.distinct_unit_prices > 1).map((p, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium text-gray-800">{shortName(p.product_name)}</p>
                <p className="text-gray-500">{p.distinct_unit_prices} prezzi: {eur(p.min_unit_price_eur)} → {eur(p.max_unit_price_eur)}</p>
              </div>
            ))}
            {(mrrByProduct || []).every(p => p.distinct_unit_prices <= 1) && <p className="text-xs text-gray-400">Nessuna variazione prezzo</p>}
          </div>
        </div>
      </div>
    </div>

    {/* DRILLDOWN MODALS */}
    <Modal open={drillDown === "mrr"} onClose={() => setDrillDown(null)} title="MRR per Cliente" wide>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50">
        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Cliente</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Subs</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Utenze</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">MRR Active</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">MRR Past Due</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">MRR Totale</th>
      </tr></thead><tbody>{(mrrByCustomer || []).map((c, i) => (
        <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50/30 ${c.has_past_due ? "bg-red-50/30" : ""}`}>
          <td className="py-2.5 px-3"><span className="font-medium text-gray-900">{c.ragione_sociale || c.stripe_customer_id}</span><br/><span className="text-[10px] text-gray-400">{c.email || ""}</span></td>
          <td className="py-2.5 px-3 text-right">{c.subs_count}</td>
          <td className="py-2.5 px-3 text-right">{c.total_utenze}</td>
          <td className="py-2.5 px-3 text-right text-emerald-700">{c.mrr_active > 0 ? eur(c.mrr_active) : "—"}</td>
          <td className="py-2.5 px-3 text-right text-red-600">{c.mrr_past_due > 0 ? eur(c.mrr_past_due) : "—"}</td>
          <td className="py-2.5 px-3 text-right font-bold">{eur(c.customer_mrr)}</td>
        </tr>))}</tbody></table>
    </Modal>

    <Modal open={drillDown === "arr"} onClose={() => setDrillDown(null)} title="ARR per Prodotto" wide>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50">
        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Prodotto</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Subs</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Utenze</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">MRR</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">ARR</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Avg Unit €</th>
      </tr></thead><tbody>{(mrrByProduct || []).map((p, i) => (
        <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30">
          <td className="py-2.5 px-3 font-medium text-gray-900 max-w-xs truncate">{p.product_name}</td>
          <td className="py-2.5 px-3 text-right">{p.subs_count}</td>
          <td className="py-2.5 px-3 text-right">{p.total_utenze}</td>
          <td className="py-2.5 px-3 text-right">{eur(p.product_mrr)}</td>
          <td className="py-2.5 px-3 text-right font-bold text-blue-700">{eur(p.product_mrr * 12)}</td>
          <td className="py-2.5 px-3 text-right text-gray-500">{eur(p.avg_unit_price_eur)}{p.distinct_unit_prices > 1 && <span className="ml-1 text-amber-500">⚠</span>}</td>
        </tr>))}</tbody></table>
    </Modal>

    <Modal open={drillDown === "overdue"} onClose={() => setDrillDown(null)} title={`Fatture Scadute (${overdueCount})`} wide>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50">
        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">N. Fattura</th>
        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Cliente</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Totale</th>
        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Residuo</th>
        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Scadenza</th>
        <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-600">Link</th>
      </tr></thead><tbody>{(openInvoices || []).filter(inv => inv.due_date && new Date(inv.due_date) < new Date()).map((inv, i) => (
        <tr key={i} className="border-b border-gray-50 bg-red-50/30">
          <td className="py-2.5 px-3 font-mono text-xs">{inv.invoice_number || "—"}</td>
          <td className="py-2.5 px-3 font-medium text-gray-900">{inv.customer_name || "—"}</td>
          <td className="py-2.5 px-3 text-right">{eur(inv.total_eur)}</td>
          <td className="py-2.5 px-3 text-right font-bold text-red-600">{eur(inv.amount_remaining_eur)}</td>
          <td className="py-2.5 px-3 text-red-600 font-bold">{fmtDate(inv.due_date)}</td>
          <td className="py-2.5 px-3 text-center">{inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={14} /></a>}</td>
        </tr>))}</tbody></table>
    </Modal>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// ESERCIZI PAGE - with Advanced Filters + Quick Create
// ═══════════════════════════════════════════════════════════════
function EserciziPage() {
  const { data, loading, reload } = useData("v_esercizi_full", "order=nome_esercizio.asc");
  const { data: customers } = useData("customers", "select=stripe_customer_id,ragione_sociale&deleted=is.false&order=ragione_sociale.asc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [selectedEsercizio, setSelectedEsercizio] = useState(null);
  const [esercizioInvoices, setEsercizioInvoices] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (!selectedEsercizio?.stripe_subscription_id) { setEsercizioInvoices(null); return; }
    setEsercizioInvoices(undefined);
    sb("v_invoices_with_payments", `stripe_subscription_id=eq.${selectedEsercizio.stripe_subscription_id}&order=invoice_date.desc`)
      .then(setEsercizioInvoices).catch(() => setEsercizioInvoices(null));
  }, [selectedEsercizio]);

  useEffect(() => { setPage(0); }, [search, filters]);

  if (loading) return <Spinner />;

  // Build filter options from data
  const statusCounts = {};
  const consulenteCounts = {};
  const gruppoCounts = {};
  (data || []).forEach(e => {
    if (e.status) statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    if (e.consulente) consulenteCounts[e.consulente] = (consulenteCounts[e.consulente] || 0) + 1;
    if (e.gruppo) gruppoCounts[e.gruppo] = (gruppoCounts[e.gruppo] || 0) + 1;
  });

  const filterConfig = [
    { key: "status", label: "Status", type: "multi-select", options: Object.entries(statusCounts).map(([v, c]) => ({ value: v, label: STATUS_MAP[v]?.label || v, count: c })).sort((a, b) => b.count - a.count) },
    { key: "consulente", label: "Consulente", type: "select", options: Object.entries(consulenteCounts).map(([v, c]) => ({ value: v, label: `${v} (${c})` })).sort((a, b) => b.label - a.label) },
    { key: "gruppo", label: "Gruppo", type: "select", options: Object.entries(gruppoCounts).map(([v, c]) => ({ value: v, label: `${v} (${c})` })).sort((a, b) => b.label - a.label) },
    { key: "sub_linked", label: "Subscription", type: "multi-select", options: [{ value: "linked", label: "Con sub" }, { value: "unlinked", label: "Senza sub" }] },
    { key: "nome", label: "Nome contiene", type: "text-contains", placeholder: "es: ristorante" },
    { key: "citta", label: "Città contiene", type: "text-contains", placeholder: "es: Milano" },
    { key: "created_at", label: "Data creazione", type: "date-range" },
  ];

  const filtered = (data || []).filter((e) => {
    if (search) {
      const s = search.toLowerCase().trim();
      if (!(e.nome_esercizio || "").toLowerCase().includes(s) && !(e.citta || "").toLowerCase().includes(s) && !(e.esercizio_id || "").toLowerCase().includes(s) && !(e.customer_id || "").toLowerCase().includes(s) && !(e.stripe_subscription_id || "").toLowerCase().includes(s) && !(e.customer_name || "").toLowerCase().includes(s)) return false;
    }
    if (filters.status?.length > 0 && !filters.status.includes(e.status)) return false;
    if (filters.consulente && e.consulente !== filters.consulente) return false;
    if (filters.gruppo && e.gruppo !== filters.gruppo) return false;
    if (filters.sub_linked?.length > 0) {
      const hasSub = !!e.stripe_subscription_id;
      if (filters.sub_linked.includes("linked") && !filters.sub_linked.includes("unlinked") && !hasSub) return false;
      if (filters.sub_linked.includes("unlinked") && !filters.sub_linked.includes("linked") && hasSub) return false;
    }
    if (filters.nome && !(e.nome_esercizio || "").toLowerCase().includes(filters.nome.toLowerCase())) return false;
    if (filters.citta && !(e.citta || "").toLowerCase().includes(filters.citta.toLowerCase())) return false;
    if (filters.created_at_from && e.created_at && new Date(e.created_at) < new Date(filters.created_at_from)) return false;
    if (filters.created_at_to && e.created_at && new Date(e.created_at) > new Date(filters.created_at_to + "T23:59:59")) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const csvColumns = [
    { label: "Esercizio ID", accessor: r => r.esercizio_id }, { label: "Nome", accessor: r => r.nome_esercizio },
    { label: "Status", accessor: r => r.status_label || r.status }, { label: "Tipologia", accessor: r => r.tipologia },
    { label: "Città", accessor: r => r.citta }, { label: "Provincia", accessor: r => r.provincia },
    { label: "Cliente", accessor: r => r.customer_name }, { label: "Customer ID", accessor: r => r.customer_id },
    { label: "Subscription ID", accessor: r => r.stripe_subscription_id }, { label: "Sub Status", accessor: r => r.sub_status },
    { label: "Gruppo", accessor: r => r.gruppo }, { label: "Consulente", accessor: r => r.consulente },
    { label: "Email", accessor: r => r.email }, { label: "Telefono", accessor: r => r.telefono },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold text-gray-900">Esercizi</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrati</p></div>
      <div className="flex items-center gap-2">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"><Plus size={14} /> Nuovo Esercizio</button>
        <ExportButton rows={filtered} allColumns={csvColumns} filename="esercizi" />
        <button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button>
      </div>
    </div>

    <StatusMessage msg={statusMsg} onClear={() => setStatusMsg(null)} />

    <div className="flex gap-3 items-start flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per nome, ID esercizio, città, customer, subscription..." /></div>
      <AdvancedFilters filters={filters} onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))} filterConfig={filterConfig} totalCount={data?.length || 0} filteredCount={filtered.length} />
    </div>

    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Esercizio</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Città</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Cliente</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Sub</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Consulente</th>
      </tr></thead><tbody>{pageData.map((e, i) => (
        <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30 cursor-pointer" onClick={() => setSelectedEsercizio(e)}>
          <td className="py-3 px-4"><p className="font-medium text-gray-900">{e.nome_esercizio}</p><p className="text-[10px] text-gray-400 font-mono">{e.esercizio_id}</p></td>
          <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_MAP[e.status]?.color || "bg-gray-100 text-gray-600"}`}>{STATUS_MAP[e.status]?.label || e.status || "—"}</span></td>
          <td className="py-3 px-4 text-gray-600">{e.citta || "—"}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{e.customer_name || <span className="text-gray-300">—</span>}</td>
          <td className="py-3 px-4 text-center">{e.stripe_subscription_id ? (<span className={`text-xs font-bold ${e.sub_status === "active" ? "text-emerald-600" : e.sub_status === "past_due" ? "text-red-500" : "text-gray-400"}`}>{e.sub_status || "—"}</span>) : <Unlink size={12} className="text-gray-300 inline" />}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{e.consulente || "—"}</td>
        </tr>))}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>

    {/* DETAIL MODAL */}
    {selectedEsercizio && (<Modal open={true} onClose={() => { setSelectedEsercizio(null); setEsercizioInvoices(undefined); }} title={`${selectedEsercizio.nome_esercizio} — ${selectedEsercizio.esercizio_id}`} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div><span className="text-gray-500 block text-xs mb-0.5">Status</span><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_MAP[selectedEsercizio.status]?.color || ""}`}>{STATUS_MAP[selectedEsercizio.status]?.label || selectedEsercizio.status}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Cliente</span><span className="text-sm font-medium">{selectedEsercizio.customer_name || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Subscription</span><span className="font-mono text-xs">{selectedEsercizio.stripe_subscription_id || "Nessuna"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Città</span><span className="text-sm">{selectedEsercizio.citta || "—"} {selectedEsercizio.provincia ? `(${selectedEsercizio.provincia})` : ""}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Consulente</span><span className="text-sm">{selectedEsercizio.consulente || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Gruppo</span><span className="text-sm">{selectedEsercizio.gruppo || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Tipologia</span><span className="text-sm">{selectedEsercizio.tipologia || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Email</span><span className="text-sm">{selectedEsercizio.email || "—"}</span></div>
      </div>
      <h4 className="text-sm font-bold text-gray-700 border-t border-gray-100 pt-4 mb-3">Fatture Subscription</h4>
      {esercizioInvoices === undefined ? <Spinner />
        : !selectedEsercizio.stripe_subscription_id ? (<p className="text-sm text-gray-400 py-3">Nessuna subscription collegata</p>)
        : esercizioInvoices && esercizioInvoices.length > 0 ? (
          <table className="w-full text-xs"><thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left py-2 px-2">N. Fattura</th><th className="text-left py-2 px-2">Status</th><th className="text-right py-2 px-2">Totale</th><th className="text-left py-2 px-2">Data</th><th className="text-left py-2 px-2">Scadenza</th><th className="text-center py-2 px-2">Link</th></tr></thead>
          <tbody>{esercizioInvoices.map((inv, j) => (<tr key={j} className="border-b border-gray-50"><td className="py-1.5 px-2 font-mono">{inv.invoice_number || "—"}</td><td className="py-1.5 px-2"><Badge color={inv.status === "paid" ? "green" : inv.status === "open" ? "amber" : "gray"}>{inv.status}</Badge></td><td className="py-1.5 px-2 text-right">{eur(inv.total_eur)}</td><td className="py-1.5 px-2">{fmtDate(inv.invoice_date)}</td><td className="py-1.5 px-2">{fmtDate(inv.due_date)}</td><td className="py-1.5 px-2 text-center">{inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-500"><ExternalLink size={12} /></a>}</td></tr>))}</tbody></table>
        ) : (<p className="text-sm text-gray-400 py-3">Nessuna fattura</p>)}
    </Modal>)}

    {/* CREATE ESERCIZIO MODAL */}
    <CreateEsercizioModal open={showCreate} onClose={() => setShowCreate(false)} customers={customers || []} onSuccess={(msg) => { setStatusMsg(msg); setShowCreate(false); reload(); }} />
  </div>);
}

// ─── CREATE ESERCIZIO MODAL ─────────────────────────────────
function CreateEsercizioModal({ open, onClose, customers, onSuccess }) {
  const [form, setForm] = useState({ esercizio_id: "", nome_esercizio: "", customer_id: "", tipologia: "", citta: "", provincia: "", cap: "", indirizzo: "", telefono: "", email: "", consulente: "", gruppo: "", status: "bozza_nuovo" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.esercizio_id.trim() || !form.nome_esercizio.trim()) { setError("ID e Nome obbligatori"); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form };
      if (!payload.customer_id) delete payload.customer_id;
      Object.keys(payload).forEach(k => { if (payload[k] === "") delete payload[k]; });
      await sbPost("esercizi", payload);
      onSuccess({ type: "success", text: `Esercizio ${form.esercizio_id} creato` });
      setForm({ esercizio_id: "", nome_esercizio: "", customer_id: "", tipologia: "", citta: "", provincia: "", cap: "", indirizzo: "", telefono: "", email: "", consulente: "", gruppo: "", status: "bozza_nuovo" });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const filteredCustomers = customerSearch ? customers.filter(c => (c.ragione_sociale || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.stripe_customer_id || "").toLowerCase().includes(customerSearch.toLowerCase())) : customers.slice(0, 20);

  return (<Modal open={open} onClose={onClose} title="Nuovo Esercizio" wide>
    {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}
    <div className="grid grid-cols-2 gap-4">
      <FormField label="Esercizio ID *"><input type="text" value={form.esercizio_id} onChange={e => set("esercizio_id", e.target.value)} className={inputCls} placeholder="es: 12345678" /></FormField>
      <FormField label="Nome Esercizio *"><input type="text" value={form.nome_esercizio} onChange={e => set("nome_esercizio", e.target.value)} className={inputCls} placeholder="es: Ristorante Da Mario" /></FormField>
      <FormField label="Cliente (Billing Customer)" hint="Cerca per ragione sociale o customer ID">
        <div className="space-y-1">
          <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className={inputCls} placeholder="Cerca customer..." />
          {form.customer_id && <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 rounded-lg text-xs"><span className="font-bold text-indigo-800">{customers.find(c => c.stripe_customer_id === form.customer_id)?.ragione_sociale || form.customer_id}</span><button onClick={() => set("customer_id", "")} className="text-red-400 hover:text-red-600"><X size={12} /></button></div>}
          {!form.customer_id && customerSearch && (
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredCustomers.map(c => (<button key={c.stripe_customer_id} onClick={() => { set("customer_id", c.stripe_customer_id); setCustomerSearch(""); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 border-b border-gray-50 last:border-0"><span className="font-medium">{c.ragione_sociale || "—"}</span><span className="text-gray-400 ml-2 font-mono">{c.stripe_customer_id.slice(-8)}</span></button>))}
              {filteredCustomers.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">Nessun risultato</p>}
            </div>
          )}
        </div>
      </FormField>
      <FormField label="Status"><select value={form.status} onChange={e => set("status", e.target.value)} className={selectCls}>
        {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select></FormField>
      <FormField label="Tipologia"><input type="text" value={form.tipologia} onChange={e => set("tipologia", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Città"><input type="text" value={form.citta} onChange={e => set("citta", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Provincia"><input type="text" value={form.provincia} onChange={e => set("provincia", e.target.value)} className={inputCls} maxLength={2} /></FormField>
      <FormField label="CAP"><input type="text" value={form.cap} onChange={e => set("cap", e.target.value)} className={inputCls} maxLength={5} /></FormField>
      <FormField label="Indirizzo"><input type="text" value={form.indirizzo} onChange={e => set("indirizzo", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Telefono"><input type="text" value={form.telefono} onChange={e => set("telefono", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Email"><input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Consulente"><input type="text" value={form.consulente} onChange={e => set("consulente", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Gruppo"><input type="text" value={form.gruppo} onChange={e => set("gruppo", e.target.value)} className={inputCls} /></FormField>
    </div>
    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
      <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button>
      <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Crea Esercizio</button>
    </div>
  </Modal>);
}

// ═══════════════════════════════════════════════════════════════
// CLIENTI PAGE - with Edit Customer Modal
// ═══════════════════════════════════════════════════════════════
function ClientiPage() {
  const { data, loading, reload } = useData("v_customer_full", "deleted=is.false&order=ragione_sociale.asc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSubs, setCustomerSubs] = useState(undefined);
  const [editCustomer, setEditCustomer] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (!selectedCustomer) { setCustomerSubs(undefined); return; }
    setCustomerSubs(undefined);
    sb("v_subscriptions_full", `stripe_customer_id=eq.${selectedCustomer.stripe_customer_id}&order=status.asc,start_date.desc`)
      .then(setCustomerSubs).catch(() => setCustomerSubs(null));
  }, [selectedCustomer]);

  useEffect(() => { setPage(0); }, [search, filters]);

  if (loading) return <Spinner />;

  const filterConfig = [
    { key: "has_subs", label: "Subscriptions", type: "multi-select", options: [{ value: "active", label: "Con sub attive" }, { value: "none", label: "Senza sub" }, { value: "past_due", label: "Con past due" }] },
    { key: "ragione_sociale", label: "Ragione Sociale", type: "text-contains", placeholder: "contiene..." },
    { key: "email", label: "Email", type: "text-contains", placeholder: "contiene..." },
    { key: "city", label: "Città", type: "text-contains", placeholder: "contiene..." },
  ];

  const filtered = (data || []).filter((c) => {
    if (search) { const q = search.toLowerCase(); if (!(c.ragione_sociale || "").toLowerCase().includes(q) && !(c.email || "").toLowerCase().includes(q) && !(c.stripe_customer_id || "").toLowerCase().includes(q) && !(c.partita_iva || "").toLowerCase().includes(q)) return false; }
    if (filters.has_subs?.length > 0) {
      if (filters.has_subs.includes("active") && !filters.has_subs.includes("none") && c.active_subs_count === 0) return false;
      if (filters.has_subs.includes("none") && !filters.has_subs.includes("active") && c.active_subs_count > 0) return false;
      if (filters.has_subs.includes("past_due") && !c.has_overdue) return false;
    }
    if (filters.ragione_sociale && !(c.ragione_sociale || "").toLowerCase().includes(filters.ragione_sociale.toLowerCase())) return false;
    if (filters.email && !(c.email || "").toLowerCase().includes(filters.email.toLowerCase())) return false;
    if (filters.city && !(c.indirizzo_citta || "").toLowerCase().includes(filters.city.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const csvColumns = [
    { label: "Customer ID", accessor: r => r.stripe_customer_id }, { label: "Ragione Sociale", accessor: r => r.ragione_sociale },
    { label: "Email", accessor: r => r.email }, { label: "Telefono", accessor: r => r.phone },
    { label: "P.IVA", accessor: r => r.partita_iva }, { label: "CF", accessor: r => r.codice_fiscale },
    { label: "SDI", accessor: r => r.codice_sdi }, { label: "PEC", accessor: r => r.pec },
    { label: "Città", accessor: r => r.indirizzo_citta }, { label: "Provincia", accessor: r => r.indirizzo_provincia },
    { label: "Sub Attive", accessor: r => r.active_subs_count }, { label: "Sub Totali", accessor: r => r.total_subs_count },
    { label: "MRR €", accessor: r => r.mrr_calculated }, { label: "ARR €", accessor: r => r.arr_calculated },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Clienti</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrati</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={filtered} allColumns={csvColumns} filename="clienti" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <StatusMessage msg={statusMsg} onClear={() => setStatusMsg(null)} />
    <div className="flex gap-3 items-start flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per ragione sociale, email, P.IVA, customer ID..." /></div>
      <AdvancedFilters filters={filters} onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))} filterConfig={filterConfig} totalCount={data?.length || 0} filteredCount={filtered.length} />
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Cliente</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Email</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">P.IVA</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Subs</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">MRR</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Azioni</th>
      </tr></thead><tbody>{pageData.map((c, i) => (
        <tr key={i} className={`border-b border-gray-50 hover:bg-indigo-50/30 ${c.has_overdue ? "bg-red-50/30" : ""}`}>
          <td className="py-3 px-4 cursor-pointer" onClick={() => setSelectedCustomer(c)}><p className="font-medium text-gray-900 hover:text-indigo-600">{c.ragione_sociale || "—"}</p><p className="text-[10px] text-gray-400 font-mono">{c.stripe_customer_id}</p></td>
          <td className="py-3 px-4 text-gray-500 text-xs">{c.email || "—"}</td>
          <td className="py-3 px-4 text-gray-500 text-xs font-mono">{c.partita_iva || "—"}</td>
          <td className="py-3 px-4 text-center"><span className="text-xs font-bold">{c.active_subs_count || 0}</span>{c.has_overdue && <AlertTriangle size={12} className="text-red-500 inline ml-1" />}</td>
          <td className="py-3 px-4 text-right font-medium">{c.mrr_calculated > 0 ? eur(c.mrr_calculated) : "—"}</td>
          <td className="py-3 px-4 text-center"><button onClick={() => setEditCustomer(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Edit3 size={14} /></button></td>
        </tr>))}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>

    {/* CUSTOMER DETAIL MODAL */}
    {selectedCustomer && (<Modal open={true} onClose={() => { setSelectedCustomer(null); setCustomerSubs(undefined); }} title={selectedCustomer.ragione_sociale || "Dettaglio Cliente"} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div><span className="text-gray-500 block text-xs mb-0.5">Customer ID</span><span className="font-mono text-xs">{selectedCustomer.stripe_customer_id}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Email</span><span className="text-sm">{selectedCustomer.email || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">P.IVA</span><span className="text-sm font-mono">{selectedCustomer.partita_iva || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">MRR</span><span className="font-bold text-emerald-700">{selectedCustomer.mrr_calculated > 0 ? eur(selectedCustomer.mrr_calculated) : "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Telefono</span><span className="text-sm">{selectedCustomer.phone || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">SDI</span><span className="text-sm font-mono">{selectedCustomer.codice_sdi || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">PEC</span><span className="text-sm">{selectedCustomer.pec || "—"}</span></div>
        <div><span className="text-gray-500 block text-xs mb-0.5">Indirizzo</span><span className="text-sm">{[selectedCustomer.indirizzo_via, selectedCustomer.indirizzo_citta, selectedCustomer.indirizzo_cap, selectedCustomer.indirizzo_provincia].filter(Boolean).join(", ") || "—"}</span></div>
      </div>
      <h4 className="text-sm font-bold text-gray-700 border-t border-gray-100 pt-4 mb-3">Subscriptions</h4>
      {customerSubs === undefined ? <Spinner /> : customerSubs && customerSubs.length > 0 ? (
        <div className="space-y-2">{customerSubs.map((sub, j) => (
          <div key={j} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SUB_STATUS_MAP[sub.status]?.color || "bg-gray-100 text-gray-600"}`}>{SUB_STATUS_MAP[sub.status]?.label || sub.status}</span>
              <span className="ml-2 font-mono text-xs text-gray-400">{sub.stripe_subscription_id}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold">{eur((sub.calculated_amount || sub.amount || 0) / 100)}</span>
              <span className="text-xs text-gray-400 ml-2">/{sub.billing_interval || "—"}</span>
            </div>
          </div>
        ))}</div>
      ) : (<p className="text-sm text-gray-400 py-3">Nessuna subscription</p>)}
    </Modal>)}

    {/* EDIT CUSTOMER MODAL */}
    {editCustomer && <EditCustomerModal customer={editCustomer} onClose={() => setEditCustomer(null)} onSuccess={(msg) => { setStatusMsg(msg); setEditCustomer(null); reload(); }} />}
  </div>);
}

// ─── EDIT CUSTOMER MODAL ────────────────────────────────────
function EditCustomerModal({ customer, onClose, onSuccess }) {
  const [form, setForm] = useState({
    ragione_sociale: customer.ragione_sociale || "",
    email: customer.email || "",
    phone: customer.phone || "",
    partita_iva: customer.partita_iva || "",
    codice_fiscale: customer.codice_fiscale || "",
    codice_sdi: customer.codice_sdi || "",
    pec: customer.pec || "",
    indirizzo_via: customer.indirizzo_via || "",
    indirizzo_citta: customer.indirizzo_citta || "",
    indirizzo_cap: customer.indirizzo_cap || "",
    indirizzo_provincia: customer.indirizzo_provincia || "",
    indirizzo_paese: customer.indirizzo_paese || "IT",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await sbPatch("customers", `stripe_customer_id=eq.${customer.stripe_customer_id}`, { ...form, updated_at: new Date().toISOString() });
      onSuccess({ type: "success", text: `Cliente ${form.ragione_sociale} aggiornato` });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (<Modal open={true} onClose={onClose} title={`Modifica: ${customer.ragione_sociale || customer.stripe_customer_id}`} wide>
    {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}
    <p className="text-xs text-gray-400 mb-4 font-mono">{customer.stripe_customer_id}</p>
    <div className="grid grid-cols-2 gap-4">
      <FormField label="Ragione Sociale"><input type="text" value={form.ragione_sociale} onChange={e => set("ragione_sociale", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Email"><input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Telefono"><input type="text" value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Partita IVA"><input type="text" value={form.partita_iva} onChange={e => set("partita_iva", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Codice Fiscale"><input type="text" value={form.codice_fiscale} onChange={e => set("codice_fiscale", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Codice SDI"><input type="text" value={form.codice_sdi} onChange={e => set("codice_sdi", e.target.value)} className={inputCls} maxLength={7} /></FormField>
      <FormField label="PEC"><input type="email" value={form.pec} onChange={e => set("pec", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Paese"><input type="text" value={form.indirizzo_paese} onChange={e => set("indirizzo_paese", e.target.value)} className={inputCls} maxLength={2} /></FormField>
      <FormField label="Indirizzo"><input type="text" value={form.indirizzo_via} onChange={e => set("indirizzo_via", e.target.value)} className={inputCls} /></FormField>
      <FormField label="Città"><input type="text" value={form.indirizzo_citta} onChange={e => set("indirizzo_citta", e.target.value)} className={inputCls} /></FormField>
      <FormField label="CAP"><input type="text" value={form.indirizzo_cap} onChange={e => set("indirizzo_cap", e.target.value)} className={inputCls} maxLength={5} /></FormField>
      <FormField label="Provincia"><input type="text" value={form.indirizzo_provincia} onChange={e => set("indirizzo_provincia", e.target.value)} className={inputCls} maxLength={2} /></FormField>
    </div>
    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
      <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button>
      <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salva</button>
    </div>
  </Modal>);
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTIONS PAGE
// ═══════════════════════════════════════════════════════════════
function SubscriptionsPage() {
  const { data, loading, reload } = useData("v_subscriptions_full", "order=status.asc,start_date.desc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: ["active"] });
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, filters]);
  if (loading) return <Spinner />;

  const statusCounts = {};
  (data || []).forEach((s) => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });

  const filterConfig = [
    { key: "status", label: "Status", type: "multi-select", options: Object.entries(statusCounts).map(([v, c]) => ({ value: v, label: SUB_STATUS_MAP[v]?.label || v, count: c })).sort((a, b) => b.count - a.count) },
    { key: "collection", label: "Collection", type: "multi-select", options: [{ value: "send_invoice", label: "Fattura" }, { value: "charge_automatically", label: "Auto-charge" }] },
    { key: "billing", label: "Intervallo", type: "multi-select", options: [{ value: "year", label: "Annuale" }, { value: "month", label: "Mensile" }] },
    { key: "start_date", label: "Data Inizio", type: "date-range" },
    { key: "cliente", label: "Cliente", type: "text-contains", placeholder: "contiene..." },
  ];

  const filtered = (data || []).filter((s) => {
    if (search) { const q = search.toLowerCase(); if (!(s.ragione_sociale || "").toLowerCase().includes(q) && !(s.stripe_subscription_id || "").toLowerCase().includes(q) && !(s.stripe_customer_id || "").toLowerCase().includes(q)) return false; }
    if (filters.status?.length > 0 && !filters.status.includes(s.status)) return false;
    if (filters.collection?.length > 0 && !filters.collection.includes(s.collection_method)) return false;
    if (filters.billing?.length > 0 && !filters.billing.includes(s.billing_interval)) return false;
    if (filters.cliente && !(s.ragione_sociale || "").toLowerCase().includes(filters.cliente.toLowerCase())) return false;
    if (filters.start_date_from && s.start_date && new Date(s.start_date) < new Date(filters.start_date_from)) return false;
    if (filters.start_date_to && s.start_date && new Date(s.start_date) > new Date(filters.start_date_to + "T23:59:59")) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const csvColumns = [
    { label: "Subscription ID", accessor: r => r.stripe_subscription_id }, { label: "Customer ID", accessor: r => r.stripe_customer_id },
    { label: "Ragione Sociale", accessor: r => r.ragione_sociale }, { label: "Email", accessor: r => r.customer_email },
    { label: "Status", accessor: r => r.status }, { label: "Importo €", accessor: r => (r.calculated_amount || r.amount || 0) / 100 },
    { label: "Billing", accessor: r => r.billing_interval }, { label: "Items", accessor: r => r.items_count },
    { label: "Inizio", accessor: r => r.start_date }, { label: "Periodo da", accessor: r => r.current_period_start },
    { label: "Periodo a", accessor: r => r.current_period_end }, { label: "Cancellata", accessor: r => r.canceled_at },
    { label: "Collection", accessor: r => r.collection_method },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrate</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={filtered} allColumns={csvColumns} filename="subscriptions" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <div className="flex gap-3 items-start flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per cliente, subscription ID, customer ID..." /></div>
      <AdvancedFilters filters={filters} onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))} filterConfig={filterConfig} totalCount={data?.length || 0} filteredCount={filtered.length} />
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Cliente</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Importo</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Billing</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Items</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Periodo</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Metodo</th>
      </tr></thead><tbody>{pageData.map((s, i) => {
        const dead = s.status === "canceled";
        return (<tr key={i} className={`border-b border-gray-50 ${dead ? "bg-gray-50/80 opacity-60" : s.status === "past_due" ? "bg-red-50/30" : "hover:bg-indigo-50/30"}`}>
          <td className="py-3 px-4"><p className={`font-medium ${dead ? "text-gray-500" : "text-gray-900"}`}>{s.ragione_sociale || "—"}</p><p className="text-[10px] text-gray-400 font-mono">{s.stripe_subscription_id}</p></td>
          <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${SUB_STATUS_MAP[s.status]?.color || "bg-gray-100 text-gray-600"}`}>{SUB_STATUS_MAP[s.status]?.label || s.status}</span></td>
          <td className={`py-3 px-4 text-right font-medium ${dead ? "text-gray-400 line-through" : ""}`}>{eur((s.calculated_amount || s.amount || 0) / 100)}</td>
          <td className="py-3 px-4 text-xs">{s.billing_interval || "—"}</td>
          <td className="py-3 px-4 text-center text-xs">{s.items_count || "—"}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{dead ? (<span className="text-red-500">End {fmtDate(s.canceled_at)}</span>) : (<>{fmtDate(s.current_period_start)} — {fmtDate(s.current_period_end)}</>)}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{s.collection_method === "send_invoice" ? "Fattura" : s.collection_method === "charge_automatically" ? "Auto" : s.collection_method || "—"}</td>
        </tr>);
      })}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// INVOICES PAGE
// ═══════════════════════════════════════════════════════════════
function InvoicesPage() {
  const { data, loading, reload } = useData("v_invoices_with_payments", "order=invoice_date.desc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, filters]);
  if (loading) return <Spinner />;

  const statusCounts = {};
  (data || []).forEach((inv) => { statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1; });

  const filterConfig = [
    { key: "status", label: "Status", type: "multi-select", options: Object.entries(statusCounts).map(([v, c]) => ({ value: v, label: v, count: c })).sort((a, b) => b.count - a.count) },
    { key: "collection", label: "Metodo", type: "multi-select", options: [{ value: "send_invoice", label: "Fattura" }, { value: "charge_automatically", label: "Auto" }] },
    { key: "invoice_date", label: "Data Fattura", type: "date-range" },
    { key: "due_date", label: "Scadenza", type: "date-range" },
    { key: "cliente", label: "Cliente", type: "text-contains", placeholder: "contiene..." },
  ];

  const filtered = (data || []).filter((inv) => {
    if (search) { const q = search.toLowerCase(); if (!(inv.customer_name || "").toLowerCase().includes(q) && !(inv.invoice_number || "").toLowerCase().includes(q) && !(inv.stripe_customer_id || "").toLowerCase().includes(q) && !(inv.stripe_subscription_id || "").toLowerCase().includes(q)) return false; }
    if (filters.status?.length > 0 && !filters.status.includes(inv.status)) return false;
    if (filters.collection?.length > 0 && !filters.collection.includes(inv.collection_method)) return false;
    if (filters.cliente && !(inv.customer_name || "").toLowerCase().includes(filters.cliente.toLowerCase())) return false;
    if (filters.invoice_date_from && inv.invoice_date && new Date(inv.invoice_date) < new Date(filters.invoice_date_from)) return false;
    if (filters.invoice_date_to && inv.invoice_date && new Date(inv.invoice_date) > new Date(filters.invoice_date_to + "T23:59:59")) return false;
    if (filters.due_date_from && inv.due_date && new Date(inv.due_date) < new Date(filters.due_date_from)) return false;
    if (filters.due_date_to && inv.due_date && new Date(inv.due_date) > new Date(filters.due_date_to + "T23:59:59")) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const csvColumns = [
    { label: "N. Fattura", accessor: r => r.invoice_number }, { label: "Invoice ID", accessor: r => r.stripe_invoice_id },
    { label: "Customer ID", accessor: r => r.stripe_customer_id }, { label: "Cliente", accessor: r => r.customer_name },
    { label: "Email", accessor: r => r.customer_email }, { label: "P.IVA", accessor: r => r.partita_iva },
    { label: "Status", accessor: r => r.status }, { label: "Subtotale €", accessor: r => r.subtotal_eur },
    { label: "IVA €", accessor: r => r.tax_eur }, { label: "Totale €", accessor: r => r.total_eur },
    { label: "Pagato €", accessor: r => r.amount_paid_eur }, { label: "Residuo €", accessor: r => r.amount_remaining_eur },
    { label: "Data", accessor: r => r.invoice_date }, { label: "Scadenza", accessor: r => r.due_date },
    { label: "Subscription ID", accessor: r => r.stripe_subscription_id }, { label: "Metodo", accessor: r => r.payment_method_type },
    { label: "Billing Reason", accessor: r => r.billing_reason }, { label: "Link", accessor: r => r.hosted_invoice_url },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Fatture</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrate</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={filtered} allColumns={csvColumns} filename="fatture" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <div className="flex gap-3 items-start flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per cliente, numero fattura, customer ID..." /></div>
      <AdvancedFilters filters={filters} onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))} filterConfig={filterConfig} totalCount={data?.length || 0} filteredCount={filtered.length} />
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">N. Fattura</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Cliente</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Totale</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Residuo</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Scadenza</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Metodo</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Link</th>
      </tr></thead><tbody>{pageData.map((inv, i) => {
        const overdue = inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date();
        return (<tr key={i} className={`border-b border-gray-50 ${overdue ? "bg-red-50/50" : inv.status === "void" ? "opacity-50" : "hover:bg-gray-50/50"}`}>
          <td className="py-3 px-4 font-mono text-xs">{inv.invoice_number || "—"}</td>
          <td className="py-3 px-4"><p className="font-medium text-gray-900">{inv.customer_name || "—"}</p><p className="text-[10px] text-gray-400 font-mono">{inv.stripe_customer_id}</p></td>
          <td className="py-3 px-4"><Badge color={inv.status === "paid" ? "green" : inv.status === "open" ? (overdue ? "red" : "amber") : "gray"}>{inv.status}{overdue ? " ⚠" : ""}</Badge></td>
          <td className="py-3 px-4 text-right">{eur(inv.total_eur)}</td>
          <td className="py-3 px-4 text-right font-semibold text-red-600">{inv.amount_remaining_eur > 0 ? eur(inv.amount_remaining_eur) : "—"}</td>
          <td className={`py-3 px-4 ${overdue ? "text-red-600 font-bold" : ""}`}>{fmtDate(inv.due_date)}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{inv.collection_method === "send_invoice" ? "Fattura" : inv.collection_method === "charge_automatically" ? "Auto" : "—"}</td>
          <td className="py-3 px-4 text-center">{inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={14} /></a>}</td>
        </tr>);
      })}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION CREATION PAGE
// ═══════════════════════════════════════════════════════════════
function CreateSubscriptionPage() {
  const { data: customers } = useData("customers", "select=stripe_customer_id,ragione_sociale,email&deleted=is.false&order=ragione_sociale.asc");
  const { data: productsRaw } = useData("v_products_with_prices", "order=product_name.asc");
  const { data: allEsercizi } = useData("esercizi", "select=esercizio_id,nome_esercizio,customer_id,citta,status&order=nome_esercizio.asc");

  const [step, setStep] = useState(1); // 1=customer, 2=items, 3=review
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [items, setItems] = useState([]);
  const [draftSettings, setDraftSettings] = useState({ collection_method: "send_invoice", days_until_due: 30, billing_interval: "year", start_date: "", tax_rate_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Filter products to only recurring
  const products = useMemo(() => {
    if (!productsRaw) return [];
    const grouped = {};
    productsRaw.forEach(p => {
      if (!p.recurring_interval) return;
      if (!grouped[p.stripe_product_id]) grouped[p.stripe_product_id] = { product_name: p.product_name, stripe_product_id: p.stripe_product_id, prices: [] };
      grouped[p.stripe_product_id].prices.push(p);
    });
    return Object.values(grouped);
  }, [productsRaw]);

  // Esercizi for selected customer
  const customerEsercizi = useMemo(() => {
    if (!selectedCustomer || !allEsercizi) return [];
    return allEsercizi.filter(e => e.customer_id === selectedCustomer.stripe_customer_id);
  }, [selectedCustomer, allEsercizi]);

  const filteredCustomers = customerSearch ? (customers || []).filter(c => (c.ragione_sociale || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.stripe_customer_id || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.email || "").toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 15) : [];

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now(), esercizio_id: "", product_id: "", price_id: "", quantity: 1, pricing_mode: "standard", override_amount: "" }]);
  };

  const updateItem = (id, key, value) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [key]: value } : it));
  };

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const getPrice = (priceId) => productsRaw?.find(p => p.stripe_price_id === priceId);

  const totalAmount = items.reduce((sum, it) => {
    const price = getPrice(it.price_id);
    if (!price) return sum;
    const unitAmount = it.pricing_mode === "override" && it.override_amount ? parseFloat(it.override_amount) * 100 : price.unit_amount;
    return sum + unitAmount * it.quantity;
  }, 0);

  const handleSaveDraft = async () => {
    if (!selectedCustomer) return;
    if (items.length === 0) { setStatusMsg({ type: "error", text: "Aggiungi almeno un item" }); return; }
    const invalidItems = items.filter(it => !it.product_id || !it.price_id);
    if (invalidItems.length > 0) { setStatusMsg({ type: "error", text: "Completa tutti gli items: prodotto e prezzo obbligatori" }); return; }

    setSaving(true); setStatusMsg(null);
    try {
      // Create draft
      const [draft] = await sbPost("subscription_drafts", {
        stripe_customer_id: selectedCustomer.stripe_customer_id,
        status: "draft",
        collection_method: draftSettings.collection_method,
        days_until_due: draftSettings.days_until_due,
        billing_interval: draftSettings.billing_interval,
        start_date: draftSettings.start_date || null,
        tax_rate_id: draftSettings.tax_rate_id || null,
        notes: draftSettings.notes || null,
      });
      // Create draft items
      for (const it of items) {
        const price = getPrice(it.price_id);
        const unitAmount = it.pricing_mode === "override" && it.override_amount ? Math.round(parseFloat(it.override_amount) * 100) : price?.unit_amount;
        await sbPost("subscription_draft_items", {
          draft_id: draft.id,
          esercizio_id: it.esercizio_id || null,
          product_id: it.product_id,
          price_id: it.price_id,
          quantity: it.quantity,
          unit_amount: unitAmount,
          total_amount: unitAmount * it.quantity,
          pricing_mode: it.pricing_mode,
          override_amount: it.pricing_mode === "override" && it.override_amount ? Math.round(parseFloat(it.override_amount) * 100) : null,
        });
      }
      setStatusMsg({ type: "success", text: `Draft #${draft.id} creato. Vai alla pagina Drafts per approvarlo.` });
      // Reset
      setItems([]); setStep(1); setSelectedCustomer(null);
    } catch (err) { setStatusMsg({ type: "error", text: err.message }); }
    finally { setSaving(false); }
  };

  return (<div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-gray-900">Crea Subscription</h1><p className="text-sm text-gray-500 mt-0.5">Prepara una draft da approvare</p></div>
    <StatusMessage msg={statusMsg} onClear={() => setStatusMsg(null)} />

    {/* STEP INDICATOR */}
    <div className="flex items-center gap-3">
      {[{ n: 1, label: "Cliente" }, { n: 2, label: "Prodotti & Esercizi" }, { n: 3, label: "Riepilogo" }].map(({ n, label }) => (
        <button key={n} onClick={() => { if (n <= step || (n === 2 && selectedCustomer) || (n === 3 && items.length > 0)) setStep(n); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${step === n ? "bg-indigo-600 text-white" : step > n ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === n ? "bg-white text-indigo-600" : step > n ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>{step > n ? "✓" : n}</span> {label}
        </button>
      ))}
    </div>

    {/* STEP 1: SELECT CUSTOMER */}
    {step === 1 && (<div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h3 className="text-sm font-bold text-gray-700 mb-4">Seleziona Cliente</h3>
      <SearchBar value={customerSearch} onChange={setCustomerSearch} placeholder="Cerca per ragione sociale, email o customer ID..." />
      {selectedCustomer && (<div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
        <div><p className="font-bold text-indigo-900">{selectedCustomer.ragione_sociale}</p><p className="text-xs text-indigo-600 font-mono">{selectedCustomer.stripe_customer_id}</p></div>
        <div className="flex gap-2"><button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 hover:text-red-700">Cambia</button><button onClick={() => setStep(2)} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">Avanti →</button></div>
      </div>)}
      {!selectedCustomer && customerSearch && (<div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 rounded-xl">
        {filteredCustomers.map(c => (<button key={c.stripe_customer_id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }} className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 border-b border-gray-50 last:border-0">
          <p className="font-medium text-gray-900">{c.ragione_sociale || "—"}</p>
          <p className="text-xs text-gray-400">{c.email || ""} — <span className="font-mono">{c.stripe_customer_id}</span></p>
        </button>))}
        {filteredCustomers.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Nessun risultato</p>}
      </div>)}
    </div>)}

    {/* STEP 2: ADD ITEMS */}
    {step === 2 && (<div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="text-sm font-bold text-gray-700">Items</h3><p className="text-xs text-gray-400">Per {selectedCustomer?.ragione_sociale} — {customerEsercizi.length} esercizi collegati</p></div>
          <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"><Plus size={14} /> Aggiungi Item</button>
        </div>
        {items.length === 0 ? (<EmptyState icon={Package} text="Nessun item. Clicca 'Aggiungi Item' per iniziare." />) : (
          <div className="space-y-3">{items.map((it, idx) => (
            <div key={it.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500">Item #{idx + 1}</span>
                <button onClick={() => removeItem(it.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="Esercizio">
                  <select value={it.esercizio_id} onChange={e => updateItem(it.id, "esercizio_id", e.target.value)} className={selectCls + " text-xs"}>
                    <option value="">— Nessuno —</option>
                    {customerEsercizi.map(e => <option key={e.esercizio_id} value={e.esercizio_id}>{e.nome_esercizio} ({e.esercizio_id})</option>)}
                  </select>
                </FormField>
                <FormField label="Prodotto *">
                  <select value={it.product_id} onChange={e => { updateItem(it.id, "product_id", e.target.value); updateItem(it.id, "price_id", ""); }} className={selectCls + " text-xs"}>
                    <option value="">Seleziona...</option>
                    {products.map(p => <option key={p.stripe_product_id} value={p.stripe_product_id}>{shortName(p.product_name)}</option>)}
                  </select>
                </FormField>
                <FormField label="Prezzo *">
                  <select value={it.price_id} onChange={e => updateItem(it.id, "price_id", e.target.value)} className={selectCls + " text-xs"}>
                    <option value="">Seleziona...</option>
                    {it.product_id && products.find(p => p.stripe_product_id === it.product_id)?.prices.map(pr => (
                      <option key={pr.stripe_price_id} value={pr.stripe_price_id}>{eur(pr.unit_amount / 100)} / {pr.recurring_interval || "one-time"}{pr.price_active ? "" : " (inattivo)"}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Quantità">
                  <input type="number" min="1" value={it.quantity} onChange={e => updateItem(it.id, "quantity", parseInt(e.target.value) || 1)} className={inputCls + " text-xs"} />
                </FormField>
                <FormField label="Pricing">
                  <select value={it.pricing_mode} onChange={e => updateItem(it.id, "pricing_mode", e.target.value)} className={selectCls + " text-xs"}>
                    <option value="standard">Prezzo Standard</option>
                    <option value="override">Override Prezzo</option>
                  </select>
                </FormField>
                {it.pricing_mode === "override" && (
                  <FormField label="Override (€ per unità)" hint="Prezzo in euro, es: 170.00">
                    <input type="number" step="0.01" value={it.override_amount} onChange={e => updateItem(it.id, "override_amount", e.target.value)} className={inputCls + " text-xs"} placeholder="es: 170.00" />
                  </FormField>
                )}
                <div className="flex items-end">
                  <p className="text-xs text-gray-500 pb-2">Subtotale: <span className="font-bold text-gray-900">{(() => {
                    const price = getPrice(it.price_id);
                    if (!price) return "—";
                    const unit = it.pricing_mode === "override" && it.override_amount ? parseFloat(it.override_amount) * 100 : price.unit_amount;
                    return eur(unit * it.quantity / 100);
                  })()}</span></p>
                </div>
              </div>
            </div>
          ))}</div>
        )}
      </div>
      {/* Settings */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Impostazioni</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label="Metodo"><select value={draftSettings.collection_method} onChange={e => setDraftSettings(prev => ({ ...prev, collection_method: e.target.value }))} className={selectCls}><option value="send_invoice">Invia Fattura</option><option value="charge_automatically">Addebito Auto</option></select></FormField>
          <FormField label="GG Scadenza"><input type="number" min="0" value={draftSettings.days_until_due} onChange={e => setDraftSettings(prev => ({ ...prev, days_until_due: parseInt(e.target.value) || 30 }))} className={inputCls} /></FormField>
          <FormField label="Billing"><select value={draftSettings.billing_interval} onChange={e => setDraftSettings(prev => ({ ...prev, billing_interval: e.target.value }))} className={selectCls}><option value="year">Annuale</option><option value="month">Mensile</option></select></FormField>
          <FormField label="Data Inizio"><input type="date" value={draftSettings.start_date} onChange={e => setDraftSettings(prev => ({ ...prev, start_date: e.target.value }))} className={inputCls} /></FormField>
        </div>
        <FormField label="Note"><input type="text" value={draftSettings.notes} onChange={e => setDraftSettings(prev => ({ ...prev, notes: e.target.value }))} className={inputCls + " mt-3"} placeholder="Note opzionali..." /></FormField>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">← Indietro</button>
        <div className="text-right"><p className="text-xs text-gray-500">Totale: <span className="text-lg font-bold text-gray-900">{eur(totalAmount / 100)}</span> / {draftSettings.billing_interval}</p>
          <button onClick={() => setStep(3)} disabled={items.length === 0} className="mt-1 px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-30">Riepilogo →</button>
        </div>
      </div>
    </div>)}

    {/* STEP 3: REVIEW & SAVE */}
    {step === 3 && (<div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Riepilogo Draft</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-100">
          <div><span className="text-gray-500 block text-xs">Cliente</span><span className="font-bold">{selectedCustomer?.ragione_sociale}</span></div>
          <div><span className="text-gray-500 block text-xs">Items</span><span className="font-bold">{items.length}</span></div>
          <div><span className="text-gray-500 block text-xs">Billing</span><span className="font-bold">{draftSettings.billing_interval}</span></div>
          <div><span className="text-gray-500 block text-xs">Totale</span><span className="font-bold text-lg">{eur(totalAmount / 100)}</span></div>
        </div>
        <table className="w-full text-xs"><thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left py-2 px-3">Esercizio</th><th className="text-left py-2 px-3">Prodotto</th><th className="text-right py-2 px-3">Prezzo Unit</th><th className="text-right py-2 px-3">Qtà</th><th className="text-right py-2 px-3">Subtot</th><th className="text-left py-2 px-3">Pricing</th></tr></thead>
        <tbody>{items.map((it, i) => {
          const price = getPrice(it.price_id);
          const unitAmt = it.pricing_mode === "override" && it.override_amount ? parseFloat(it.override_amount) * 100 : price?.unit_amount || 0;
          const esercizio = allEsercizi?.find(e => e.esercizio_id === it.esercizio_id);
          return (<tr key={i} className="border-b border-gray-50"><td className="py-2 px-3">{esercizio?.nome_esercizio || it.esercizio_id || "—"}</td><td className="py-2 px-3">{shortName(products.find(p => p.stripe_product_id === it.product_id)?.product_name)}</td><td className="py-2 px-3 text-right">{eur(unitAmt / 100)}</td><td className="py-2 px-3 text-right">{it.quantity}</td><td className="py-2 px-3 text-right font-bold">{eur(unitAmt * it.quantity / 100)}</td><td className="py-2 px-3">{it.pricing_mode === "override" ? <Badge color="amber">Override</Badge> : <Badge color="green">Standard</Badge>}</td></tr>);
        })}</tbody></table>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">← Modifica</button>
        <button onClick={handleSaveDraft} disabled={saving} className="px-8 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-lg">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva come Draft</button>
      </div>
    </div>)}
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// DRAFTS PAGE (existing, enhanced)
// ═══════════════════════════════════════════════════════════════
function DraftsPage() {
  const { data: drafts, loading, reload } = useData("v_subscription_drafts_full", "order=created_at.desc");
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedDraft, setExpandedDraft] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleDelete = async (draftId) => { setActionLoading(`delete-${draftId}`); setConfirmAction(null); setStatusMsg(null); try { await sbDelete("subscription_draft_items", `draft_id=eq.${draftId}`); await sbDelete("subscription_drafts", `id=eq.${draftId}`); setStatusMsg({ type: "success", text: "Draft eliminato" }); reload(); } catch (err) { setStatusMsg({ type: "error", text: "Errore: " + err.message }); } finally { setActionLoading(null); } };

  const buildPayload = async (draft, mode) => {
    const items = await sb("subscription_draft_items", `draft_id=eq.${draft.id}`);
    const agg = {};
    for (const item of items) { const key = item.price_id + "|" + (item.pricing_mode || "standard") + "|" + (item.override_amount || ""); if (!agg[key]) agg[key] = { ...item, quantity: 0 }; agg[key].quantity += item.quantity; }
    return {
      mode, stripe_customer_id: draft.stripe_customer_id, collection_method: draft.collection_method || "send_invoice",
      days_until_due: draft.days_until_due || 30, billing_interval: draft.billing_interval || "year",
      ...(mode === "stripe" ? { start_date: draft.start_date } : {}), tax_rate_id: draft.tax_rate_id,
      items: Object.values(agg).map(li => ({ product_id: li.product_id, price_id: li.price_id, quantity: li.quantity, pricing_mode: li.pricing_mode, unit_amount: li.unit_amount, override_unit_amount: li.override_amount, coupon_id: null })),
      esercizio_detail: items.map(li => ({ esercizio_id: li.esercizio_id, product_id: li.product_id, price_id: li.price_id, quantity: li.quantity, pricing_mode: li.pricing_mode, unit_amount: li.unit_amount, override_unit_amount: li.override_amount, coupon_id: null })),
    };
  };

  const handlePreview = async (draft) => { setActionLoading(`preview-${draft.id}`); setPreviewResult(null); setStatusMsg(null); try { const payload = await buildPayload(draft, "preview"); const resp = await fetch(N8N_BASE + "/sb-wf11-create-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await resp.json(); setPreviewResult({ draftId: draft.id, data }); setExpandedDraft(draft.id); } catch (err) { setStatusMsg({ type: "error", text: "Errore preview: " + err.message }); } finally { setActionLoading(null); } };

  const handleApprove = async (draft) => { setActionLoading(`approve-${draft.id}`); setConfirmAction(null); setStatusMsg(null); try { const payload = await buildPayload(draft, "stripe"); const resp = await fetch(N8N_BASE + "/sb-wf11-create-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await resp.json(); if (data.success !== false) { await sbPatch("subscription_drafts", `id=eq.${draft.id}`, { status: "approved" }); setStatusMsg({ type: "success", text: `Subscription creata: ${data.subscription_id || "OK"}` }); reload(); } else { setStatusMsg({ type: "error", text: "Errore Stripe: " + (data.message || JSON.stringify(data)) }); } } catch (err) { setStatusMsg({ type: "error", text: "Errore: " + err.message }); } finally { setActionLoading(null); } };

  if (loading) return <Spinner />;
  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Draft Subscriptions</h1><p className="text-sm text-gray-500 mt-0.5">Bozze in attesa di approvazione</p></div><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    <StatusMessage msg={statusMsg} onClear={() => setStatusMsg(null)} />
    {confirmAction && (<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl"><p className="text-sm font-medium text-amber-900 mb-3">{confirmAction.type === "delete" ? "Eliminare questa draft?" : `Creare subscription in Stripe per ${confirmAction.draft?.ragione_sociale || ""}?`}</p><div className="flex gap-2"><button onClick={() => confirmAction.type === "delete" ? handleDelete(confirmAction.draftId) : handleApprove(confirmAction.draft)} className={`px-4 py-2 text-xs font-bold text-white rounded-lg ${confirmAction.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{confirmAction.type === "delete" ? "Elimina" : "Crea in Stripe"}</button><button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button></div></div>)}
    {drafts && drafts.length > 0 ? (<div className="space-y-3">{drafts.map((d) => (<div key={d.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3"><div><h4 className="font-bold text-gray-900">{d.ragione_sociale || "—"}</h4><span className="text-xs text-gray-400 font-mono">{d.stripe_customer_id}</span></div><span className={`px-3 py-1 rounded-full text-xs font-bold ${d.status === "draft" ? "bg-amber-100 text-amber-800" : d.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>{d.status === "draft" ? "DA APPROVARE" : d.status === "approved" ? "APPROVATA" : d.status?.toUpperCase()}</span></div>
      <div className="grid grid-cols-4 gap-4 text-sm"><div><span className="text-gray-500">Items:</span> <span className="font-bold">{d.items_count}</span></div><div><span className="text-gray-500">Totale:</span> <span className="font-bold">{eur((d.total_amount_cents || 0) / 100)}</span></div><div><span className="text-gray-500">Billing:</span> {d.billing_interval || "year"}</div><div><span className="text-gray-500">Creata:</span> {fmtDate(d.created_at)}</div></div>
      {d.status === "draft" && (<div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
        <button onClick={() => setConfirmAction({ type: "approve", draftId: d.id, draft: d })} disabled={!!actionLoading} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50">{actionLoading === `approve-${d.id}` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approva</button>
        <button onClick={() => handlePreview(d)} disabled={!!actionLoading} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 flex items-center gap-1.5 disabled:opacity-50">{actionLoading === `preview-${d.id}` ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview</button>
        <button onClick={() => setConfirmAction({ type: "delete", draftId: d.id })} disabled={!!actionLoading} className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 flex items-center gap-1.5 ml-auto disabled:opacity-50">{actionLoading === `delete-${d.id}` ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Elimina</button>
      </div>)}
      {previewResult?.draftId === d.id && expandedDraft === d.id && (<div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm"><h5 className="font-bold text-blue-800 mb-2">Anteprima</h5>{previewResult.data?.preview ? (<div className="space-y-2">{previewResult.data.preview.lines?.map((line, i) => (<div key={i} className="flex justify-between"><span className="text-gray-700">{line.description} {line.quantity ? `(×${line.quantity})` : ""}</span><span className="font-bold">{eur(line.amount)}</span></div>))}<div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-bold text-blue-900"><span>Sub: {eur(previewResult.data.preview.subtotal)}</span><span>IVA: {eur(previewResult.data.preview.tax)}</span><span>Tot: {eur(previewResult.data.preview.total)}</span></div></div>) : <p className="text-red-600">{previewResult.data?.message || JSON.stringify(previewResult.data)}</p>}</div>)}
    </div>))}</div>) : <EmptyState icon={FileCheck} text="Nessuna draft" />}
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// IMPORT ESERCIZI PAGE
// ═══════════════════════════════════════════════════════════════
function ImportEserciziPage() {
  const [mode, setMode] = useState("standalone"); // standalone, customer, customer_sub
  const [csvData, setCsvData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [results, setResults] = useState(null);

  const downloadTemplate = () => {
    const sep = ";";
    const bom = "\uFEFF";
    let headers, example;
    if (mode === "standalone") {
      headers = ["esercizio_id", "nome_esercizio", "tipologia", "citta", "provincia", "cap", "indirizzo", "telefono", "email", "consulente", "gruppo", "status"];
      example = ["12345678", "Ristorante Da Mario", "ristorante", "Milano", "MI", "20100", "Via Roma 1", "+39 02 1234567", "info@mario.it", "", "", "bozza_nuovo"];
    } else if (mode === "customer") {
      headers = ["esercizio_id", "nome_esercizio", "customer_id", "tipologia", "citta", "provincia", "cap", "indirizzo", "telefono", "email", "consulente", "gruppo", "status"];
      example = ["12345678", "Ristorante Da Mario", "cus_XXXXX", "ristorante", "Milano", "MI", "20100", "Via Roma 1", "+39 02 1234567", "info@mario.it", "", "", "bozza_solo_cliente"];
    } else {
      headers = ["esercizio_id", "nome_esercizio", "customer_id", "stripe_subscription_id", "tipologia", "citta", "provincia", "cap", "indirizzo", "telefono", "email", "consulente", "gruppo", "status"];
      example = ["12345678", "Ristorante Da Mario", "cus_XXXXX", "sub_YYYYY", "ristorante", "Milano", "MI", "20100", "Via Roma 1", "+39 02 1234567", "info@mario.it", "", "", "attivo_regolare"];
    }
    const csv = bom + headers.join(sep) + "\n" + example.join(sep) + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `template_esercizi_${mode}.csv`;
    link.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { setStatusMsg({ type: "error", text: "File vuoto o senza dati" }); return; }
      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^\uFEFF/, "").replace(/"/g, ""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(sep).map(v => v.trim().replace(/"/g, ""));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      }).filter(r => r.esercizio_id);
      setCsvData({ headers, rows });
      setStatusMsg({ type: "success", text: `${rows.length} righe caricate` });
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (!csvData?.rows?.length) return;
    setImporting(true); setStatusMsg(null); setResults(null);
    let ok = 0, errors = [];
    for (const row of csvData.rows) {
      try {
        const payload = { esercizio_id: row.esercizio_id, nome_esercizio: row.nome_esercizio || row.esercizio_id };
        if (row.customer_id) payload.customer_id = row.customer_id;
        if (row.stripe_subscription_id) payload.stripe_subscription_id = row.stripe_subscription_id;
        ["tipologia", "citta", "provincia", "cap", "indirizzo", "telefono", "email", "consulente", "gruppo", "status"].forEach(k => { if (row[k]) payload[k] = row[k]; });
        if (!payload.status) payload.status = mode === "standalone" ? "bozza_nuovo" : mode === "customer" ? "bozza_solo_cliente" : "attivo_regolare";
        await sbPost("esercizi", payload);
        ok++;
      } catch (err) { errors.push({ id: row.esercizio_id, error: err.message }); }
    }
    setResults({ ok, errors });
    setImporting(false);
    if (errors.length === 0) setStatusMsg({ type: "success", text: `${ok} esercizi importati` });
    else setStatusMsg({ type: "error", text: `${ok} importati, ${errors.length} errori` });
  };

  return (<div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-gray-900">Import Esercizi</h1><p className="text-sm text-gray-500 mt-0.5">Importa esercizi da file CSV</p></div>
    <StatusMessage msg={statusMsg} onClear={() => setStatusMsg(null)} />

    {/* MODE SELECTOR */}
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h3 className="text-sm font-bold text-gray-700 mb-4">Modalità Import</h3>
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: "standalone", icon: Store, title: "Solo Esercizi", desc: "Nessun collegamento a Customer o Subscription" },
          { id: "customer", icon: Link, title: "Esercizi + Customer", desc: "Collegati a un Customer ID esistente" },
          { id: "customer_sub", icon: CreditCard, title: "Esercizi + Customer + Sub", desc: "Import storico con mapping completo" },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`p-4 rounded-xl border-2 text-left transition-all ${mode === m.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
            <m.icon size={20} className={mode === m.id ? "text-indigo-600" : "text-gray-400"} />
            <p className={`font-bold text-sm mt-2 ${mode === m.id ? "text-indigo-900" : "text-gray-700"}`}>{m.title}</p>
            <p className="text-[10px] text-gray-500 mt-1">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>

    {/* TEMPLATE & UPLOAD */}
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700">1. Scarica Template</h3>
        <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"><Download size={14} /> Template CSV ({mode})</button>
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">2. Carica File Compilato</h3>
        <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
      </div>
    </div>

    {/* PREVIEW */}
    {csvData && (<div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700">3. Anteprima ({csvData.rows.length} righe)</h3>
        <button onClick={handleImport} disabled={importing} className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">{importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importa</button>
      </div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs"><thead><tr className="border-b border-gray-200 bg-gray-50">{csvData.headers.map(h => <th key={h} className="text-left py-2 px-2 font-semibold text-gray-600">{h}</th>)}</tr></thead>
        <tbody>{csvData.rows.slice(0, 20).map((r, i) => (<tr key={i} className="border-b border-gray-50">{csvData.headers.map(h => <td key={h} className="py-1.5 px-2 text-gray-700">{r[h] || "—"}</td>)}</tr>))}
        {csvData.rows.length > 20 && <tr><td colSpan={csvData.headers.length} className="py-2 px-2 text-gray-400 text-center">...e altre {csvData.rows.length - 20} righe</td></tr>}
        </tbody></table>
      </div>
    </div>)}

    {/* RESULTS */}
    {results && (<div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Risultati Import</h3>
      <p className="text-sm"><span className="text-emerald-700 font-bold">{results.ok} importati</span>{results.errors.length > 0 && <span className="text-red-600 font-bold ml-3">{results.errors.length} errori</span>}</p>
      {results.errors.length > 0 && (<div className="mt-3 max-h-40 overflow-y-auto"><table className="w-full text-xs"><thead><tr className="border-b border-gray-200 bg-red-50"><th className="text-left py-1.5 px-2">Esercizio ID</th><th className="text-left py-1.5 px-2">Errore</th></tr></thead>
        <tbody>{results.errors.map((e, i) => <tr key={i} className="border-b border-gray-50"><td className="py-1.5 px-2 font-mono">{e.id}</td><td className="py-1.5 px-2 text-red-600">{e.error}</td></tr>)}</tbody></table></div>)}
    </div>)}
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS PAGE
// ═══════════════════════════════════════════════════════════════
function ProductsPage() {
  const { data, loading, reload } = useData("v_products_with_prices", "order=product_name.asc");
  if (loading) return <Spinner />;
  const csvColumns = [
    { label: "Prodotto", accessor: r => r.product_name }, { label: "Product ID", accessor: r => r.stripe_product_id },
    { label: "Price ID", accessor: r => r.stripe_price_id }, { label: "Importo €", accessor: r => (r.unit_amount || 0) / 100 },
    { label: "Intervallo", accessor: r => r.recurring_interval }, { label: "Attivo", accessor: r => r.price_active ? "Sì" : "No" },
  ];
  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Prodotti e Prezzi</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} prezzi</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={data || []} allColumns={csvColumns} filename="prodotti_prezzi" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Prodotto</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Price ID</th><th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Importo</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Intervallo</th><th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Attivo</th>
    </tr></thead><tbody>{(data || []).map((p, i) => (<tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-3 px-4 font-medium text-gray-900">{p.product_name}</td><td className="py-3 px-4 font-mono text-xs text-gray-500">{p.stripe_price_id}</td><td className="py-3 px-4 text-right font-bold">{eur((p.unit_amount || 0) / 100)}</td><td className="py-3 px-4">{p.recurring_interval || "—"}</td><td className="py-3 px-4 text-center">{p.price_active ? <CheckCircle size={14} className="text-emerald-500 inline" /> : <XCircle size={14} className="text-gray-300 inline" />}</td>
    </tr>))}</tbody></table></div></div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// NAV & APP SHELL
// ═══════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { id: "cfo", label: "Dashboard", icon: LayoutDashboard },
  { id: "esercizi", label: "Esercizi", icon: Store },
  { id: "clienti", label: "Clienti", icon: Users },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "invoices", label: "Fatture", icon: Receipt },
  { id: "create-sub", label: "Crea Subscription", icon: Plus },
  { id: "drafts", label: "Drafts", icon: FileCheck },
  { id: "import", label: "Import Esercizi", icon: Upload },
  { id: "products", label: "Prodotti", icon: Package },
];

export default function App() {
  const [page, setPage] = useState("cfo");
  const renderPage = () => {
    switch (page) {
      case "cfo": return <CfoDashboard />;
      case "esercizi": return <EserciziPage />;
      case "clienti": return <ClientiPage />;
      case "subscriptions": return <SubscriptionsPage />;
      case "invoices": return <InvoicesPage />;
      case "create-sub": return <CreateSubscriptionPage />;
      case "drafts": return <DraftsPage />;
      case "import": return <ImportEserciziPage />;
      case "products": return <ProductsPage />;
      default: return <CfoDashboard />;
    }
  };
  return (<div className="flex h-screen bg-gray-50">
    <div className="w-56 bg-white border-r border-gray-100 flex flex-col">
      <div className="p-5 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Biorsaf</h2><p className="text-xs text-gray-400 mt-0.5">Stripe Finance Hub</p></div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = page === item.id;
          const Icon = item.icon;
          const isSeparator = item.id === "create-sub";
          return (<div key={item.id}>{isSeparator && <div className="my-2 border-t border-gray-100" />}
            <button onClick={() => setPage(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}><Icon size={18} /><span>{item.label}</span></button>
          </div>);
        })}
      </nav>
      <div className="p-3 border-t border-gray-100"><p className="text-[10px] text-gray-400 text-center">Stripe Operations Hub v3.0</p></div>
    </div>
    <main className="flex-1 overflow-y-auto p-6">{renderPage()}</main>
  </div>);
}
