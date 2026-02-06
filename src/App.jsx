import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Building2, Users, CreditCard, FileText, AlertTriangle, TrendingUp, ChevronRight, Search, Plus, Eye, Send, Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, LayoutDashboard, Store, Receipt, FileCheck, RefreshCw, X, Loader2, ExternalLink, Download, DollarSign, Package, ChevronLeft, ChevronsLeft, ChevronsRight, FileDown, Columns } from "lucide-react";

// CONFIG
const SUPABASE_URL = "https://pjbdgzkcvbajfcrlrzbs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYmRnemtjdmJhamZjcmxyemJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYyODMsImV4cCI6MjA4NTY1MjI4M30.6YGpHPOWHiaTqlO5ZsqjcAYp9Eddxmo3i1KrmcflqMw";
const N8N_BASE = "https://francescomeli.app.n8n.cloud/webhook";
const PAGE_SIZE = 50;

// SUPABASE HELPERS
const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const sb = async (table, params = "") => {
  const sep = params ? "?" + params : "";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${sep}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase error: ${r.status}`);
  return r.json();
};
const sbPost = async (table, data) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`Supabase POST error: ${r.status}`);
  return r.json();
};
const sbPatch = async (table, filter, data) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`Supabase PATCH error: ${r.status}`);
  return r.json();
};
const sbDelete = async (table, filter) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE", headers: sbHeaders,
  });
  if (!r.ok) throw new Error(`Supabase DELETE error: ${r.status}`);
};

// FORMATTERS
const eur = (v) => v == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);
const eurShort = (v) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return `€${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `€${(v / 1e3).toFixed(1)}K`;
  return eur(v);
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("it-IT") : "—";

const STATUS_MAP = {
  attivo_regolare: { label: "Attivo", color: "bg-emerald-100 text-emerald-800" },
  attivo_in_attesa: { label: "In Attesa", color: "bg-amber-100 text-amber-800" },
  sospeso_insoluto: { label: "Sospeso", color: "bg-red-100 text-red-800" },
  cessato: { label: "Cessato", color: "bg-gray-100 text-gray-600" },
  in_onboarding: { label: "Onboarding", color: "bg-blue-100 text-blue-800" },
  prova: { label: "Prova", color: "bg-purple-100 text-purple-800" },
  bozza_solo_cliente: { label: "Bozza", color: "bg-slate-100 text-slate-600" },
};
const SUB_STATUS_MAP = {
  active: { label: "Active", color: "bg-emerald-100 text-emerald-800" },
  past_due: { label: "Past Due", color: "bg-red-100 text-red-800" },
  canceled: { label: "Canceled", color: "bg-gray-200 text-gray-500" },
  trialing: { label: "Trial", color: "bg-blue-100 text-blue-800" },
  incomplete: { label: "Incomplete", color: "bg-amber-100 text-amber-800" },
  unpaid: { label: "Unpaid", color: "bg-red-200 text-red-900" },
};

// CSV EXPORT
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

// SHARED COMPONENTS
const Spinner = () => (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>);
const EmptyState = ({ icon: Icon, text }) => (<div className="flex flex-col items-center justify-center py-12 text-gray-400"><Icon size={40} className="mb-3 opacity-40" /><p className="text-sm font-medium">{text}</p></div>);
const Badge = ({ children, color = "gray" }) => {
  const colors = { green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", gray: "bg-gray-100 text-gray-600", purple: "bg-purple-100 text-purple-800", slate: "bg-gray-200 text-gray-500" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[color] || colors.gray}`}>{children}</span>;
};
const SearchBar = ({ value, onChange, placeholder = "Cerca..." }) => (<div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" /></div>);
const FilterChip = ({ label, active, onClick, count }) => (<button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${active ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{label}{count != null ? ` (${count})` : ""}</button>);

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <div className={`relative bg-white rounded-2xl shadow-2xl ${wide ? "max-w-5xl" : "max-w-2xl"} w-full max-h-[90vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
    </div>
  </div>);
};

const Pagination = ({ page, totalPages, total, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (<div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
    <span className="text-xs text-gray-500">{total} risultati — Pagina {page + 1} di {totalPages}</span>
    <div className="flex items-center gap-1">
      <button onClick={() => onPageChange(0)} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronsLeft size={16} /></button>
      <button onClick={() => onPageChange(page - 1)} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
      <span className="px-3 py-1 text-sm font-medium text-gray-700">{page + 1}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
      <button onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronsRight size={16} /></button>
    </div>
  </div>);
};

function ExportButton({ rows, allColumns, filename }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => allColumns.map((_, i) => i));
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const toggle = (i) => setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort());
  const doExport = () => { exportCSV(rows, selected.map(i => allColumns[i]), filename); setOpen(false); };
  return (<div className="relative" ref={ref}>
    <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"><FileDown size={14} /> CSV</button>
    {open && (<div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 w-64 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700 flex items-center gap-1"><Columns size={12} /> Colonne</span>
        <button onClick={() => setSelected(selected.length === allColumns.length ? [] : allColumns.map((_, i) => i))} className="text-[10px] text-indigo-600 font-bold hover:underline">{selected.length === allColumns.length ? "Deseleziona" : "Seleziona"} tutto</button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">{allColumns.map((col, i) => (<label key={i} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs text-gray-700"><input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} className="rounded" />{col.label}</label>))}</div>
      <button onClick={doExport} disabled={selected.length === 0} className="w-full mt-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-1.5"><Download size={12} /> Esporta {rows.length} righe</button>
    </div>)}
  </div>);
}

// DATA HOOKS
function useData(table, params = "", deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await sb(table, params); setData(d); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [table, params]);
  useEffect(() => { load(); }, [load, ...deps]);
  return { data, loading, error, reload: load };
}

// KPI CARD
const KpiCard = ({ icon: Icon, title, value, subtitle, accent = "blue", onClick }) => {
  const accents = { blue: "from-blue-50 to-indigo-50 border-blue-100", green: "from-emerald-50 to-teal-50 border-emerald-100", red: "from-red-50 to-orange-50 border-red-100", amber: "from-amber-50 to-yellow-50 border-amber-100", purple: "from-purple-50 to-fuchsia-50 border-purple-100" };
  const iconAccents = { blue: "text-blue-600 bg-blue-100", green: "text-emerald-600 bg-emerald-100", red: "text-red-600 bg-red-100", amber: "text-amber-600 bg-amber-100", purple: "text-purple-600 bg-purple-100" };
  return (<div className={`bg-gradient-to-br ${accents[accent]} border rounded-2xl p-5 transition-all hover:shadow-md ${onClick ? "cursor-pointer hover:scale-[1.02]" : ""}`} onClick={onClick}>
    <div className="flex items-start justify-between mb-3"><div className={`p-2.5 rounded-xl ${iconAccents[accent]}`}><Icon size={20} /></div>{onClick && <ChevronRight size={14} className="text-gray-400" />}</div>
    <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
    <p className="text-xs text-gray-500 mt-1 font-medium">{title}</p>
    {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
  </div>);
};

// CFO DASHBOARD
const shortName = (name) => {
  if (!name) return "—";
  return name.replace(/\s*-?\s*LICENZA\s+ANNUALE\s+CON\s+RINNOVO\s+AUTOMATICO/i, "").replace(/\s*-?\s*LICENZA\s+ANNUALE/i, "").replace(/\s*APP\s*/i, " ").trim().substring(0, 22);
};

function CfoDashboard() {
  const { data: summary, loading: l1 } = useData("v_mrr_summary");
  const { data: mrrByProduct, loading: l2 } = useData("v_mrr_by_product");
  const { data: esercizi, loading: l3 } = useData("v_esercizi_full", "select=esercizio_id,nome_esercizio,customer_id,status,tipologia,citta,stripe_subscription_id");
  const { data: invoices } = useData("v_invoices_with_payments", "select=stripe_invoice_id,invoice_number,status,customer_name,stripe_customer_id,total_eur,amount_remaining_eur,due_date,hosted_invoice_url&status=in.(open,paid)&order=invoice_date.desc&limit=500");
  const { data: mrrByCustomer } = useData("v_mrr_by_customer", "order=customer_mrr.desc&limit=50");
  const [drillDown, setDrillDown] = useState(null);
  if (l1 || l2 || l3) return <Spinner />;
  const s = summary?.[0] || {};
  const statusCounts = {};
  (esercizi || []).forEach((e) => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
  const statusChartData = Object.entries(statusCounts).map(([k, v]) => ({ name: STATUS_MAP[k]?.label || k, value: v, fill: k === "attivo_regolare" ? "#10b981" : k === "sospeso_insoluto" ? "#ef4444" : k === "attivo_in_attesa" ? "#f59e0b" : k === "cessato" ? "#9ca3af" : k === "bozza_solo_cliente" ? "#64748b" : "#6366f1" }));
  const openInvoices = (invoices || []).filter((i) => i.status === "open");
  const totalOverdue = openInvoices.reduce((s, i) => s + (i.amount_remaining_eur || 0), 0);
  const chartProducts = (mrrByProduct || []).slice(0, 8).map((p) => ({ ...p, short_name: shortName(p.product_name) }));

  return (<div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">CFO Dashboard</h1><p className="text-sm text-gray-500 mt-0.5">Biorsaf — Stripe Operations Hub</p></div><span className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">Live data • {new Date().toLocaleDateString("it-IT")}</span></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard icon={TrendingUp} title="MRR" value={eur(s.total_mrr)} subtitle={`${s.customers_with_active_subs || 0} clienti attivi`} accent="green" onClick={() => setDrillDown("mrr")} />
      <KpiCard icon={DollarSign} title="ARR" value={eurShort(s.total_arr)} subtitle="Proiezione annuale" accent="blue" onClick={() => setDrillDown("arr")} />
      <KpiCard icon={AlertTriangle} title="Insoluti" value={eur(totalOverdue)} subtitle={`${openInvoices.length} fatture aperte`} accent="red" onClick={() => setDrillDown("overdue")} />
      <KpiCard icon={Store} title="Esercizi Attivi" value={statusCounts.attivo_regolare || 0} subtitle={`su ${esercizi?.length || 0} totali`} accent="purple" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">MRR per Prodotto</h3>
        {chartProducts.length > 0 ? (<ResponsiveContainer width="100%" height={Math.max(200, chartProducts.length * 40)}><BarChart data={chartProducts} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" tickFormatter={eurShort} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="short_name" width={110} tick={{ fontSize: 10, fill: "#6b7280" }} interval={0} /><Tooltip formatter={(v) => [eur(v), "MRR"]} labelFormatter={(l) => { const p = chartProducts.find(x => x.short_name === l); return p?.product_name || l; }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} /><Bar dataKey="product_mrr" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22} /></BarChart></ResponsiveContainer>) : <EmptyState icon={Package} text="Nessun dato MRR" />}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Distribuzione Esercizi</h3>
        <div className="flex items-start gap-4">
          <div style={{ width: 180, height: 180, flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">{statusChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Pie><Tooltip formatter={(v) => v} contentStyle={{ fontSize: 12, borderRadius: 8 }} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-2 flex-1 pt-2">{statusChartData.map((item, i) => (<div key={i} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.fill }} /><span className="text-gray-600 text-xs">{item.name}</span></div><span className="font-bold text-gray-900 text-sm">{item.value}</span></div>))}</div>
        </div>
      </div>
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">Fatture Aperte ({openInvoices.length})</h3>
      {openInvoices.length > 0 ? (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100"><th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Cliente</th><th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Importo</th><th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Residuo</th><th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Scadenza</th><th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Link</th></tr></thead><tbody>{openInvoices.slice(0, 15).map((inv, i) => { const od = inv.due_date && new Date(inv.due_date) < new Date(); return (<tr key={i} className={`border-b border-gray-50 ${od ? "bg-red-50/50" : "hover:bg-gray-50/50"}`}><td className="py-2.5 px-3 font-medium text-gray-900">{inv.customer_name || "—"}</td><td className="py-2.5 px-3 text-right">{eur(inv.total_eur)}</td><td className="py-2.5 px-3 text-right font-semibold text-red-600">{eur(inv.amount_remaining_eur)}</td><td className={`py-2.5 px-3 ${od ? "text-red-600 font-bold" : ""}`}>{fmtDate(inv.due_date)}</td><td className="py-2.5 px-3 text-center">{inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={14} /></a>}</td></tr>); })}</tbody></table></div>) : <p className="text-sm text-gray-400 text-center py-6">Nessuna fattura aperta</p>}
    </div>

    <Modal open={drillDown === "mrr"} onClose={() => setDrillDown(null)} title="MRR per Cliente" wide>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Cliente</th><th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Email</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Subs</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">MRR</th></tr></thead><tbody>{(mrrByCustomer || []).map((c, i) => (<tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30"><td className="py-2.5 px-3 font-medium text-gray-900">{c.ragione_sociale || c.stripe_customer_id}</td><td className="py-2.5 px-3 text-gray-500 text-xs">{c.email || "—"}</td><td className="py-2.5 px-3 text-right">{c.subs_count}</td><td className="py-2.5 px-3 text-right font-bold text-emerald-700">{eur(c.customer_mrr)}</td></tr>))}</tbody></table>
    </Modal>
    <Modal open={drillDown === "arr"} onClose={() => setDrillDown(null)} title="ARR per Prodotto" wide>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Prodotto</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Subs</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">MRR</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">ARR</th></tr></thead><tbody>{(mrrByProduct || []).map((p, i) => (<tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30"><td className="py-2.5 px-3 font-medium text-gray-900 max-w-xs truncate">{p.product_name}</td><td className="py-2.5 px-3 text-right">{p.subscriptions_count}</td><td className="py-2.5 px-3 text-right">{eur(p.product_mrr)}</td><td className="py-2.5 px-3 text-right font-bold text-blue-700">{eur(p.product_mrr * 12)}</td></tr>))}</tbody></table>
    </Modal>
    <Modal open={drillDown === "overdue"} onClose={() => setDrillDown(null)} title={`Fatture Aperte (${openInvoices.length})`} wide>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">N. Fattura</th><th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Cliente</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Totale</th><th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">Residuo</th><th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Scadenza</th><th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-600">Link</th></tr></thead><tbody>{openInvoices.map((inv, i) => { const od = inv.due_date && new Date(inv.due_date) < new Date(); return (<tr key={i} className={`border-b border-gray-50 ${od ? "bg-red-50/50" : "hover:bg-gray-50/50"}`}><td className="py-2.5 px-3 font-mono text-xs text-gray-700">{inv.invoice_number || "—"}</td><td className="py-2.5 px-3 font-medium text-gray-900">{inv.customer_name || "—"}</td><td className="py-2.5 px-3 text-right">{eur(inv.total_eur)}</td><td className="py-2.5 px-3 text-right font-bold text-red-600">{eur(inv.amount_remaining_eur)}</td><td className={`py-2.5 px-3 ${od ? "text-red-600 font-bold" : ""}`}>{fmtDate(inv.due_date)}</td><td className="py-2.5 px-3 text-center">{inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={14} /></a>}</td></tr>); })}</tbody></table>
    </Modal>
  </div>);
}

// ESERCIZI PAGE
function EserciziPage() {
  const { data, loading, reload } = useData("v_esercizi_full", "order=nome_esercizio.asc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEsercizio, setSelectedEsercizio] = useState(null);
  const [esercizioInvoices, setEsercizioInvoices] = useState(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!selectedEsercizio?.stripe_subscription_id) { setEsercizioInvoices(null); return; }
    setInvoicesLoading(true);
    sb("v_invoices_with_payments", `stripe_subscription_id=eq.${selectedEsercizio.stripe_subscription_id}&order=invoice_date.desc`)
      .then(setEsercizioInvoices).catch(() => setEsercizioInvoices([])).finally(() => setInvoicesLoading(false));
  }, [selectedEsercizio]);

  useEffect(() => { setPage(0); }, [search, statusFilter]);

  if (loading) return <Spinner />;
  const filtered = (data || []).filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search) { const s = search.toLowerCase().trim(); return (e.nome_esercizio || "").toLowerCase().includes(s) || (e.citta || "").toLowerCase().includes(s) || (e.esercizio_id || "").toLowerCase().includes(s) || (e.customer_id || "").toLowerCase().includes(s) || (e.stripe_subscription_id || "").toLowerCase().includes(s); }
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const statusCounts = {};
  (data || []).forEach((e) => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });

  const csvColumns = [
    { label: "ID Esercizio", accessor: r => r.esercizio_id }, { label: "Nome", accessor: r => r.nome_esercizio },
    { label: "Tipologia", accessor: r => r.tipologia }, { label: "Città", accessor: r => r.citta },
    { label: "Provincia", accessor: r => r.provincia }, { label: "CAP", accessor: r => r.cap },
    { label: "Indirizzo", accessor: r => r.indirizzo }, { label: "Status", accessor: r => STATUS_MAP[r.status]?.label || r.status },
    { label: "Customer ID", accessor: r => r.customer_id }, { label: "Cliente", accessor: r => r.customer_name },
    { label: "Subscription ID", accessor: r => r.stripe_subscription_id }, { label: "Sub Status", accessor: r => r.sub_status },
    { label: "Importo €", accessor: r => r.sub_amount_eur }, { label: "Billing", accessor: r => r.billing_interval },
    { label: "Gruppo", accessor: r => r.gruppo }, { label: "Consulente", accessor: r => r.consulente },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Esercizi</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrati</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={filtered} allColumns={csvColumns} filename="esercizi" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <div className="flex gap-3 items-center flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per nome, ID esercizio, città, customer ID, subscription ID..." /></div>
      <div className="flex gap-2 flex-wrap">
        <FilterChip label="Tutti" count={data?.length} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {Object.entries(STATUS_MAP).map(([k, v]) => statusCounts[k] > 0 && (<FilterChip key={k} label={v.label} count={statusCounts[k]} active={statusFilter === k} onClick={() => setStatusFilter(k)} />))}
      </div>
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">ID</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Esercizio</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Cliente</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Tipologia</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Città</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Sub</th>
      </tr></thead><tbody>{pageData.map((e, i) => (<tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30 cursor-pointer" onClick={() => setSelectedEsercizio(e)}>
        <td className="py-3 px-4 font-mono text-xs text-gray-500">{e.esercizio_id}</td>
        <td className="py-3 px-4 font-medium text-gray-900">{e.nome_esercizio}</td>
        <td className="py-3 px-4 text-xs text-gray-600">{e.customer_name || "—"}</td>
        <td className="py-3 px-4 text-gray-600">{e.tipologia || "—"}</td>
        <td className="py-3 px-4 text-gray-600">{e.citta || "—"}</td>
        <td className="py-3 px-4 text-center"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_MAP[e.status]?.color || "bg-gray-100 text-gray-600"}`}>{STATUS_MAP[e.status]?.label || e.status}</span></td>
        <td className="py-3 px-4 text-center">{e.stripe_subscription_id ? (<span className={`text-xs font-bold ${e.sub_status === "active" ? "text-emerald-600" : e.sub_status === "past_due" ? "text-red-500" : "text-gray-400"}`}>{e.sub_status || "—"}</span>) : <span className="text-gray-300">—</span>}</td>
      </tr>))}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>

    {selectedEsercizio && (<Modal open={true} onClose={() => { setSelectedEsercizio(null); setEsercizioInvoices(null); }} title={`${selectedEsercizio.nome_esercizio} — ID ${selectedEsercizio.esercizio_id}`} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500 block text-xs mb-0.5">ID</span><span className="font-mono font-bold">{selectedEsercizio.esercizio_id}</span></div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Status</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_MAP[selectedEsercizio.status]?.color}`}>{STATUS_MAP[selectedEsercizio.status]?.label || selectedEsercizio.status}</span></div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Tipologia</span>{selectedEsercizio.tipologia || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Città</span>{selectedEsercizio.citta || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Indirizzo</span>{selectedEsercizio.indirizzo || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Provincia</span>{selectedEsercizio.provincia || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Cliente</span>{selectedEsercizio.customer_name || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Customer ID</span><span className="font-mono text-xs">{selectedEsercizio.customer_id}</span></div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Subscription</span><span className="font-mono text-xs">{selectedEsercizio.stripe_subscription_id || "Nessuna"}</span></div>
          {selectedEsercizio.sub_status && <div><span className="text-gray-500 block text-xs mb-0.5">Sub Status</span>{selectedEsercizio.sub_status}</div>}
          {selectedEsercizio.sub_amount_eur && <div><span className="text-gray-500 block text-xs mb-0.5">Importo</span>{eur(selectedEsercizio.sub_amount_eur)}</div>}
          {selectedEsercizio.billing_interval && <div><span className="text-gray-500 block text-xs mb-0.5">Billing</span>{selectedEsercizio.billing_interval}</div>}
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Receipt size={16} /> Fatture correlate</h4>
          {invoicesLoading ? (<div className="flex items-center gap-2 text-sm text-gray-400 py-4"><Loader2 size={16} className="animate-spin" /> Caricamento...</div>)
          : !selectedEsercizio.stripe_subscription_id ? (<p className="text-sm text-gray-400 py-3">Nessuna subscription — nessuna fattura</p>)
          : esercizioInvoices?.length > 0 ? (<div className="overflow-x-auto border border-gray-100 rounded-xl"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">N. Fattura</th><th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Status</th><th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Totale</th><th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Data</th><th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Link</th>
          </tr></thead><tbody>{esercizioInvoices.map((inv, i) => (<tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
            <td className="py-2 px-3 font-mono text-xs">{inv.invoice_number || "—"}</td>
            <td className="py-2 px-3"><Badge color={inv.status === "paid" ? "green" : inv.status === "open" ? "amber" : "gray"}>{inv.status}</Badge></td>
            <td className="py-2 px-3 text-right font-medium">{eur(inv.total_eur)}</td>
            <td className="py-2 px-3">{fmtDate(inv.invoice_date)}</td>
            <td className="py-2 px-3 text-center">{inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={14} /></a>}</td>
          </tr>))}</tbody></table></div>)
          : (<p className="text-sm text-gray-400 py-3">Nessuna fattura per questa subscription</p>)}
        </div>
      </div>
    </Modal>)}
  </div>);
}

// CLIENTI PAGE
function ClientiPage() {
  const { data, loading, reload } = useData("v_customer_full", "order=ragione_sociale.asc");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSubs, setCustomerSubs] = useState(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!selectedCustomer) { setCustomerSubs(null); return; }
    setSubsLoading(true);
    sb("v_subscriptions_full", `stripe_customer_id=eq.${selectedCustomer.stripe_customer_id}&order=status.asc,start_date.desc`)
      .then(setCustomerSubs).catch(() => setCustomerSubs([])).finally(() => setSubsLoading(false));
  }, [selectedCustomer]);

  useEffect(() => { setPage(0); }, [search]);

  if (loading) return <Spinner />;
  const filtered = (data || []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.ragione_sociale || "").toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s) || (c.partita_iva || "").toLowerCase().includes(s) || (c.stripe_customer_id || "").toLowerCase().includes(s);
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const csvColumns = [
    { label: "Customer ID", accessor: r => r.stripe_customer_id }, { label: "Ragione Sociale", accessor: r => r.ragione_sociale },
    { label: "Email", accessor: r => r.email }, { label: "P.IVA", accessor: r => r.partita_iva },
    { label: "CF", accessor: r => r.codice_fiscale }, { label: "PEC", accessor: r => r.pec },
    { label: "SDI", accessor: r => r.codice_sdi }, { label: "Telefono", accessor: r => r.phone },
    { label: "Subs Attive", accessor: r => r.active_subs_count || 0 }, { label: "Subs Tot", accessor: r => r.total_subs_count || 0 },
    { label: "MRR €", accessor: r => r.mrr_calculated }, { label: "ARR €", accessor: r => r.arr_calculated },
    { label: "Città", accessor: r => r.indirizzo_citta }, { label: "Provincia", accessor: r => r.indirizzo_provincia },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Clienti</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrati</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={filtered} allColumns={csvColumns} filename="clienti" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <SearchBar value={search} onChange={setSearch} placeholder="Cerca per ragione sociale, email, P.IVA, customer ID..." />
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Ragione Sociale</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Email</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">P.IVA</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Subs Attive</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Subs Tot</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">MRR</th>
      </tr></thead><tbody>{pageData.map((c, i) => (<tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30 cursor-pointer" onClick={() => setSelectedCustomer(c)}>
        <td className="py-3 px-4"><p className="font-medium text-gray-900">{c.ragione_sociale || "—"}</p><p className="text-xs text-gray-400 font-mono">{c.stripe_customer_id}</p></td>
        <td className="py-3 px-4 text-gray-600 text-xs">{c.email || "—"}</td>
        <td className="py-3 px-4 text-gray-600 font-mono text-xs">{c.partita_iva || "—"}</td>
        <td className="py-3 px-4 text-right"><span className={`font-bold ${(c.active_subs_count || 0) > 0 ? "text-emerald-600" : "text-gray-400"}`}>{c.active_subs_count || 0}</span></td>
        <td className="py-3 px-4 text-right text-gray-500">{c.total_subs_count || 0}</td>
        <td className="py-3 px-4 text-right font-medium">{c.mrr_calculated > 0 ? eur(c.mrr_calculated) : "—"}</td>
      </tr>))}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>

    {selectedCustomer && (<Modal open={true} onClose={() => { setSelectedCustomer(null); setCustomerSubs(null); }} title={selectedCustomer.ragione_sociale || "Dettaglio Cliente"} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500 block text-xs mb-0.5">Stripe ID</span><span className="font-mono text-xs">{selectedCustomer.stripe_customer_id}</span></div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Email</span>{selectedCustomer.email || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">P.IVA</span>{selectedCustomer.partita_iva || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">CF</span>{selectedCustomer.codice_fiscale || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">PEC</span>{selectedCustomer.pec || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">SDI</span>{selectedCustomer.codice_sdi || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Telefono</span>{selectedCustomer.phone || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">Città</span>{selectedCustomer.indirizzo_citta || "—"}</div>
          <div><span className="text-gray-500 block text-xs mb-0.5">MRR</span><span className="font-bold text-emerald-700">{selectedCustomer.mrr_calculated > 0 ? eur(selectedCustomer.mrr_calculated) : "—"}</span></div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><CreditCard size={16} /> Subscriptions ({selectedCustomer.total_subs_count || 0})</h4>
          {subsLoading ? (<div className="flex items-center gap-2 text-sm text-gray-400 py-4"><Loader2 size={16} className="animate-spin" /> Caricamento...</div>)
          : customerSubs?.length > 0 ? (<div className="space-y-2">{customerSubs.map((s, i) => {
            const isCanceled = s.status === "canceled";
            return (<div key={i} className={`p-3 rounded-xl border ${isCanceled ? "bg-gray-50 border-gray-200 opacity-60" : "bg-white border-gray-100"}`}>
              <div className="flex items-center justify-between">
                <div><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SUB_STATUS_MAP[s.status]?.color || "bg-gray-100 text-gray-600"}`}>{SUB_STATUS_MAP[s.status]?.label || s.status}</span><span className="ml-2 font-mono text-xs text-gray-400">{s.stripe_subscription_id}</span></div>
                <span className={`font-bold ${isCanceled ? "line-through text-gray-400" : ""}`}>{eur((s.calculated_amount || s.amount || 0) / 100)}/{s.billing_interval || "year"}</span>
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                <span>Items: {s.items_count || "—"}</span><span>Dal {fmtDate(s.start_date)}</span>
                {isCanceled && s.canceled_at && <span className="text-red-500">Cancellata il {fmtDate(s.canceled_at)}</span>}
              </div>
            </div>);
          })}</div>) : (<p className="text-sm text-gray-400 py-3">Nessuna subscription</p>)}
        </div>
      </div>
    </Modal>)}
  </div>);
}

// SUBSCRIPTIONS PAGE
function SubscriptionsPage() {
  const { data, loading, reload } = useData("v_subscriptions_full", "order=status.asc,start_date.desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, statusFilter]);
  if (loading) return <Spinner />;
  const filtered = (data || []).filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) { const q = search.toLowerCase(); return (s.ragione_sociale || "").toLowerCase().includes(q) || (s.stripe_subscription_id || "").toLowerCase().includes(q) || (s.stripe_customer_id || "").toLowerCase().includes(q); }
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const statusCounts = {};
  (data || []).forEach((s) => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });

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
    <div className="flex gap-3 items-center flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per cliente, subscription ID, customer ID..." /></div>
      <div className="flex gap-2">
        <FilterChip label="Tutte" count={data?.length} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {["active", "past_due", "trialing", "canceled"].map((s) => statusCounts[s] > 0 && (<FilterChip key={s} label={SUB_STATUS_MAP[s]?.label || s} count={statusCounts[s]} active={statusFilter === s} onClick={() => setStatusFilter(s)} />))}
      </div>
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Cliente</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Importo</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Billing</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500">Items</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Periodo / Info</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Metodo</th>
      </tr></thead><tbody>{pageData.map((s, i) => {
        const isCanceled = s.status === "canceled";
        return (<tr key={i} className={`border-b border-gray-50 ${isCanceled ? "bg-gray-50/80 opacity-60" : "hover:bg-indigo-50/30"}`}>
          <td className="py-3 px-4"><p className={`font-medium ${isCanceled ? "text-gray-500" : "text-gray-900"}`}>{s.ragione_sociale || "—"}</p><p className="text-xs text-gray-400 font-mono">{s.stripe_subscription_id}</p></td>
          <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${SUB_STATUS_MAP[s.status]?.color || "bg-gray-100 text-gray-600"}`}>{SUB_STATUS_MAP[s.status]?.label || s.status}</span></td>
          <td className={`py-3 px-4 text-right font-medium ${isCanceled ? "text-gray-400 line-through" : ""}`}>{eur((s.calculated_amount || s.amount || 0) / 100)}</td>
          <td className="py-3 px-4">{s.billing_interval || "—"}</td>
          <td className="py-3 px-4 text-center">{s.items_count || "—"}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{isCanceled ? (<span className="text-red-500">Cancellata {fmtDate(s.canceled_at)}</span>) : (<>{fmtDate(s.current_period_start)} — {fmtDate(s.current_period_end)}</>)}</td>
          <td className="py-3 px-4 text-xs text-gray-500">{s.collection_method === "send_invoice" ? "Fattura" : s.collection_method === "charge_automatically" ? "Auto" : s.collection_method || "—"}</td>
        </tr>);
      })}</tbody></table></div>
      <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
    </div>
  </div>);
}

// INVOICES PAGE
function InvoicesPage() {
  const { data, loading, reload } = useData("v_invoices_with_payments", "order=invoice_date.desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, statusFilter]);
  if (loading) return <Spinner />;
  const filtered = (data || []).filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (search) { const q = search.toLowerCase(); return (inv.customer_name || "").toLowerCase().includes(q) || (inv.invoice_number || "").toLowerCase().includes(q) || (inv.stripe_customer_id || "").toLowerCase().includes(q) || (inv.stripe_subscription_id || "").toLowerCase().includes(q); }
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const statusCounts = {};
  (data || []).forEach((inv) => { statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1; });

  const csvColumns = [
    { label: "N. Fattura", accessor: r => r.invoice_number }, { label: "Invoice ID", accessor: r => r.stripe_invoice_id },
    { label: "Customer ID", accessor: r => r.stripe_customer_id }, { label: "Cliente", accessor: r => r.customer_name },
    { label: "Email", accessor: r => r.customer_email }, { label: "P.IVA", accessor: r => r.partita_iva },
    { label: "Status", accessor: r => r.status }, { label: "Subtotale €", accessor: r => r.subtotal_eur },
    { label: "IVA €", accessor: r => r.tax_eur }, { label: "Totale €", accessor: r => r.total_eur },
    { label: "Pagato €", accessor: r => r.amount_paid_eur }, { label: "Residuo €", accessor: r => r.amount_remaining_eur },
    { label: "Data", accessor: r => r.invoice_date }, { label: "Scadenza", accessor: r => r.due_date },
    { label: "Pagamento", accessor: r => r.paid_at }, { label: "Subscription ID", accessor: r => r.stripe_subscription_id },
    { label: "Metodo", accessor: r => r.payment_method_type }, { label: "Billing Reason", accessor: r => r.billing_reason },
    { label: "Link", accessor: r => r.hosted_invoice_url },
  ];

  return (<div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Fatture</h1><p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} totali — {filtered.length} filtrate</p></div>
      <div className="flex items-center gap-2"><ExportButton rows={filtered} allColumns={csvColumns} filename="fatture" /><button onClick={reload} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button></div>
    </div>
    <div className="flex gap-3 items-center flex-wrap">
      <div className="flex-1 min-w-64"><SearchBar value={search} onChange={setSearch} placeholder="Cerca per cliente, numero fattura, customer ID..." /></div>
      <div className="flex gap-2">
        <FilterChip label="Tutte" count={data?.length} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {["paid", "open", "void", "draft", "uncollectible"].map((s) => statusCounts[s] > 0 && (<FilterChip key={s} label={s} count={statusCounts[s]} active={statusFilter === s} onClick={() => setStatusFilter(s)} />))}
      </div>
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
          <td className="py-3 px-4"><p className="font-medium text-gray-900">{inv.customer_name || "—"}</p><p className="text-xs text-gray-400 font-mono">{inv.stripe_customer_id}</p></td>
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

// DRAFTS PAGE
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
    {statusMsg && (<div className={`p-3 rounded-xl text-sm flex items-center justify-between ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}><span>{statusMsg.text}</span><button onClick={() => setStatusMsg(null)} className="ml-2 p-0.5 rounded hover:bg-white/50"><X size={14} /></button></div>)}
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

// PRODUCTS PAGE
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

// NAV & APP SHELL
const NAV_ITEMS = [
  { id: "cfo", label: "Dashboard", icon: LayoutDashboard },
  { id: "esercizi", label: "Esercizi", icon: Store },
  { id: "clienti", label: "Clienti", icon: Users },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "invoices", label: "Fatture", icon: Receipt },
  { id: "drafts", label: "Drafts", icon: FileCheck },
  { id: "products", label: "Prodotti", icon: Package },
];

export default function App() {
  const [page, setPage] = useState("cfo");
  const renderPage = () => { switch (page) { case "cfo": return <CfoDashboard />; case "esercizi": return <EserciziPage />; case "clienti": return <ClientiPage />; case "subscriptions": return <SubscriptionsPage />; case "invoices": return <InvoicesPage />; case "drafts": return <DraftsPage />; case "products": return <ProductsPage />; default: return <CfoDashboard />; } };
  return (<div className="flex h-screen bg-gray-50">
    <div className="w-56 bg-white border-r border-gray-100 flex flex-col">
      <div className="p-5 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Biorsaf</h2><p className="text-xs text-gray-400 mt-0.5">Stripe Hub</p></div>
      <nav className="flex-1 p-3 space-y-1">{NAV_ITEMS.map((item) => { const active = page === item.id; const Icon = item.icon; return (<button key={item.id} onClick={() => setPage(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}><Icon size={18} /><span>{item.label}</span></button>); })}</nav>
      <div className="p-3 border-t border-gray-100"><p className="text-[10px] text-gray-400 text-center">Stripe Operations Hub v2.0</p></div>
    </div>
    <main className="flex-1 overflow-y-auto p-6">{renderPage()}</main>
  </div>);
}
