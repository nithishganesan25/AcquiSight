import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GitCompare,
  TrendingUp,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Download,
  Building2,
  Clock3,
  Users,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Shell } from "@/components/shell";
import { SectionTitle, Surface, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  getAnalyticsComparative,
  type DistrictComparisonItem,
} from "@/lib/api";
import {
  KpiGridSkeleton,
  ChartSkeleton,
  RadarSkeleton,
  TableSkeleton,
  ComparativeEmptyState,
  NetworkErrorState,
} from "@/components/status-states";

const BORDER_CLASSES = [
  "border-l-cyan-400",
  "border-l-rose-400",
  "border-l-violet-400",
  "border-l-emerald-400",
  "border-l-amber-400",
];

const ALL_TN_DISTRICTS = [
  "Chennai",
  "Coimbatore",
  "Salem",
  "Madurai",
  "Kancheepuram",
  "Tiruchirappalli",
  "Tirunelveli",
  "Erode",
  "Vellore",
  "Cuddalore",
  "Dharmapuri",
  "Krishnagiri",
  "Thiruvallur",
  "Chengalpattu",
  "Thanjavur",
  "Dindigul",
  "Virudhunagar",
  "Namakkal",
  "Karur",
  "Villupuram",
];

const PRESETS = [
  { label: "Top 4 Volume", districts: ["Coimbatore", "Salem", "Chennai", "Madurai"] },
  { label: "High Litigation", districts: ["Chennai", "Salem", "Kancheepuram", "Tiruchirappalli"] },
  { label: "Southern Hubs", districts: ["Madurai", "Tirunelveli", "Dindigul", "Virudhunagar"] },
  { label: "Western Belt", districts: ["Coimbatore", "Salem", "Erode", "Namakkal"] },
];

const PALETTE = ["#38bdf8", "#fb7185", "#a78bfa", "#34d399", "#fbbf24"];

export function ComparativeAnalyticsPage() {
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([
    "Coimbatore",
    "Salem",
    "Chennai",
    "Madurai",
  ]);
  const [allDistrictsData, setAllDistrictsData] = useState<DistrictComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Fetch all comparative data once
    setLoading(true);
    setError(null);
    getAnalyticsComparative()
      .then((res) => {
        setAllDistrictsData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Comparative analytics load error:", err);
        setError("Unable to connect to AcquiSight services. The backend service is currently unavailable.");
        setLoading(false);
      });
  }, [retryCount]);

  // Filtered to selected districts
  const currentData = allDistrictsData.filter((d) =>
    selectedDistricts.some((s) => s.toLowerCase() === d.district.toLowerCase())
  );

  const toggleDistrict = (district: string) => {
    if (selectedDistricts.includes(district)) {
      setSelectedDistricts(selectedDistricts.filter((d) => d !== district));
    } else {
      if (selectedDistricts.length < 5) {
        setSelectedDistricts([...selectedDistricts, district]);
      }
    }
  };

  const applyPreset = (districts: string[]) => {
    setSelectedDistricts(districts);
  };

  // Comparative radar data
  const radarMetrics = [
    { subject: "Efficiency Score", key: "performance_score", max: 100 },
    { subject: "Completion Rate", key: "completion_rate_pct", max: 100 },
    { subject: "Comp. Clearance", key: "compensation_verified_pct", max: 100 },
    { subject: "Low Delay (100-Rate)", key: "inv_delay", max: 100 },
    { subject: "Low Litigation (100-Rate)", key: "inv_lit", max: 100 },
  ];

  const radarData = radarMetrics.map((m) => {
    const row: any = { subject: m.subject };
    currentData.forEach((d) => {
      if (m.key === "inv_delay") {
        row[d.district] = Math.max(0, 100 - d.delay_rate_pct);
      } else if (m.key === "inv_lit") {
        row[d.district] = Math.max(0, 100 - d.litigation_rate_pct);
      } else {
        row[d.district] = (d as any)[m.key] ?? 0;
      }
    });
    return row;
  });

  return (
    <Shell>
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        <SectionTitle
          eyebrow="SIH Comparative Land Analytics"
          title="Cross-District Performance & Delay Benchmarking"
          detail="Side-by-side acquisition velocity, legal friction indices, compensation disbursement rates, and bottleneck comparisons across Tamil Nadu."
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download size={14} className="mr-1.5" /> Export Benchmark
              </Button>
            </div>
          }
        />

        {/* District Selector & Quick Presets */}
        <Surface className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="eyebrow">District Benchmarking Selector</div>
              <p className="text-xs text-slate-400">
                Compare 2 to 5 districts side-by-side (
                <span className="text-cyan-300 font-semibold">{selectedDistricts.length} selected</span>)
              </p>
            </div>
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.districts)}
                  className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* District Pills */}
          <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
            {ALL_TN_DISTRICTS.map((district) => {
              const active = selectedDistricts.includes(district);
              return (
                <button
                  key={district}
                  onClick={() => toggleDistrict(district)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(74,215,239,0.15)]"
                      : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {active && <span className="mr-1.5">✓</span>}
                  {district}
                </button>
              );
            })}
          </div>
        </Surface>

        {error ? (
          <div className="mt-5">
            <NetworkErrorState
              detail={error}
              onRetry={() => setRetryCount((c) => c + 1)}
            />
          </div>
        ) : loading ? (
          <div className="mt-5 space-y-5">
            <KpiGridSkeleton count={selectedDistricts.length || 4} />
            <div className="grid gap-5 xl:grid-cols-2">
              <ChartSkeleton height="h-72" title="Delay Rate (%) vs. Litigation Rate (%)" />
              <RadarSkeleton />
            </div>
            <TableSkeleton rows={4} cols={6} />
          </div>
        ) : selectedDistricts.length < 2 ? (
          <div className="mt-5">
            <ComparativeEmptyState />
          </div>
        ) : (
          <>
            {/* Comparative Summary Cards */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {currentData.map((d, idx) => (
                <Surface key={d.district} className={`p-4 border-l-4 ${BORDER_CLASSES[idx % BORDER_CLASSES.length]}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-slate-100">{d.district}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        d.performance_score >= 60
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : d.performance_score >= 45
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      Index: {d.performance_score}/100
                    </span>
                  </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Total Cases</div>
                  <div className="font-bold text-slate-200 mt-0.5">{d.total_cases.toLocaleString()}</div>
                </div>
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Delay Rate</div>
                  <div className={`font-bold mt-0.5 ${d.delay_rate_pct > 60 ? "text-rose-400" : "text-amber-400"}`}>
                    {d.delay_rate_pct}%
                  </div>
                </div>
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Avg Delay</div>
                  <div className="font-bold text-slate-200 mt-0.5">{d.avg_delay_days}d</div>
                </div>
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Litigation %</div>
                  <div className={`font-bold mt-0.5 ${d.litigation_rate_pct > 50 ? "text-violet-400" : "text-slate-300"}`}>
                    {d.litigation_rate_pct}%
                  </div>
                </div>
              </div>
              <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span>Top Delay Driver:</span>
                <span className="font-semibold text-slate-200">{d.top_delay_driver}</span>
              </div>
            </Surface>
          ))}
        </div>

        {/* Charts Row */}
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {/* Bar Chart: Delay vs Litigation Rate */}
          <Surface className="p-5">
            <div className="eyebrow">Key Bottlenecks</div>
            <h2 className="mt-1 text-sm font-bold text-slate-200">
              Delay Rate (%) vs. Litigation Rate (%)
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="#243148" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="district" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71819a" }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="delay_rate_pct" name="Delayed Projects (%)" fill="#fb7185" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="litigation_rate_pct" name="Court Contested (%)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completion_rate_pct" name="Completed (%)" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>

          {/* Radar Chart: Holistic Capacity & Efficiency */}
          <Surface className="p-5">
            <div className="eyebrow">Multi-Dimensional Comparison</div>
            <h2 className="mt-1 text-sm font-bold text-slate-200">
              Composite District Performance Radar
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#243148" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#334155" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }} />
                  {currentData.map((d, idx) => (
                    <Radar
                      key={d.district}
                      name={d.district}
                      dataKey={d.district}
                      stroke={PALETTE[idx % PALETTE.length]}
                      fill={PALETTE[idx % PALETTE.length]}
                      fillOpacity={0.25}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        {/* Timeline & Area/Cost Comparison */}
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {/* Average Delay Days Comparison */}
          <Surface className="p-5">
            <div className="eyebrow">Timeline Friction</div>
            <h2 className="mt-1 text-sm font-bold text-slate-200">
              Average Acquisition Delay Duration (Days)
            </h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid stroke="#243148" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" unit="d" tick={{ fontSize: 10, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="district" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="avg_delay_days" name="Avg Delay Days" radius={[0, 4, 4, 0]}>
                    {currentData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={entry.avg_delay_days > 120 ? "#fb7185" : entry.avg_delay_days > 80 ? "#fbbf24" : "#38bdf8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>

          {/* Families Affected & Area Under Acquisition */}
          <Surface className="p-5">
            <div className="eyebrow">Social Impact & Scale</div>
            <h2 className="mt-1 text-sm font-bold text-slate-200">
              Families Affected vs Land Area (Hectares)
            </h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid stroke="#243148" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="district" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71819a" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="families_affected" name="Affected Families" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_area_ha" name="Area (ha)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        {/* Detailed Benchmark Comparison Table */}
        <Surface className="mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
            <div>
              <div className="eyebrow">Comprehensive Benchmark Table</div>
              <h2 className="mt-1 text-sm font-bold text-slate-200">
                Direct Side-by-Side Operational Comparison
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Performance Score</th>
                  <th className="py-3 px-4">Total Cases</th>
                  <th className="py-3 px-4">Delayed %</th>
                  <th className="py-3 px-4">Avg Delay</th>
                  <th className="py-3 px-4">Litigation %</th>
                  <th className="py-3 px-4">Completion %</th>
                  <th className="py-3 px-4">Comp. Verified %</th>
                  <th className="py-3 px-4">Primary Driver</th>
                  <th className="py-3 px-4">Strategic Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {currentData.map((row) => (
                  <tr key={row.district} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-100">{row.district}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${
                          row.performance_score >= 60
                            ? "bg-emerald-500/20 text-emerald-300"
                            : row.performance_score >= 45
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {row.performance_score}/100
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{row.total_cases.toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold text-rose-400">{row.delay_rate_pct}%</td>
                    <td className="py-3 px-4 font-mono">{row.avg_delay_days}d</td>
                    <td className="py-3 px-4 font-semibold text-violet-300">{row.litigation_rate_pct}%</td>
                    <td className="py-3 px-4 font-semibold text-emerald-400">{row.completion_rate_pct}%</td>
                    <td className="py-3 px-4 font-semibold text-cyan-300">{row.compensation_verified_pct}%</td>
                    <td className="py-3 px-4 font-medium text-slate-200">{row.top_delay_driver}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {row.litigation_rate_pct > 60
                        ? "Deploy dedicated High Court Special Bench & Legal Reps"
                        : row.top_delay_driver === "Objections"
                        ? "Host Sub-Divisional Conciliation Lok Adalat"
                        : row.compensation_verified_pct < 40
                        ? "Expedite Treasury RTGS Escrow Clearance"
                        : "Streamline Sec 19 Declaration Notices"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>

        {/* SIH Proactive Policy Recommendations */}
        <Surface className="mt-5 p-5 bg-gradient-to-r from-slate-900 via-[#0d162d] to-slate-900 border-cyan-500/30">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-cyan-500/20 p-3 text-cyan-300 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="eyebrow text-cyan-400">AI-Powered Predictive Governance Recommendations</div>
              <h3 className="mt-1 text-sm font-bold text-slate-100">
                District-Specific Action Plan Generated by AcquiSight
              </h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Based on historical regression and cross-district clustering of 20,000 cases, the system recommends:
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                  <div className="font-semibold text-cyan-300">1. Pre-Emptive Title Curing</div>
                  <div className="mt-1 text-slate-400 text-[11px] leading-normal">
                    Automate Patta & A-Register reconciliation prior to Section 11 notice to reduce title objections by up to 38%.
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                  <div className="font-semibold text-amber-300">2. Compensation Escrow Fast-Track</div>
                  <div className="mt-1 text-slate-400 text-[11px] leading-normal">
                    Direct RBI e-Kuber integration for award amounts reduces land possession holding delays from 119 to 42 days.
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                  <div className="font-semibold text-emerald-300">3. R&R Package Standardization</div>
                  <div className="mt-1 text-slate-400 text-[11px] leading-normal">
                    Enforce RFCTLARR 2013 2nd Schedule compliance upfront to secure consent above the statutory 70-80% threshold early.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Surface>
          </>
        )}
      </div>
    </Shell>
  );
}
