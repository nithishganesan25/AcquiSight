import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from "react";
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown, Clock3, Download, FileText, Filter, Gavel, Globe2, Layers, ListChecks, MapPin, MoreHorizontal, Pencil, Plus, RefreshCw, Send, ShieldAlert, SlidersHorizontal, Sparkles, Target, Upload, Users, Zap, AlertTriangle, Scale, Building2, Landmark, ShieldCheck, Sun, Moon } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/App";
import { Button, Badge, EmptyState, IconArrow, LoadingState, RiskBadge, RiskMeter, SearchBox, SectionTitle, StatCard, Surface, Toast } from "@/components/ui";
import { PublicNav, Shell } from "@/components/shell";
import { buildCaseFromIntake, cases, getAllCases, getDraftCase, mapTnToCase, saveDraftCase, scoreCase, type AcquisitionCase, type CaseStatus, type RiskLevel } from "@/lib/data";
import {
  getDashboardSummary,
  getAlerts,
  getAnalyticsDistricts,
  createBackendCase,
  updateBackendCase,
  getTnCases,
  getAnalyticsDelayCauses,
  getAnalyticsStatusDistribution,
  getActions,
  getTnCaseById,
  getRiskExplanation,
  getMlStatus,
  triggerSafeRetrain,
  getExcelExportUrl,
  type ActionItem,
  type RiskExplanationResponse,
  type MlStatusResponse,
} from "@/lib/api";


const stagger = { hidden:{opacity:0}, show:{opacity:1, transition:{staggerChildren:.045}} };
const item = { hidden:{opacity:0,y:8}, show:{opacity:1,y:0, transition:{duration:.25}} };

function useToastState() {
  const [message, setMessage] = useState("");
  const toast = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3000);
  };
  return { message, toast, close: () => setMessage("") };
}

function AppPage({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}

function DelayBadge({ status, days }: { status: "Delayed" | "Moderate Delay" | "On time" | string; days: number }) {
  if (status === "Delayed" || days > 90) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">Delayed ({days}d)</span>;
  }
  if (status === "Moderate Delay" || days > 0) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">Moderate ({days}d)</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">On time</span>;
}

function MiniMap() {
  return (
    <div data-dark-canvas="true" className="relative h-full min-h-[250px] overflow-hidden rounded-xl border border-cyan-300/10 bg-[#0c1627]">
      <div className="grid-fade absolute inset-0 opacity-70" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(ellipse at 20% 30%, rgba(37, 177, 205, .14), transparent 25%), radial-gradient(ellipse at 75% 65%, rgba(124, 92, 237, .16), transparent 28%)" }} />
      <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 600 280" preserveAspectRatio="none">
        <path d="M0 210 C110 168 117 232 214 145 S342 170 406 92 S510 110 600 26" fill="none" stroke="#41d4e8" strokeOpacity=".45" strokeWidth="1.5" />
        <path d="M0 84 C94 126 156 44 248 102 S390 38 488 87 S543 140 600 123" fill="none" stroke="#8770ee" strokeOpacity=".35" strokeWidth="1" />
        <path d="M70 0 C120 90 94 144 154 280 M365 0 C332 72 401 140 388 280 M530 0 C470 100 550 166 501 280" fill="none" stroke="#76a1ba" strokeOpacity=".13" />
        <circle cx="214" cy="145" r="4" fill="#4dd9eb" />
        <circle cx="406" cy="92" r="4" fill="#a78bfa" />
        <circle cx="488" cy="87" r="3" fill="#f4bd68" />
      </svg>
      <div className="absolute left-4 top-4">
        <div className="eyebrow">Tamil Nadu Geographic Radar</div>
        <div className="mt-1 text-xs text-slate-300">20 Districts Monitored</div>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-md border border-slate-600/50 bg-slate-950/60 px-2.5 py-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-cyan-300" />On Schedule</span>
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose-300" />Delayed</span>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/command-center");
  }, [setLocation]);
  return null;
}

export function CommandCenterPage() {
  const { toast, message, close } = useToastState();
  const [summary, setSummary] = useState<any>(null);
  const [backendLive, setBackendLive] = useState(false);
  const [statusChartData, setStatusChartData] = useState<Array<{ status: string; count: number }>>([]);
  const [priorityCases, setPriorityCases] = useState<any[]>([]);

  useEffect(() => {
    getDashboardSummary()
      .then(data => {
        if (data && data.total_cases) {
          setSummary(data);
          setBackendLive(true);
        }
      })
      .catch(() => setBackendLive(false));
    getAnalyticsStatusDistribution()
      .then(res => { if (res && res.length > 0) setStatusChartData(res); })
      .catch(() => {});
    getTnCases({ delay_status: "Delayed", limit: 4 })
      .then(res => { if (res?.cases) setPriorityCases(res.cases); })
      .catch(() => {});
  }, []);

  const totalCases = summary?.total_cases ?? (backendLive ? 0 : "…");
  const delayedCases = summary?.delayed_cases ?? (backendLive ? 0 : "…");
  const onTimeCases = summary?.on_time_cases ?? 0;
  const litigatedCases = summary?.litigated_cases ?? 0;
  const affectedFamilies = summary?.total_families_affected ? summary.total_families_affected.toLocaleString() : "…";
  const totalArea = summary?.total_area_ha ? `${summary.total_area_ha.toLocaleString()} ha` : "…";
  const districtsCount = summary?.monitored_districts_count ?? (summary ? 20 : "…");
  
  const districtCounts = useMemo(() => {
    if (summary?.district_delay_ranking && summary.district_delay_ranking.length > 0) {
      return summary.district_delay_ranking.slice(0, 5).map((d: any) => [d.district, { total: d.total, delayed: d.delayed }]);
    }
    return [];
  }, [summary]);

  return (
    <AppPage>
      <SectionTitle
        eyebrow="Government of Tamil Nadu / Land Administration"
        title="Land Acquisition Delay Tracker – Tamil Nadu"
        detail={`Real-time monitoring across ${totalCases} land acquisition cases and ${districtsCount} districts.`}
        action={
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${backendLive ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/30" : "bg-slate-800 text-slate-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${backendLive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              {backendLive ? "FastAPI Live" : "Local Sync"}
            </span>
            <Link href="/land-intelligence" className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-300">
              <Layers size={14} /> View All Cases
            </Link>
            <Button onClick={() => {
              getDashboardSummary().then(d => { setSummary(d); toast("Dashboard synchronized with FastAPI backend"); }).catch(() => toast("Offline cache active"));
            }} variant="outline">
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
        }
      />

      {/* Main KPI Stat Cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div variants={item}>
          <StatCard label="Total Monitored Cases" value={totalCases} note={`Real Backend Data · ${districtsCount} Districts`} icon={Target} tone="cyan" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard label="Delayed Cases (>90d)" value={delayedCases} note={`${Math.round((delayedCases / totalCases) * 100)}% of portfolio delayed`} icon={ShieldAlert} tone="red" onClick={() => window.location.href = "/land-intelligence"} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard label="Cases in Litigation" value={litigatedCases} note="High Court of Madras & Tribunals" icon={Scale} tone="amber" onClick={() => window.location.href = "/risk-alerts"} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard label="Affected Families" value={affectedFamilies} note={`${totalArea} total area under acquisition`} icon={Users} tone="violet" />
        </motion.div>
      </motion.div>

      {/* Exposure Overview & Priority Signals */}
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Surface className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/60 px-5 py-4">
            <div>
              <div className="eyebrow">District Exposure</div>
              <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-200">Delay Concentration by District</h2>
            </div>
            <Link href="/land-intelligence" data-testid="link-dashboard-all-cases" className="text-xs font-bold text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200">
              Explore all cases <IconArrow />
            </Link>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_1.1fr]">
            <div className="h-[270px]">
              <MiniMap />
            </div>
            <div className="space-y-2">
              {districtCounts.map(([district, data], i) => (
                <div key={district} className="rounded-lg bg-slate-50 dark:bg-white/[.025] border border-slate-200/80 dark:border-transparent p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-300">{district}</span>
                    <span className="mono text-rose-600 dark:text-rose-300 font-bold">{data.delayed} delayed / {data.total} total</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-rose-500 dark:bg-rose-400" : i === 1 ? "bg-amber-400 dark:bg-amber-300" : "bg-cyan-500 dark:bg-cyan-300"}`}
                        style={{ width: `${Math.round((data.delayed / data.total) * 100)}%` }}
                      />
                    </div>
                    <span className="mono text-[10px] text-slate-600 dark:text-slate-400 font-medium">{Math.round((data.delayed / data.total) * 100)}% delayed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Surface>

        {/* Priority Delayed / Litigated Cases */}
        <Surface className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Priority Feed</div>
              <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-200">Critical Delays & Litigations</h2>
            </div>
            <Badge tone="red">{delayedCases} Delayed</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {priorityCases.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading priority cases from backend…</div>
            ) : (
              priorityCases.map((c: any) => {
                const cid = c.id || c.la_case_id || c.case_number;
                const safeCid = encodeURIComponent(cid);
                const delayDays = Number(c.delay_days || 0);
                const delayStatus = c.delay_status || "Delayed";
                return (
                  <Link href={`/cases/${safeCid}`} data-testid={`link-priority-case-${cid}`} key={cid} className="block rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-950/20 p-3 transition hover:border-cyan-400 hover:bg-slate-100/80 dark:hover:bg-slate-900/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block truncate">{c.project_name || cid}</span>
                        <span className="mono text-[10px] text-cyan-600 dark:text-cyan-300 font-semibold">{c.case_number || cid}</span>
                      </div>
                      <DelayBadge status={delayStatus} days={delayDays} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><MapPin size={11} />{c.district || "—"}</span>
                      <span>{c.primary_delay_reason || "—"}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          <Link href="/risk-alerts" data-testid="link-dashboard-alerts" className="mt-4 flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-300">
            Open full litigation & alert queue <ArrowRight size={13} />
          </Link>
        </Surface>
      </div>

      {/* Delay Causes & Monthly Case Flow */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
            <div>
              <div className="eyebrow">Case Distribution</div>
              <h2 className="mt-1 text-sm font-bold text-slate-200">Status Breakdown across Tamil Nadu</h2>
            </div>
            <Badge tone="green">{onTimeCases} On Schedule</Badge>
          </div>
          <div className="h-56 p-4">
            {statusChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-600">Loading status data…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData.slice(0, 8)}>
                  <CartesianGrid stroke="#243148" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 9, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111b2c", border: "1px solid #2a3d58", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#4dd9eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Surface>

        <Surface className="p-5">
          <div className="eyebrow">Portfolio Health</div>
          <h2 className="mt-1 text-sm font-bold text-slate-200">Delay Resolution Rate</h2>
          <div className="mt-6 flex items-center gap-5">
            <div className="relative h-28 w-28">
              {(() => {
                const pct = summary && summary.total_cases > 0 ? Math.round(((summary.on_time_cases + (summary.moderate_delay_cases ?? 0)) / summary.total_cases) * 100) : null;
                return (
                  <>
                    <svg viewBox="0 0 36 36" className="-rotate-90">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#1e2b41" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#4dd9eb" strokeWidth="3" strokeDasharray={`${pct ?? 0}, 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-slate-100">{pct !== null ? `${pct}%` : "—"}</span>
                  </>
                );
              })()}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300" />On Schedule / Moderate <b className="ml-3 text-slate-200">{summary ? (summary.on_time_cases + (summary.moderate_delay_cases ?? 0)) : "—"}</b></div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" />Litigated / Held <b className="ml-3 text-slate-400">{summary?.litigated_cases ?? "—"}</b></div>
              <Link href="/action-intelligence" data-testid="link-dashboard-actions" className="inline-flex items-center gap-1 pt-2 font-bold text-cyan-300">
                Open resolution queue <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </Surface>
      </div>
      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}


const PAGE_LIMIT = 50;

export function LandIntelligencePage() {
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("All Districts");
  const [delayFilter, setDelayFilter] = useState("All");
  const [sectorFilter, setSectorFilter] = useState("All Sectors");
  const [riskFilter, setRiskFilter] = useState("All Risk Categories");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);

  // Backend data state
  const [backendCases, setBackendCases] = useState<any[]>([]);
  const [backendTotal, setBackendTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available filter options derived from first load
  const [districts, setDistricts] = useState<string[]>(["All Districts"]);
  const [sectors, setSectors] = useState<string[]>(["All Sectors"]);

  // Map delay filter label → backend param
  const delayParamMap: Record<string, string | undefined> = {
    "All": undefined,
    "Delayed (>90d)": "Delayed",
    "Moderate Delay (1-90d)": "Moderate Delay",
    "On time": "On time",
  };

  const fetchCases = (pg: number, q: string, dist: string, delay: string, sector: string, risk: string) => {
    setLoading(true);
    setError(null);
    const params: Parameters<typeof getTnCases>[0] = {
      limit: PAGE_LIMIT,
      offset: pg * PAGE_LIMIT,
    };
    if (q.trim()) params.search = q.trim();
    if (dist !== "All Districts") params.district = dist;
    if (delay !== "All" && delay !== "In Litigation") params.delay_status = delayParamMap[delay];
    if (delay === "In Litigation") params.has_litigation = true;
    if (sector !== "All Sectors") params.sector = sector;
    if (risk !== "All Risk Categories") params.risk_category = risk;

    getTnCases(params)
      .then(res => {
        setBackendCases(res.cases || []);
        setBackendTotal(res.total ?? null);
        // Populate filter options from first full (unfiltered) load
        if (dist === "All Districts" && delay === "All" && sector === "All Sectors" && !q.trim() && pg === 0) {
          const seenDistricts = Array.from(new Set((res.cases || []).map((c: any) => String(c.district || "")))).filter(Boolean).sort();
          if (seenDistricts.length > 0) setDistricts(["All Districts", ...seenDistricts]);
          const seenSectors = Array.from(new Set((res.cases || []).map((c: any) => String(c.sector || "")))).filter(Boolean).sort();
          if (seenSectors.length > 0) setSectors(["All Sectors", ...seenSectors]);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load cases from AcquiSight backend.");
        setLoading(false);
      });
  };

  // Debounced search
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(0);
      fetchCases(0, query, district, delayFilter, sectorFilter, riskFilter);
    }, 350);
    return () => window.clearTimeout(t);
  }, [query, district, delayFilter, sectorFilter, riskFilter]);

  // Page change
  useEffect(() => {
    fetchCases(page, query, district, delayFilter, sectorFilter, riskFilter);
  }, [page]);

  const totalPages = backendTotal != null ? Math.ceil(backendTotal / PAGE_LIMIT) : null;
  const startRow = page * PAGE_LIMIT + 1;
  const endRow = page * PAGE_LIMIT + backendCases.length;

  return (
    <AppPage>
      <SectionTitle
        eyebrow="Tamil Nadu Land Acquisition Feed"
        title="Land Acquisition Cases & Delay Registry"
        detail={backendTotal != null
          ? `Showing ${startRow.toLocaleString()}–${endRow.toLocaleString()} of ${backendTotal.toLocaleString()} real backend cases across Tamil Nadu.`
          : "Loading land acquisition cases from AcquiSight backend…"}
        action={
          <div className="flex items-center gap-2">
            <button
              data-testid="button-export-excel"
              onClick={() => window.open(getExcelExportUrl(), "_blank")}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-white/[.04] px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-300 transition"
            >
              <Download size={14} /> Export to Excel
            </button>
            <Link href="/create-case" data-testid="link-new-case" className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3.5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-cyan-300">
              <Plus size={15} /> Intake New Case
            </Link>
          </div>
        }
      />

      <Surface className="overflow-hidden">
        {/* Search & Filter Header */}
        <div className="flex flex-col gap-3 border-b border-slate-700/60 p-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <SearchBox value={query} onChange={v => { setQuery(v); }} placeholder="Search by case number (e.g. TN/LA/...), project, district, purpose..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              data-testid="button-toggle-filters"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 text-xs font-bold ${showFilters ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}
            >
              <SlidersHorizontal size={14} /> Filters
            </button>
          </div>
        </div>

        {/* Extended Filters Drawer */}
        {showFilters && (
          <div className="grid gap-3 border-b border-slate-700/60 bg-white/[.02] p-4 sm:grid-cols-4">
            <label className="text-[11px] font-bold text-slate-500">
              District
              <select
                data-testid="select-district-filter"
                value={district}
                onChange={e => { setDistrict(e.target.value); setPage(0); }}
                className="mt-1.5 block h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-xs text-slate-300"
              >
                {districts.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Delay / Litigation Posture
              <select
                data-testid="select-delay-filter"
                value={delayFilter}
                onChange={e => { setDelayFilter(e.target.value); setPage(0); }}
                className="mt-1.5 block h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-xs text-slate-300"
              >
                <option>All</option>
                <option>Delayed (&gt;90d)</option>
                <option>Moderate Delay (1-90d)</option>
                <option>On time</option>
                <option>In Litigation</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Sector
              <select
                data-testid="select-sector-filter"
                value={sectorFilter}
                onChange={e => { setSectorFilter(e.target.value); setPage(0); }}
                className="mt-1.5 block h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-xs text-slate-300"
              >
                {sectors.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Risk Category
              <select
                data-testid="select-risk-filter"
                value={riskFilter}
                onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
                className="mt-1.5 block h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-xs text-slate-300"
              >
                <option>All Risk Categories</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
          </div>
        )}

        {/* Loading / Error / Empty */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-xs text-slate-500">
            <RefreshCw size={14} className="mr-2 animate-spin" /> Loading cases from backend…
          </div>
        )}
        {!loading && error && (
          <div className="p-6 text-center text-xs text-rose-400">{error}</div>
        )}
        {!loading && !error && backendCases.length === 0 && (
          <div className="p-5">
            <EmptyState
              title="No cases match this criteria"
              detail="Try a different search query or reset the district/delay filter."
              action={
                <Button variant="outline" onClick={() => { setQuery(""); setDistrict("All Districts"); setDelayFilter("All"); setSectorFilter("All Sectors"); setPage(0); }}>
                  Reset Filters
                </Button>
              }
            />
          </div>
        )}

        {/* Desktop Table */}
        {!loading && !error && backendCases.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1040px] text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-[.13em] text-slate-600">
                  <th className="px-5 py-3 font-semibold">Case Number / Project</th>
                  <th className="px-3 py-3 font-semibold">District</th>
                  <th className="px-3 py-3 font-semibold">Sector / Purpose</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Cost (₹ Cr)</th>
                  <th className="px-3 py-3 font-semibold">Families</th>
                  <th className="px-3 py-3 font-semibold">Area</th>
                  <th className="px-3 py-3 font-semibold">Delay Status</th>
                  <th className="px-3 py-3 font-semibold">Bottleneck</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {backendCases.map((c: any) => {
                  const cid = c.id || String(c.la_case_id) || c.case_number;
                  const safeUrlId = encodeURIComponent(c.id || String(c.la_case_id) || c.case_number);
                  const status = c.status || c.acquisition_status || "—";
                  const delayDays = Number(c.delay_days || 0);
                  const delayStatus = c.delay_status || (delayDays > 90 ? "Delayed" : delayDays > 0 ? "Moderate Delay" : "On time");
                  const cost = c.total_estimated_cost_cr != null ? `₹${c.total_estimated_cost_cr} Cr` : "—";
                  return (
                    <tr key={cid} data-testid={`row-case-${cid}`} className="group border-b border-slate-800/70 last:border-0 hover:bg-white/[.025]">
                      <td className="px-5 py-4">
                        <Link href={`/cases/${safeUrlId}`} className="block">
                          <span className="mono text-xs font-bold text-cyan-300 group-hover:underline">{c.case_number || cid}</span>
                          <span className="mt-0.5 block text-xs font-semibold text-slate-200 truncate max-w-xs">{c.project_name || "—"}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-300">{c.district || "—"}</td>
                      <td className="px-3 py-4 text-xs text-slate-400">{c.acquisition_purpose || c.sector || "—"}</td>
                      <td className="px-3 py-4">
                        <Badge tone={status === "Litigated" ? "red" : status === "Possession Taken" || status === "Completed" ? "green" : "neutral"}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 mono text-xs text-cyan-300 font-semibold">{cost}</td>
                      <td className="px-3 py-4 mono text-xs text-slate-300">{c.no_of_families_affected ?? c.landowners ?? "—"}</td>
                      <td className="px-3 py-4 mono text-xs text-slate-300">{c.total_area_ha != null ? `${c.total_area_ha} ha` : "—"}</td>
                      <td className="px-3 py-4">
                        <DelayBadge status={delayStatus} days={delayDays} />
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-400">
                        <span className="block truncate max-w-[150px]">{c.primary_delay_reason || "—"}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/cases/${safeUrlId}`} data-testid={`link-open-case-${cid}`} className="inline-flex rounded-md p-2 text-slate-500 hover:bg-cyan-300/10 hover:text-cyan-200">
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards */}
        {!loading && !error && backendCases.length > 0 && (
          <div className="divide-y divide-slate-800/70 md:hidden">
            {backendCases.map((c: any) => {
              const cid = c.id || c.la_case_id || c.case_number;
              const safeCid = encodeURIComponent(cid);
              const delayDays = Number(c.delay_days || 0);
              const delayStatus = c.delay_status || (delayDays > 90 ? "Delayed" : delayDays > 0 ? "Moderate Delay" : "On time");
              return (
                <Link href={`/cases/${safeCid}`} key={cid} data-testid={`card-case-mobile-${cid}`} className="block p-4 hover:bg-white/[.03]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="mono text-[11px] text-cyan-300">{c.case_number || cid}</span>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">{c.project_name || "—"}</div>
                      <div className="mt-1 text-[10px] text-slate-500">{c.district || "—"} · {c.acquisition_purpose || c.sector || "—"}</div>
                    </div>
                    <DelayBadge status={delayStatus} days={delayDays} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="mono text-[10px] text-slate-400">{c.no_of_families_affected ?? "—"} families · {c.total_area_ha != null ? `${c.total_area_ha} ha` : "—"}</span>
                    <Badge tone="neutral">{c.status || c.acquisition_status || "—"}</Badge>
                  </div>
                  {c.primary_delay_reason && c.primary_delay_reason !== "None" && (
                    <div className="mt-2 text-[10px] text-rose-300/80 truncate">
                      Delay reason: {c.primary_delay_reason}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer: Count + Pagination */}
        {!loading && !error && backendTotal != null && (
          <div className="flex items-center justify-between border-t border-slate-800/70 px-5 py-3 text-[10px] text-slate-600">
            <span>
              Showing {startRow.toLocaleString()}–{endRow.toLocaleString()} of{" "}
              <span className="text-cyan-500 font-semibold">{backendTotal.toLocaleString()}</span> Tamil Nadu acquisition cases
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="rounded-md border border-slate-700 px-2 py-1 text-slate-400 hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-30"
              >
                <ArrowLeft size={12} />
              </button>
              <span className="px-2 text-slate-500">Page {page + 1}{totalPages ? ` / ${totalPages}` : ""}</span>
              <button
                disabled={totalPages !== null && page + 1 >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-md border border-slate-700 px-2 py-1 text-slate-400 hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-30"
              >
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </Surface>
    </AppPage>
  );
}



export function CreateCasePage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    location: "Tiruchirappalli",
    region: "Tiruchirappalli",
    area: "",
    owner: "Tamil Nadu Highways",
    landowners: "",
    land_type: "Dry",
    soil_type: "Red Soil",
    flood_risk: "No",
    water_availability: "Yes",
    dispute: false,
    documents: false,
    compensation: false,
  });

  const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const next = () => {
    setError("");

    if (step === 1) {
      if (!form.name.trim()) {
        setError("Project name is required before proceeding.");
        return;
      }
      const numArea = parseFloat(form.area);
      if (!form.area.trim() || isNaN(numArea) || numArea <= 0) {
        setError("Please enter a valid positive land area in hectares.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      setSaved(true);
      setSyncStatus("Validating and running ML delay risk prediction...");

      const payload = {
        project_name: form.name.trim(),
        name: form.name.trim(),
        district: form.location,
        location: form.location,
        total_area_ha: parseFloat(form.area),
        area: `${form.area} ha`,
        implementing_agency: form.owner,
        owner: form.owner,
        no_of_families_affected: parseInt(form.landowners) || 12,
        landowners: parseInt(form.landowners) || 12,
        land_type: form.land_type,
        soil_type: form.soil_type,
        flood_risk: form.flood_risk,
        water_availability: form.water_availability,
        has_litigation: form.dispute,
        court_case: form.dispute ? "Yes" : "No",
        owner_objection: form.compensation ? "Yes" : "No",
        document_issue: form.documents ? "Not Available" : "Available",
        documents: form.documents,
        compensation: form.compensation,
      };

      createBackendCase(payload)
        .then(res => {
          setSyncStatus("✓ Persisted to Authoritative Database with ML Prediction!");
          // Invalidate React Query caches so dashboard counts and analytics refresh immediately
          queryClient.invalidateQueries();
          const targetId = res?.case?.id || res?.case?.case_number || "new";
          window.setTimeout(() => {
            setLocation(`/cases/${encodeURIComponent(targetId)}`);
          }, 700);
        })
        .catch(err => {
          console.error("Case creation failed:", err);
          setError(`Case creation failed: ${err.message || "FastAPI connection error"}`);
          setSaved(false);
          setSyncStatus("");
        });
    }
  };

  const tnDistricts = [
    "Tiruchirappalli", "Chennai", "Coimbatore", "Salem", "Madurai", "Thanjavur",
    "Karur", "Cuddalore", "Vellore", "Erode", "Krishnagiri", "Thoothukudi",
    "Tirunelveli", "Tiruvallur", "Kancheepuram", "Chengalpattu", "Ranipet",
    "Villupuram", "Dharmapuri", "Namakkal", "Dindigul", "Theni", "Virudhunagar"
  ];

  return (
    <AppPage>
      <div className="mx-auto max-w-4xl">
        <SectionTitle
          eyebrow="Tamil Nadu Land Acquisition Intake"
          title="Create Land Acquisition Case"
          detail="Record new project parameters, Section 11(1) notices, and run ML delay prediction."
          action={<Link href="/land-intelligence" className="text-xs font-bold text-slate-500 hover:text-slate-200">Cancel</Link>}
        />
        <div className="mb-7 grid grid-cols-3 gap-1">
          {["Project Profile", "Risk & Land Features", "Review & Register"].map((x, i) => (
            <div key={x} className={`border-t-2 pt-3 text-[11px] font-bold ${step >= i + 1 ? "border-cyan-300 text-cyan-200" : "border-slate-700 text-slate-600"}`}>
              <span className="mono mr-2">0{i + 1}</span>{x}
            </div>
          ))}
        </div>

        <Surface className="p-5 md:p-8">
          {step === 1 && (
            <div className="animate-enter">
              <div className="mb-6">
                <div className="eyebrow">Case Context</div>
                <h2 className="mt-1 text-xl font-bold text-slate-100">Project & Location Parameters</h2>
                <p className="mt-1 text-xs text-slate-400">Specify statutory project identification details.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Project Name *" value={form.name} onChange={v => { update("name", v); setError(""); }} placeholder="e.g. Madurai Outer Ring Road Phase 2" test="input-case-name" />
                <label className="text-xs font-bold text-slate-400">
                  District *
                  <select
                    data-testid="select-case-district"
                    value={form.location}
                    onChange={e => { update("location", e.target.value); update("region", e.target.value); }}
                    className="mt-2 h-11 w-full rounded-md border border-slate-700/70 bg-slate-950/50 px-3 text-sm text-slate-200"
                  >
                    {tnDistricts.map(d => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <Field label="Total Land Area (ha) *" value={form.area} onChange={v => { update("area", v); setError(""); }} placeholder="e.g. 24.5" test="input-case-area" />
                <Field label="Implementing Agency" value={form.owner} onChange={v => { update("owner", v); setError(""); }} placeholder="e.g. NHAI / TN Highways / SIPCOT" test="input-case-owner" />
                <Field label="Estimated Affected Families" value={form.landowners} onChange={v => update("landowners", v)} placeholder="e.g. 140" test="input-case-landowners" />
              </div>
              {error && <div role="alert" className="mt-5 rounded-md border border-rose-300/25 bg-rose-400/[.06] px-3 py-2 text-xs text-rose-200">{error}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="animate-enter">
              <div className="mb-6">
                <div className="eyebrow">Risk & Model Attributes</div>
                <h2 className="mt-1 text-xl font-bold text-slate-100">Known Delay Drivers & Terrain Features</h2>
                <p className="mt-2 text-sm text-slate-400">These features feed the trained ML regression and classification pipelines.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <label className="text-xs font-bold text-slate-400">
                  Land Type
                  <select
                    value={form.land_type}
                    onChange={e => update("land_type", e.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 text-xs text-slate-200"
                  >
                    <option>Dry</option>
                    <option>Wet</option>
                    <option>Manavari</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-400">
                  Soil Type
                  <select
                    value={form.soil_type}
                    onChange={e => update("soil_type", e.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 text-xs text-slate-200"
                  >
                    <option>Red Soil</option>
                    <option>Black Soil</option>
                    <option>Alluvial Soil</option>
                    <option>Clay Soil</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-400">
                  Flood Risk Zone
                  <select
                    value={form.flood_risk}
                    onChange={e => update("flood_risk", e.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 text-xs text-slate-200"
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                {[
                  ["dispute", "Legal Dispute or Court Challenge", "Writ petition before High Court of Madras or District Court.", Gavel],
                  ["documents", "Pending Clearances / SIA Gaps", "Environmental, Coastal (CRZ), or Railway clearance incomplete.", FileText],
                  ["compensation", "Compensation Objections Raised", "Disagreements over guideline value or compensation rates under Sec 15.", Users],
                ].map(([key, title, detail, I]) => (
                  <button
                    type="button"
                    key={key as string}
                    data-testid={`button-toggle-${key}`}
                    onClick={() => update(key as string, !form[key as keyof typeof form])}
                    className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition ${form[key as keyof typeof form] ? "border-cyan-300/40 bg-cyan-300/[.07]" : "border-slate-700/70 bg-white/[.02] hover:border-slate-600"}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${form[key as keyof typeof form] ? "bg-cyan-300/15 text-cyan-200" : "bg-slate-800 text-slate-500"}`}>
                      <I size={17} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-slate-200">{title as string}</span>
                      <span className="mt-1 block text-xs text-slate-400">{detail as string}</span>
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${form[key as keyof typeof form] ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-600"}`}>
                      {form[key as keyof typeof form] && <Check size={13} />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-enter">
              <div className="mb-6">
                <div className="eyebrow">Review Intake</div>
                <h2 className="mt-1 text-xl font-bold text-slate-100">{form.name || "Untitled Acquisition Case"}</h2>
                <p className="mt-2 text-sm text-slate-400">Confirm parameters. AcquiSight will execute the ML delay model upon registration.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["District", form.location],
                  ["Total Area", form.area ? `${form.area} ha` : "Not specified"],
                  ["Agency", form.owner],
                  ["Affected Families", form.landowners || "12"],
                  ["Land & Soil", `${form.land_type} · ${form.soil_type}`],
                  ["Delay Risk Signals", [form.dispute && "Litigation", form.documents && "Clearances Pending", form.compensation && "Objections Raised"].filter(Boolean).join(" · ") || "No initial delay signals"],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg bg-white/[.035] p-4">
                    <div className="eyebrow">{k as string}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-200">{v as string}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/[.05] p-4 text-xs leading-6 text-cyan-100 flex items-start gap-3">
                <Sparkles size={16} className="shrink-0 mt-1 text-cyan-300" />
                <div>
                  <div className="font-semibold text-cyan-200">ML Delay Prediction Pipeline</div>
                  <div className="text-slate-400 mt-0.5">
                    FastAPI backend will evaluate this case through ExtraTrees & Classification pipelines, compute estimated delay days, and store it in the authoritative database.
                  </div>
                </div>
              </div>

              {syncStatus && (
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs font-semibold text-emerald-300 animate-pulse">
                  {syncStatus}
                </div>
              )}
              {error && <div role="alert" className="mt-3 rounded-md border border-rose-300/25 bg-rose-400/[.06] px-3 py-2 text-xs text-rose-200">{error}</div>}
            </div>
          )}

          <div className="mt-8 flex justify-between border-t border-slate-800 pt-5">
            <Button variant="ghost" disabled={step === 1 || saved} onClick={() => setStep(step - 1)}>
              <ArrowLeft size={14} /> Back
            </Button>
            <Button onClick={next} disabled={saved}>
              {saved ? (syncStatus || "Processing...") : step === 3 ? "Register & Run AI Delay Assessment" : "Continue"}
              {!saved && <ArrowRight size={14} />}
            </Button>
          </div>
        </Surface>
      </div>
    </AppPage>
  );
}

function Field({ label, value, onChange, placeholder, test }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; test: string }) {
  return (
    <label className="text-xs font-bold text-slate-400">
      {label}
      <input
        data-testid={test}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-md border border-slate-700/70 bg-slate-950/50 px-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-cyan-300/60"
      />
    </label>
  );
}

export function AiAnalysisPage() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const stages = ["Parsing Tamil Nadu parcel geometry", "Cross-checking High Court & Tribunal dockets", "Computing RFCTLARR milestone timeline", "Generating prevention roadmap"];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => setLocation("/risk-assessment"), 500);
          return 100;
        }
        setStage(Math.min(stages.length - 1, Math.floor(p / 27)));
        return p + 2;
      });
    }, 60);
    return () => window.clearInterval(timer);
  }, [setLocation]);

  return (
    <AppPage>
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/[.07] text-cyan-300 shadow-[0_0_50px_rgba(74,215,239,.12)]">
            <Sparkles size={31} />
          </div>
          <div className="eyebrow mb-4">Delay Assessment Engine</div>
          <h1 className="font-display text-4xl font-bold tracking-[-.06em] text-slate-100 md:text-5xl">
            Evaluating Acquisition Risk<br /><span className="text-cyan-300">for Tamil Nadu Parcels.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-500">
            Comparing project signals against gazette historical records, legal disputes, and compensation benchmarks.
          </p>
          <div className="mx-auto mt-12 max-w-md text-left">
            <div className="mb-2 flex justify-between text-[11px]">
              <span className="font-semibold text-slate-300">{stages[stage]}</span>
              <span className="mono text-cyan-300">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(74,215,239,.35)]" />
            </div>
            <div className="mt-5 grid grid-cols-4 gap-1">
              {stages.map((x, i) => (
                <div key={x} className={`h-1 rounded-full ${i <= stage ? "bg-cyan-300" : "bg-slate-800"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppPage>
  );
}

export function RiskAssessmentPage() {
  const { toast, message, close } = useToastState();
  const [caseItem] = useState<AcquisitionCase>(() => getDraftCase() || cases[0]);
  const { score, level } = scoreCase(caseItem);

  const factors = [
    ["Court Dispute / Writ Petition", caseItem.has_litigation, 25, `Active proceedings at ${caseItem.litigation_forum || "High Court of Madras"}.`],
    ["Compensation Objections", caseItem.objections_count > 0, 20, `${caseItem.objections_count} landowner objections recorded.`],
    ["Clearance Status", caseItem.incompleteDocuments, 15, "Mandatory clearance or SIA milestone pending approval."],
    ["Days in Process", caseItem.delay_days > 90, 25, `${caseItem.delay_days} delay days accumulated past scheduled possession.`],
    ["Landowner Density", caseItem.no_of_families_affected > 50, 15, `${caseItem.no_of_families_affected} affected families require individual R&R consent.`],
  ];

  return (
    <AppPage>
      <SectionTitle
        eyebrow={`Delay Intelligence / ${caseItem.case_number}`}
        title="Predictive Risk Assessment"
        detail="Explainable delay breakdown and actionable prevention steps."
        action={<Button variant="outline" onClick={() => toast("Assessment report exported")}><Download size={14} /> Export Brief</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <Surface className="relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-rose-400/[.06] blur-3xl" />
          <div className="eyebrow">Calculated Delay Score</div>
          <div className="mt-5 flex items-end gap-4">
            <div className="font-display text-7xl font-bold tracking-[-.1em] text-rose-300">{score}</div>
            <div className="pb-2">
              <RiskBadge level={level} />
              <div className="mt-2 text-[11px] text-slate-500">out of 100 signal points</div>
            </div>
          </div>
          <div className="mt-7 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-400" style={{ width: `${score}%` }} />
          </div>
          <div className="mt-7 border-t border-slate-800 pt-5">
            <div className="text-xs font-bold text-slate-300">Assessment Summary</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {caseItem.project_name} in {caseItem.district}. Primary bottleneck: <span className="text-slate-300 font-semibold">{caseItem.primary_delay_reason}</span> ({caseItem.primary_delay_detail}).
            </p>
          </div>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Link href="/action-intelligence" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 py-3 text-xs font-extrabold text-slate-950 hover:bg-cyan-300">
              View Action Queue <ArrowRight size={15} />
            </Link>
            <Link href={`/cases/${encodeURIComponent(caseItem.id)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-4 py-3 text-xs font-bold text-slate-300 hover:border-cyan-300/45 hover:text-cyan-200">
              Open Case Dossier <ArrowRight size={15} />
            </Link>
          </div>
        </Surface>

        <Surface className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Contributing Drivers</div>
              <h2 className="mt-1 text-base font-bold text-slate-200">Why this case has accumulated delays</h2>
            </div>
            <Badge tone="violet">Deterministic Model</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {factors.map(([name, active, points, detail]) => (
              <div key={name as string} className="rounded-lg border border-slate-700/50 bg-white/[.02] p-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? "bg-rose-400/12 text-rose-300" : "bg-slate-800 text-slate-600"}`}>
                    {active ? <ShieldAlert size={15} /> : <Check size={15} />}
                  </span>
                  <span className="flex-1 text-xs font-bold text-slate-200">{name as string}</span>
                  <span className={`mono text-xs ${active ? "text-rose-300" : "text-slate-600"}`}>
                    {active ? `+${points}` : "clear"}
                  </span>
                </div>
                {active && <p className="mt-3 pl-10 text-xs leading-5 text-slate-500">{detail as string}</p>}
              </div>
            ))}
          </div>
        </Surface>
      </div>
      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}

export function ActionIntelligencePage() {
  const { toast, message, close } = useToastState();
  const [done, setDone] = useState<string[]>([]);
  const [filter, setFilter] = useState("All actions");
  const [tasks, setTasks] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);

  useEffect(() => {
    getActions(20)
      .then(res => {
        if (res && res.length > 0) setTasks(res);
        else setBackendError(true);
        setLoading(false);
      })
      .catch(() => {
        setBackendError(true);
        setLoading(false);
      });
  }, []);

  const shown = tasks.filter(x => filter === "All actions" || x.priority === filter);
  const openCount = tasks.filter(t => !done.includes(t.id)).length;
  const urgentCount = tasks.filter(t => t.priority === "Urgent" && !done.includes(t.id)).length;
  const legalCount = tasks.filter(t => t.type === "Legal" && !done.includes(t.id)).length;
  const toggle = (id: string) => {
    setDone(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]));
    toast(done.includes(id) ? "Action reopened" : "Action marked complete");
  };

  return (
    <AppPage>
      <SectionTitle
        eyebrow="Tamil Nadu LA Operations Desk"
        title="Action & Prevention Intelligence"
        detail={`Targeted operational steps to unblock delays and resolve litigations — derived from ${tasks.length} real acquisition cases.`}
        action={<Button variant="outline" onClick={() => {
          setLoading(true);
          getActions(20).then(res => { if (res?.length) setTasks(res); setLoading(false); toast("Action feed refreshed from FastAPI"); }).catch(() => setLoading(false));
        }}><RefreshCw size={14} /> Refresh</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Open Actions" value={loading ? "…" : openCount} note={`${urgentCount} Urgent · ${legalCount} Legal`} icon={ListChecks} tone="amber" />
        <StatCard label="Litigation Actions" value={loading ? "…" : legalCount} note="High Court & Tribunal responses" icon={Gavel} tone="red" />
        <StatCard label="Timeline Breaches" value={loading ? "…" : tasks.filter(t => t.type === "Timeline").length} note="Cases exceeding 120d SLA" icon={Clock3} tone="violet" />
      </div>

      <Surface className="overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-slate-700/60 p-4">
          {["All actions", "Urgent", "High", "Medium", "Low"].map(x => (
            <button
              key={x}
              data-testid={`button-action-filter-${x.toLowerCase()}`}
              onClick={() => setFilter(x)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${filter === x ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
            >
              {x}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-800/70">
          {loading && (
            <div className="flex items-center justify-center p-10 text-xs text-slate-500">
              Loading action items from FastAPI backend…
            </div>
          )}
          {!loading && backendError && tasks.length === 0 && (
            <div className="flex items-center justify-center p-10 text-xs text-rose-400">
              Unable to load actions from AcquiSight backend. Ensure FastAPI is running on port 8000.
            </div>
          )}
          {!loading && shown.length === 0 && !backendError && (
            <div className="flex items-center justify-center p-10 text-xs text-slate-500">
              No action items match the selected filter.
            </div>
          )}
          {shown.map(t => (
            <motion.div layout key={t.id} className={`flex gap-3 p-4 md:items-center md:gap-5 ${done.includes(t.id) ? "opacity-50" : ""}`}>
              <button
                data-testid={`button-complete-action-${t.id}`}
                onClick={() => toggle(t.id)}
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition md:mt-0 ${done.includes(t.id) ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-600 text-transparent hover:border-cyan-300"}`}
              >
                <Check size={13} />
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-bold ${done.includes(t.id) ? "text-slate-500 line-through" : "text-slate-200"}`}>{t.title}</div>
                <div className="mt-1 text-xs text-slate-500">{t.detail}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link href={`/cases/${encodeURIComponent(t.caseId)}`} className="mono text-[10px] text-cyan-300">{t.caseId}</Link>
                  {t.district && <><span className="text-slate-700">·</span><span className="text-[10px] text-slate-500">{t.district}</span></>}
                  {t.owner && <><span className="text-slate-700">·</span><span className="text-[10px] text-slate-500">{t.owner}</span></>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge tone={t.priority === "Urgent" ? "red" : t.priority === "High" ? "amber" : "neutral"}>{t.priority}</Badge>
                <Badge tone={t.type === "Legal" ? "red" : "neutral"}>{t.type}</Badge>
                <span className="mono text-[10px] text-slate-500">{t.due}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </Surface>
      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}

export function RiskAlertsPage() {
  const { toast, message, close } = useToastState();
  const [type, setType] = useState("All");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAlerts(25)
      .then(res => {
        if (res && res.length > 0) setLiveAlerts(res);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const shown = liveAlerts.filter(x => type === "All" || x.type === type);

  return (
    <AppPage>
      <SectionTitle
        eyebrow="Tamil Nadu Alert Monitor"
        title="Litigation & Delay Alerts"
        detail="Active court filings, delay threshold violations, and urgent clearance bottlenecks."
        action={<Button variant="outline" onClick={() => {
          setLoading(true);
          getAlerts(25).then(res => { if (res && res.length > 0) setLiveAlerts(res); setLoading(false); toast("Alert feed synchronized with FastAPI backend"); }).catch(() => { setLoading(false); toast("Offline cache active"); });
        }}><RefreshCw size={14} /> Sync Feed</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {["All", "Legal", "Timeline"].map(x => (
          <button
            key={x}
            data-testid={`button-alert-filter-${x.toLowerCase()}`}
            onClick={() => setType(x)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${type === x ? "border-cyan-300/45 bg-cyan-300/10 text-cyan-200" : "border-slate-700 text-slate-500"}`}
          >
            {x}
          </button>
        ))}
      </div>

      <Surface className="overflow-hidden">
        <div className="divide-y divide-slate-800/70">
          {loading && (
            <div className="flex items-center justify-center p-10 text-xs text-slate-500">
              Loading alerts from FastAPI backend…
            </div>
          )}
          {!loading && error && liveAlerts.length === 0 && (
            <div className="flex items-center justify-center p-10 text-xs text-rose-400">
              Unable to load risk alerts from AcquiSight backend. Ensure FastAPI is running on port 8000.
            </div>
          )}
          {!loading && !error && shown.length === 0 && (
            <div className="flex items-center justify-center p-10 text-xs text-slate-500">
              No active alerts matching the selected filter.
            </div>
          )}
          {shown.map(a => (
            <motion.div layout key={a.id} className={`flex flex-col gap-4 p-5 md:flex-row md:items-center ${reviewed.includes(a.id) ? "opacity-55" : ""}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.severity === "Critical" ? "bg-rose-400/15 text-rose-300" : "bg-amber-300/10 text-amber-300"}`}>
                <ShieldAlert size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">{a.title}</span>
                  <Badge tone={a.severity === "Critical" ? "red" : "amber"}>{a.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{a.detail}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600">
                  <span className="mono text-cyan-300">{a.caseId}</span>
                  <span>·</span>
                  <span>{a.type}</span>
                  <span>·</span>
                  <span>{a.time}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/cases/${encodeURIComponent(a.caseId || a.case_id || "")}`}
                  data-testid={`link-investigate-${a.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-2 text-[10px] font-bold text-slate-300 hover:border-cyan-300/45 hover:text-cyan-200"
                >
                  Investigate <ArrowRight size={12} />
                </Link>
                <Button
                  variant={assigned.includes(a.id) ? "primary" : "ghost"}
                  onClick={() => {
                    setAssigned(v => (v.includes(a.id) ? v.filter(x => x !== a.id) : [...v, a.id]));
                    toast(assigned.includes(a.id) ? "Assignment cleared" : "Assigned to District LA Officer");
                  }}
                >
                  {assigned.includes(a.id) ? "Assigned" : "Assign"}
                </Button>
                <button
                  data-testid={`button-review-${a.id}`}
                  onClick={() => {
                    setReviewed(v => (v.includes(a.id) ? v.filter(x => x !== a.id) : [...v, a.id]));
                    toast("Alert marked reviewed");
                  }}
                  className="rounded-md border border-slate-700 px-2.5 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-200"
                >
                  {reviewed.includes(a.id) ? "Reviewed" : "Mark reviewed"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </Surface>
      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}

export function CaseProfilePage() {
  const params = useParams<{ id: string }>();
  const allCases = useMemo(() => getAllCases(), []);
  const original = allCases.find(c => c.id === params.id || c.case_number === params.id || String(c.la_case_id) === params.id) || allCases[0];
  const [current, setCurrent] = useState<AcquisitionCase>(original);
  const [tab, setTab] = useState("Overview");
  const { toast, message, close } = useToastState();
  const [showStatus, setShowStatus] = useState(false);
  const [explanation, setExplanation] = useState<RiskExplanationResponse | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (params.id) {
      getTnCaseById(params.id)
        .then(backendCase => {
          if (backendCase) {
            setCurrent(mapTnToCase(backendCase));
          }
        })
        .catch(err => console.warn("Backend case fetch:", err));
    }
  }, [params.id]);

  useEffect(() => {
    if (tab === "Explainable Risk AI" && !explanation && (params.id || current.id || current.case_number)) {
      setExplanationLoading(true);
      setExplanationError(null);
      getRiskExplanation(params.id || current.case_number || current.id)
        .then(res => {
          setExplanation(res);
          setExplanationLoading(false);
        })
        .catch(err => {
          console.warn("Risk explanation fetch error:", err);
          setExplanationError("Unable to retrieve explainable risk factors from backend ML service.");
          setExplanationLoading(false);
        });
    }
  }, [tab, params.id, current.id, current.case_number, explanation]);

  const handleStatusChange = async (s: CaseStatus) => {
    setUpdatingStatus(true);
    try {
      const updated = await updateBackendCase(current.case_number || current.id, { status: s });
      if (updated) {
        setCurrent(mapTnToCase(updated));
      } else {
        setCurrent({ ...current, status: s });
      }
      await queryClient.invalidateQueries();
      toast(`Status successfully updated to "${s}" in backend`);
    } catch (err) {
      console.error("Status update error:", err);
      toast(`Failed to update status to ${s}`);
    } finally {
      setUpdatingStatus(false);
      setShowStatus(false);
    }
  };

  const statuses: CaseStatus[] = ["Possession Taken", "Award Declared", "Completed", "Objections Received", "Litigated", "Initiated", "SIA Completed"];

  return (
    <AppPage>
      <div className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/land-intelligence" className="hover:text-cyan-200">Land Intelligence Feed</Link>
        <span>/</span>
        <span className="mono text-cyan-300">{current.case_number}</span>
      </div>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="eyebrow mb-2">Tamil Nadu Land Acquisition Case · Project {current.project_id}</div>
          <h1 className="max-w-3xl font-display text-3xl font-bold tracking-[-.06em] text-slate-100 md:text-4xl">
            {current.project_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><MapPin size={12} />{current.district}, Tamil Nadu</span>
            <span>·</span>
            <span>{current.total_area_ha} ha</span>
            <span>·</span>
            <span>{current.no_of_families_affected} affected families</span>
            <span>·</span>
            <span className="mono text-slate-400">{current.implementing_agency}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              data-testid="button-case-status"
              disabled={updatingStatus}
              onClick={() => setShowStatus(!showStatus)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-white/[.03] px-3 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400/40 transition disabled:opacity-50"
            >
              {updatingStatus ? "Updating..." : current.status} <ChevronDown size={14} />
            </button>
            {showStatus && (
              <div className="absolute right-0 top-11 z-10 w-52 rounded-lg border border-slate-700 bg-[#111a2b] p-1 shadow-xl">
                {statuses.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[.06] hover:text-cyan-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            data-testid="button-export-dossier"
            onClick={() => window.open(getExcelExportUrl(), "_blank")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-white/[.03] px-3 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-200 transition"
          >
            <Download size={13} /> Export Dossier (.xlsx)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-7 flex flex-wrap gap-5 border-b border-slate-800 text-xs font-bold">
        {["Overview", "Explainable Risk AI", "Delay Events", "Litigation & Disputes", "Clearances", "Stakeholders"].map(x => (
          <button
            key={x}
            data-testid={`button-case-tab-${x.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setTab(x)}
            className={`border-b-2 pb-3 transition ${tab === x ? "border-cyan-300 text-cyan-200" : "border-transparent text-slate-500 hover:text-slate-300"}`}
          >
            {x === "Explainable Risk AI" ? (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                Explainable Risk AI
              </span>
            ) : x}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.65fr]">
          <div className="space-y-5">
            <Surface className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Delay & Risk Metrics</div>
                  <h2 className="mt-1 text-base font-bold text-slate-200">Current Acquisition Status</h2>
                </div>
                <DelayBadge status={current.delay_status} days={current.delay_days} />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white/[.035] p-4">
                  <div className="eyebrow">Delay Days</div>
                  <div className="mt-2 text-2xl font-bold text-rose-300">{current.delay_days}<span className="text-xs text-slate-600"> days</span></div>
                </div>
                <div className="rounded-lg bg-white/[.035] p-4">
                  <div className="eyebrow">Affected Families</div>
                  <div className="mt-2 text-2xl font-bold text-slate-200">{current.no_of_families_affected}</div>
                </div>
                <div className="rounded-lg bg-white/[.035] p-4">
                  <div className="eyebrow">Project Cost</div>
                  <div className="mt-2 text-2xl font-bold text-cyan-300">₹{current.total_estimated_cost_cr} Cr</div>
                </div>
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="eyebrow">Primary Delay Factor</div>
              <div className="mt-2 flex items-start gap-3">
                <div className="mt-1 rounded-md bg-cyan-300/10 p-2 text-cyan-300">
                  <Zap size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-200">{current.primary_delay_reason}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{current.primary_delay_detail}</p>
                  <p className="mt-2 text-xs font-semibold text-cyan-300">Recommended Move: {current.nextAction}</p>
                </div>
              </div>
            </Surface>
          </div>

          <Surface className="p-5">
            <div className="eyebrow">Case Dossier Information</div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Case Number</span>
                <span className="mono text-cyan-300 font-bold">{current.case_number}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Sector</span>
                <span className="text-slate-200">{current.sector} ({current.project_type})</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">District / State</span>
                <span className="text-slate-200">{current.district}, Tamil Nadu</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">LARR Act Applicable</span>
                <span className="text-slate-200">{current.larr_applicable ? "Yes (RFCTLARR 2013)" : "State Highway / Special Act"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Rural / Urban</span>
                <span className="text-slate-200">{current.rural_urban_mix}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Notification Date</span>
                <span className="mono text-slate-400">{current.notification_date || "Pending"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Litigation Active</span>
                <span className={current.has_litigation ? "text-rose-300 font-bold" : "text-emerald-400"}>
                  {current.has_litigation ? `Yes (${current.litigation_forum})` : "No Active Disputes"}
                </span>
              </div>
            </div>
          </Surface>
        </div>
      )}

      {tab === "Explainable Risk AI" && (
        <div className="mt-6 space-y-6">
          {explanationLoading && (
            <Surface className="p-8 text-center text-xs text-slate-400">
              <div className="inline-flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin text-cyan-400" />
                Computing multi-factor feature attribution and evaluating RFCTLARR statutory rules...
              </div>
            </Surface>
          )}

          {explanationError && (
            <Surface className="p-6 border border-rose-500/30 bg-rose-500/5">
              <div className="flex items-center gap-3 text-rose-300">
                <AlertTriangle size={18} />
                <span className="text-xs font-bold">{explanationError}</span>
              </div>
              <button
                onClick={() => {
                  setExplanation(null);
                  setExplanationLoading(true);
                  getRiskExplanation(params.id || current.case_number || current.id)
                    .then(res => { setExplanation(res); setExplanationLoading(false); })
                    .catch(() => { setExplanationError("Unable to retrieve explanation."); setExplanationLoading(false); });
                }}
                className="mt-3 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Retry Analysis
              </button>
            </Surface>
          )}

          {explanation && (
            <>
              {/* Model Summary Metrics */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Surface className="p-4">
                  <div className="eyebrow">ML Predicted Delay</div>
                  <div className="mt-1 text-2xl font-bold text-rose-300">
                    {explanation.predicted_delay_days} <span className="text-xs font-normal text-slate-500">days</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">Baseline historical projection</div>
                </Surface>
                <Surface className="p-4">
                  <div className="eyebrow">Risk Classification</div>
                  <div className="mt-1">
                    <RiskBadge level={explanation.risk_category as any} />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">Multi-factor severity tier</div>
                </Surface>
                <Surface className="p-4">
                  <div className="eyebrow">Model Confidence</div>
                  <div className="mt-1 text-2xl font-bold text-cyan-300">
                    {(explanation.confidence_score * 100).toFixed(1)}%
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">Cross-validation stability</div>
                </Surface>
                <Surface className="p-4">
                  <div className="eyebrow">Model Architecture</div>
                  <div className="mt-1 text-sm font-bold text-slate-200 truncate">
                    {explanation.model_type}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Trained on verified TN outcomes</div>
                </Surface>
              </div>

              {/* Two Column Grid: ML Weights vs Statutory Rules */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 1. ML Model Factors */}
                <Surface className="p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="eyebrow">Statistical Attribution</div>
                      <h2 className="text-base font-bold text-slate-100">ML Model-Derived Factors</h2>
                    </div>
                    <span className="rounded bg-cyan-400/10 px-2 py-1 text-[10px] font-bold text-cyan-300 border border-cyan-400/20">
                      ML_FEATURE_IMPORTANCE
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Statistical feature importances extracted from the production ExtraTrees Regressor. Represents mathematical weights and quantitative contributions.
                  </p>

                  <div className="mt-4 space-y-3">
                    {explanation.ml_model_factors.map((f, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-800 bg-white/[.02] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{f.factor}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            f.contribution_direction === "increases_risk"
                              ? "bg-rose-400/15 text-rose-300 border border-rose-400/20"
                              : f.contribution_direction === "reduces_risk"
                              ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/20"
                              : "bg-slate-700/30 text-slate-400"
                          }`}>
                            {f.contribution_direction === "increases_risk" ? "Increases Risk" : f.contribution_direction === "reduces_risk" ? "Mitigates Risk" : "Neutral"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{f.description}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            Observed Value: <span className="mono font-semibold text-slate-300">{f.feature_value !== null && f.feature_value !== undefined ? String(f.feature_value) : "Not available"}</span>
                          </span>
                          <span className="text-cyan-300 font-bold">
                            Model Weight: {f.model_weight_pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${f.contribution_direction === "increases_risk" ? "bg-rose-400" : "bg-cyan-400"}`}
                            style={{ width: `${Math.min(100, f.model_weight_pct * 3)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Surface>

                {/* 2. Deterministic Statutory Rules */}
                <Surface className="p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="eyebrow">Regulatory Compliance</div>
                      <h2 className="text-base font-bold text-slate-100">Deterministic Statutory Rules</h2>
                    </div>
                    <span className="rounded bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-300 border border-amber-400/20">
                      STATUTORY_RULE
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Deterministic legal and statutory criteria evaluated against the RFCTLARR Act 2013 and TN Land Administration Rules. Computed independently of ML predictions.
                  </p>

                  <div className="mt-4 space-y-3">
                    {explanation.statutory_business_rules.length === 0 ? (
                      <div className="p-4 rounded-lg bg-emerald-400/[.04] border border-emerald-400/20 text-xs text-emerald-300">
                        No statutory SLA breaches, active court stays, or clearance gaps identified for this acquisition file.
                      </div>
                    ) : (
                      explanation.statutory_business_rules.map((rule, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-800 bg-white/[.02] p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">{rule.rule_name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              rule.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : rule.severity === "HIGH"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            }`}>
                              {rule.severity}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] mono text-cyan-400 font-semibold">{rule.legal_basis}</div>
                          <div className="mt-1.5 text-xs text-slate-300">
                            <span className="text-slate-500 font-medium">Trigger: </span>{rule.condition_matched}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            <span className="text-slate-500 font-medium">Statutory Impact: </span>{rule.impact}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Surface>
              </div>

              {/* Analytical Synthesis & Audit Disclaimer */}
              <Surface className="p-5 border border-slate-700/80 bg-slate-900/40">
                <div className="eyebrow">Executive Summary & Audit Trail</div>
                <p className="mt-2 text-xs leading-6 text-slate-300">{explanation.summary_narrative}</p>
                <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-500">
                  <span className="font-bold text-slate-400">Audit Compliance Note: </span>
                  {explanation.disclaimer}
                </div>
              </Surface>
            </>
          )}
        </div>
      )}

      {tab === "Delay Events" && (
        <div className="mt-6">
          <Surface className="p-5">
            <div className="eyebrow">Logged Delay Events</div>
            <h2 className="mt-1 text-base font-bold text-slate-200">Historical Timeline of Delays</h2>
            {current.delay_events && current.delay_events.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-800">
                {current.delay_events.map(d => (
                  <div key={d.delay_event_id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-200">{d.delay_reason_category}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{d.delay_reason_detail}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{d.start_date || "Start"} to {d.end_date || "Present"}</div>
                    </div>
                    <Badge tone="red">{d.delay_days} days delay</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-5 text-center text-xs text-slate-500">No specific delay events logged for this case. Standard processing.</div>
            )}
          </Surface>
        </div>
      )}

      {tab === "Litigation & Disputes" && (
        <div className="mt-6">
          <Surface className="p-5">
            <div className="eyebrow">Legal & Dispute Registry</div>
            <h2 className="mt-1 text-base font-bold text-slate-200">Court Filings and Tribunal Hearings</h2>
            {current.disputes && current.disputes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {current.disputes.map(dp => (
                  <div key={dp.dispute_id} className="rounded-lg border border-slate-700/60 bg-white/[.025] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{dp.dispute_type} Dispute</span>
                      <Badge tone="red">{dp.current_status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-cyan-300 font-semibold">{dp.forum}</div>
                    <div className="mt-1 text-xs text-slate-400">{dp.outcome_summary}</div>
                    <div className="mt-2 text-[10px] text-slate-500">Filing Date: {dp.filing_date || "Pending"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-5 text-center text-xs text-slate-500">No active litigation or court cases filed for this case.</div>
            )}
          </Surface>
        </div>
      )}

      {tab === "Clearances" && (
        <div className="mt-6">
          <Surface className="p-5">
            <div className="eyebrow">Statutory Clearances</div>
            <h2 className="mt-1 text-base font-bold text-slate-200">Environmental, Forest & Revenue Approvals</h2>
            {current.clearances && current.clearances.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {current.clearances.map(cl => (
                  <div key={cl.clearance_id} className="rounded-lg border border-slate-700/60 bg-white/[.025] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{cl.clearance_type} Clearance</span>
                      <Badge tone={cl.status.toLowerCase().includes("approved") ? "green" : "amber"}>{cl.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">Authority: {cl.authority}</div>
                    {cl.conditions_imposed && <div className="mt-1 text-[10px] text-slate-500">Condition: {cl.conditions_imposed}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-5 text-center text-xs text-slate-500">Standard administrative clearance pathways.</div>
            )}
          </Surface>
        </div>
      )}

      {tab === "Stakeholders" && (
        <div className="mt-6">
          <Surface className="p-5">
            <div className="eyebrow">Stakeholders & Compensation</div>
            <h2 className="mt-1 text-base font-bold text-slate-200">Landowner & Affected Family Records</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white/[.03] p-3">
                <div className="text-[10px] text-slate-500 uppercase">Affected Families</div>
                <div className="mt-1 text-xl font-bold text-slate-200">{current.no_of_families_affected}</div>
              </div>
              <div className="rounded-lg bg-white/[.03] p-3">
                <div className="text-[10px] text-slate-500 uppercase">Objections Filed</div>
                <div className="mt-1 text-xl font-bold text-amber-300">{current.objections_count}</div>
              </div>
              <div className="rounded-lg bg-white/[.03] p-3">
                <div className="text-[10px] text-slate-500 uppercase">Compensation Offered</div>
                <div className="mt-1 text-xl font-bold text-cyan-300">₹{current.compensation_offered_cr} Cr</div>
              </div>
            </div>
          </Surface>
        </div>
      )}

      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}

const CAUSE_COLORS = ["#fb7185","#f43f5e","#a855f7","#f59e0b","#fb923c","#e11d48","#e879f9","#38bdf8","#34d399","#60a5fa","#4ade80","#facc15"];

export function AnalyticsPage() {
  // --- Live state ---
  const [summary, setSummary] = useState<any>(null);
  const [delayCauses, setDelayCauses] = useState<Array<{ name: string; count: number; color: string }>>([]);
  const [statusDist, setStatusDist] = useState<Array<{ status: string; count: number }>>([]);
  const [liveDistrictData, setLiveDistrictData] = useState<Array<{ name: string; delayed: number; ontime: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboardSummary().catch(() => null),
      getAnalyticsDelayCauses(12).catch(() => []),
      getAnalyticsStatusDistribution().catch(() => []),
      getAnalyticsDistricts().catch(() => []),
    ]).then(([sum, causes, statDist, districts]) => {
      if (sum) setSummary(sum);
      if (causes && causes.length > 0)
        setDelayCauses(causes.map((c, i) => ({ ...c, color: CAUSE_COLORS[i % CAUSE_COLORS.length] })));
      if (statDist && statDist.length > 0) setStatusDist(statDist);
      if (districts && districts.length > 0)
        setLiveDistrictData(districts.map(d => ({
          name: d.district,
          delayed: d.delayed,
          ontime: Math.max(0, d.total - d.delayed),
        })));
      setLoading(false);
    });
  }, []);

  // Derived KPI values
  const avgDelay = summary?.avg_delay_days != null ? `${summary.avg_delay_days.toFixed(1)}d` : loading ? "…" : "N/A";
  const topCause = delayCauses[0]?.name ?? (loading ? "…" : "N/A");
  const topCauseCount = delayCauses[0]?.count ?? 0;
  const topCauseTotal = delayCauses.reduce((s, c) => s + c.count, 0);
  const topCausePct = topCauseTotal > 0 ? `${Math.round((topCauseCount / topCauseTotal) * 100)}% of delays` : "";
  const litigatedCases = summary?.litigated_cases ?? (loading ? "…" : 0);
  const completedCount = summary?.completed_cases ?? statusDist
    .filter(s => ["Completed", "Possession Taken", "Award Declared"].some(k => s.status.includes(k)))
    .reduce((s, c) => s + c.count, 0);

  return (
    <AppPage>
      <SectionTitle
        eyebrow="Tamil Nadu Land Acquisition Intelligence"
        title="Portfolio Analytics & Delay Trends"
        detail={`Deep dive into root causes, litigation hubs, and district-level delivery timelines across ${summary?.total_cases?.toLocaleString() ?? "…"} cases.`}
        action={<Button variant="outline" onClick={() => window.print()}><Download size={14} /> Export Report</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avg. Delay Duration" value={avgDelay} note="Across all delayed acquisition fronts" icon={Clock3} tone="red" />
        <StatCard label="Primary Root Cause" value={topCause} note={topCausePct || "Top delay driver"} icon={ShieldAlert} tone="amber" />
        <StatCard label="Cases in Litigation" value={litigatedCases} note="High Court & Tribunals" icon={Scale} tone="violet" />
        <StatCard label="Completed Acquisitions" value={completedCount || (loading ? "…" : 0)} note="Possession taken or awarded" icon={CheckCircle2} tone="green" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {/* Root Cause Distribution — real data */}
        <Surface className="p-5">
          <div className="eyebrow">Root Cause Distribution</div>
          <h2 className="mt-1 text-sm font-bold text-slate-200">
            Primary Delay Factors in Tamil Nadu
            {topCauseTotal > 0 && <span className="ml-2 text-slate-500 font-normal">({topCauseTotal.toLocaleString()} cases)</span>}
          </h2>
          {loading ? (
            <div className="mt-5 flex h-72 items-center justify-center text-xs text-slate-500">Loading delay cause data…</div>
          ) : delayCauses.length === 0 ? (
            <div className="mt-5 flex h-72 items-center justify-center text-xs text-slate-500">No delay cause data available</div>
          ) : (
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delayCauses} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid stroke="#243148" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#71819a" }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ background: "#111b2c", border: "1px solid #2a3d58", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#4dd9eb" radius={[0, 4, 4, 0]}>
                    {delayCauses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        {/* District Comparison — real data */}
        <Surface className="p-5">
          <div className="eyebrow">District Comparison</div>
          <h2 className="mt-1 text-sm font-bold text-slate-200">Delayed vs On-Time Cases by District</h2>
          {loading ? (
            <div className="mt-5 flex h-72 items-center justify-center text-xs text-slate-500">Loading district data…</div>
          ) : (
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liveDistrictData}>
                  <CartesianGrid stroke="#243148" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111b2c", border: "1px solid #2a3d58", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="delayed" name="Delayed Cases" fill="#fb7185" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ontime" name="On Time Cases" fill="#4dd9eb" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>
      </div>

      {/* Status Distribution — real case statuses */}
      {statusDist.length > 0 && (
        <Surface className="mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
            <div>
              <div className="eyebrow">Case Status Distribution</div>
              <h2 className="mt-1 text-sm font-bold text-slate-200">Status Breakdown across Tamil Nadu</h2>
            </div>
          </div>
          <div className="h-56 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDist}>
                <CartesianGrid stroke="#243148" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 9, fill: "#71819a" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71819a" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111b2c", border: "1px solid #2a3d58", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill="#4dd9eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Surface>
      )}
    </AppPage>
  );
}

export function ReportsPage() {
  const { toast, message, close } = useToastState();
  const [generated, setGenerated] = useState<string[]>([]);

  const reports = [
    ["Tamil Nadu Land Acquisition Delay Register", "Comprehensive status of all monitored cases across 20 districts", "Updated 4 Sept 2026", "Risk"],
    ["High Court & Tribunal Litigation Digest", "Active writ petitions and stays at High Court of Madras & NGT", "Updated 3 Sept 2026", "Legal"],
    ["R&R & Affected Families Compensation Brief", "Compensation disbursements, objections, and Section 19 awards", "Updated 1 Sept 2026", "Finance"],
    ["Executive Infrastructure Delivery Confidence", "One-page executive briefing for Tamil Nadu state leadership", "Updated 28 Aug 2026", "Executive"],
  ];

  const act = (name: string, action: string) => {
    setGenerated(g => (g.includes(name) ? g : g.concat(name)));
    toast(`${name} ${action}`);
  };

  return (
    <AppPage>
      <SectionTitle
        eyebrow="Government Reporting / Briefing Room"
        title="Land Acquisition Reports"
        detail="Generate authoritative briefs for District Collectors, High Court counsel, and Project Directors."
        action={<Button onClick={() => act("State LA Register", "generation started")}><Plus size={14} /> Generate Custom Report</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map(([name, detail, date, tag]) => (
          <motion.div variants={item} initial="hidden" animate="show" key={name} className="glass-hover glass rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <FileText size={19} />
              </div>
              <Badge tone={tag === "Legal" ? "red" : tag === "Finance" ? "amber" : "cyan"}>{tag}</Badge>
            </div>
            <h2 className="mt-5 text-sm font-bold text-slate-200">{name}</h2>
            <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{detail}</p>
            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="mono text-[10px] text-slate-600">{date}</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => act(name, "exported")}><Send size={13} /> Export</Button>
                <Button
                  variant={generated.includes(name) ? "outline" : "primary"}
                  onClick={() => act(name, generated.includes(name) ? "downloaded" : "generated")}
                >
                  {generated.includes(name) ? <Download size={13} /> : <Sparkles size={13} />} {generated.includes(name) ? "Download" : "Generate"}
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}

export function SettingsPage() {
  const { toast, message, close } = useToastState();
  const [tab, setTab] = useState("Profile");
  const [saved, setSaved] = useState(false);
  const { user, signOutOfficer, isConfigured } = useAuth();
  const { theme, setTheme, systemTheme } = useTheme();
  const activeTheme = theme === "system" ? systemTheme : theme;
  const isDark = activeTheme === "dark" || !activeTheme;

  const [mlStatus, setMlStatus] = useState<MlStatusResponse | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState<any>(null);

  useEffect(() => {
    if (tab === "System" && !mlStatus) {
      setMlLoading(true);
      getMlStatus()
        .then(res => { setMlStatus(res); setMlLoading(false); })
        .catch(() => setMlLoading(false));
    }
  }, [tab, mlStatus]);

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainResult(null);
    try {
      const res = await triggerSafeRetrain();
      setRetrainResult(res);
      if (res.status === "deployed" || res.status === "DEPLOYED") {
        toast("Candidate model passed all gates and was deployed to production!");
      } else {
        toast("Retraining complete. Candidate model rejected by safety gates; production preserved.");
      }
      const updated = await getMlStatus();
      setMlStatus(updated);
    } catch (err: any) {
      toast("ML retraining pipeline encountered an error.");
    } finally {
      setRetraining(false);
    }
  };

  const tabs = ["Profile", "Notifications", "Appearance", "System"];

  return (
    <AppPage>
      <SectionTitle
        eyebrow="System Controls"
        title="Workspace Settings"
        detail="Manage Tamil Nadu land acquisition portal preferences, visual theme, and ML governance."
        action={
          <Button onClick={() => { setSaved(true); toast("Workspace preferences synchronized."); }}>
            <Check size={14} /> {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        <Surface className="h-fit p-2">
          <div className="space-y-1">
            {tabs.map(x => (
              <button
                key={x}
                data-testid={`button-settings-tab-${x.toLowerCase()}`}
                onClick={() => setTab(x)}
                className={`w-full rounded-md px-3 py-2.5 text-left text-xs font-bold transition ${
                  tab === x
                    ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-200 font-extrabold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/[.04] hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {x}
              </button>
            ))}
          </div>
        </Surface>

        <Surface className="p-5 md:p-7">
          {tab === "Profile" && (
            <div>
              <div className="eyebrow">Desk Identity & Authentication</div>
              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">Authenticated Officer Session</h2>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/40 p-4">
                <div className="flex items-center gap-4">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Officer" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full border-2 border-cyan-400 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/20 text-lg font-bold text-cyan-600 dark:text-cyan-200 border border-cyan-400/40">
                      {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : "TN"}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{user?.displayName || "Special Land Acquisition Officer"}</div>
                    <div className="text-xs text-cyan-600 dark:text-cyan-300 font-semibold">{user?.email || "officer@tngov.acquisight.in"}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      <span>Google OAuth · Verified Officer Terminal</span>
                    </div>
                  </div>
                </div>
                <button
                  data-testid="button-settings-signout"
                  onClick={async () => {
                    await signOutOfficer();
                    window.location.href = "/login";
                  }}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-500 dark:text-rose-300 hover:bg-rose-500/20 transition"
                >
                  Sign Out
                </button>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <Field label="Designation" value="Special District Revenue Officer (LA)" onChange={() => {}} placeholder="" test="input-profile-name" />
                <Field label="Department" value="Revenue & Disaster Management Department, Govt of Tamil Nadu" onChange={() => {}} placeholder="" test="input-profile-email" />
                <Field label="State Jurisdiction" value="Tamil Nadu (All 38 Districts / Chennai HQ)" onChange={() => {}} placeholder="" test="input-profile-role" />
                <Field label="Timezone & Auth Mode" value={`Asia/Kolkata (IST) · ${isConfigured ? "Firebase Cloud OAuth" : "Firebase Terminal Auth"}`} onChange={() => {}} placeholder="" test="input-profile-timezone" />
              </div>
            </div>
          )}

          {tab === "Notifications" && (
            <SettingsList
              title="Alert Routing"
              eyebrow="Notifications"
              items={[
                ["High Court of Madras Stay Notices", "Immediate notifications for stay orders or interim injunctions", true],
                ["Delay Threshold SLA Alerts", "Alert when a case exceeds 90 days delay past scheduled date", true],
                ["SIA & Clearance Gaps", "Reminders for pending environmental or coastal clearances", true],
                ["Weekly District Delay Summary", "Friday digest of cases resolved and escalated", false],
              ]}
            />
          )}

          {tab === "Appearance" && (
            <div>
              <div className="eyebrow">Visual Theme</div>
              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">Workspace Appearance & Mode</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Switch between high-contrast Dark Command Mode and crisp Day Light Mode. Preferences are persisted across sessions.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <button
                  data-testid="button-theme-dark"
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-3 rounded-xl border p-4 transition text-center ${
                    theme === "dark" || (theme === "system" && isDark)
                      ? "border-cyan-400 bg-cyan-400/10 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-white/[.02] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <div className="rounded-full bg-slate-900 p-3 text-cyan-300 border border-slate-700">
                    <Moon size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Dark Command</div>
                    <div className="text-[10px] text-slate-500">Night-shift tactical mode</div>
                  </div>
                </button>

                <button
                  data-testid="button-theme-light"
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-3 rounded-xl border p-4 transition text-center ${
                    theme === "light"
                      ? "border-cyan-400 bg-cyan-400/10 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-white/[.02] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <div className="rounded-full bg-amber-100 p-3 text-amber-600 border border-amber-300">
                    <Sun size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Daylight Mode</div>
                    <div className="text-[10px] text-slate-500">High ambient light view</div>
                  </div>
                </button>

                <button
                  data-testid="button-theme-system"
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-3 rounded-xl border p-4 transition text-center ${
                    theme === "system"
                      ? "border-cyan-400 bg-cyan-400/10 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-white/[.02] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <div className="rounded-full bg-slate-200 dark:bg-slate-800 p-3 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Follow System</div>
                    <div className="text-[10px] text-slate-500">Match OS settings</div>
                  </div>
                </button>
              </div>

              <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-white/[.02] p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-200">Current Active Mode</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">System is currently rendering in {isDark ? "Dark" : "Light"} mode.</div>
                </div>
                <button
                  data-testid="button-toggle-dark-mode"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  className={`relative h-6 w-11 rounded-full transition ${isDark ? "bg-cyan-400" : "bg-slate-400"}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white dark:bg-slate-950 transition ${isDark ? "left-6" : "left-1"}`} />
                </button>
              </div>
            </div>
          )}

          {tab === "System" && (
            <div className="space-y-6">
              {/* Machine Learning Model Pipeline Management */}
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/[.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan-400/20 pb-4">
                  <div>
                    <div className="eyebrow text-cyan-600 dark:text-cyan-300">ML Governance & Model Integrity</div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Safe Model Retraining Pipeline</h2>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                      Automated candidate model training with strict outcome verification, candidate validation gates, and zero-downtime rollback.
                    </p>
                  </div>
                  <button
                    data-testid="button-trigger-ml-retrain"
                    disabled={retraining}
                    onClick={handleRetrain}
                    className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50"
                  >
                    {retraining ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Evaluating Candidate...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        Trigger Safe Retrain
                      </>
                    )}
                  </button>
                </div>

                {mlLoading && (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Querying ML model metadata from backend...
                  </div>
                )}

                {mlStatus && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-slate-100/80 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Active Model</div>
                        <div className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{mlStatus.active_model_name}</div>
                        <div className="text-[10px] mono text-cyan-600 dark:text-cyan-400 font-semibold">{mlStatus.active_version}</div>
                      </div>
                      <div className="rounded-lg bg-slate-100/80 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Verified Training Cases</div>
                        <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-300">{mlStatus.verified_training_samples}</div>
                        <div className="text-[10px] text-slate-500">Possession outcomes verified</div>
                      </div>
                      <div className="rounded-lg bg-slate-100/80 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Excluded (In-Progress)</div>
                        <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-300">{mlStatus.excluded_unverified_cases}</div>
                        <div className="text-[10px] text-slate-500">Zero target leakage</div>
                      </div>
                      <div className="rounded-lg bg-slate-100/80 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Performance (RMSE / R²)</div>
                        <div className="mt-1 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                          {mlStatus.current_rmse_days} days · R² {mlStatus.current_r2_score}
                        </div>
                        <div className="text-[10px] text-slate-500">Trained: {new Date(mlStatus.last_retrained).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs text-slate-600 dark:text-slate-400">
                      <div className="font-bold text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-cyan-400" />
                        Candidate Validation & Deployment Criteria
                      </div>
                      <div className="mt-1.5 grid gap-2 sm:grid-cols-2 text-[11px] text-slate-400">
                        <div>• Only cases with verified final possession outcomes are admitted into training.</div>
                        <div>• Candidate models must beat or match production RMSE within 5% tolerance.</div>
                        <div>• Minimum candidate cross-validation R² must exceed 0.65.</div>
                        <div>• Production model backup is captured before any atomic model replacement.</div>
                      </div>
                    </div>

                    {retrainResult && (
                      <div className={`rounded-lg border p-4 text-xs ${
                        retrainResult.status === "DEPLOYED"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      }`}>
                        <div className="font-bold flex items-center gap-2">
                          {retrainResult.status === "DEPLOYED" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                          Retraining Result: {retrainResult.status === "DEPLOYED" ? "Candidate Deployed" : "Production Maintained"}
                        </div>
                        <p className="mt-1 text-slate-300">{retrainResult.message}</p>
                        <div className="mt-2 flex flex-wrap gap-4 mono text-[10px]">
                          <span>Candidate RMSE: {retrainResult.candidate_metrics?.rmse_days} days</span>
                          <span>Candidate R²: {retrainResult.candidate_metrics?.r2_score}</span>
                          <span>Production RMSE: {retrainResult.production_metrics?.rmse_days} days</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Standard Engine Features */}
              <SettingsList
                title="Statutory Rules & Integrity Sync"
                eyebrow="Engine"
                items={[
                  ["Runtime Excel Sync", "Automatically ingest fresh data from tn_land_acquisition_dataset.xlsx", true],
                  ["RFCTLARR 2013 Compliance Rulebook", "Validate acquisition milestones against statutory 12-month SLA", true],
                  ["Audit Trail Logging", "Record all status modifications, case intakes, and model retrains", true],
                ]}
              />
            </div>
          )}
        </Surface>
      </div>
      {message && <Toast message={message} onClose={close} />}
    </AppPage>
  );
}

function SettingsList({ title, eyebrow, items }: { title: string; eyebrow: string; items: [string, string, boolean][] }) {
  const [states, setStates] = useState(items.map(x => x[2]));
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-1 text-lg font-bold text-slate-100">{title}</h2>
      <div className="mt-6 divide-y divide-slate-800/70">
        {items.map(([name, detail], i) => (
          <div key={name} className="flex items-center justify-between gap-4 py-4">
            <div>
              <div className="text-sm font-bold text-slate-300">{name}</div>
              <div className="mt-1 text-xs text-slate-500">{detail}</div>
            </div>
            <button
              data-testid={`button-toggle-${name.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setStates(s => s.map((v, j) => (j === i ? !v : v)))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${states[i] ? "bg-cyan-300" : "bg-slate-700"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-slate-950 transition ${states[i] ? "left-6" : "left-1"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}