import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Brain,
  Layers,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  HelpCircle,
  FileCheck,
  Scale
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Shell } from "@/components/shell";
import {
  predictDelayRisk,
  getFeatureImportance,
  type LandPredictInput,
  type PredictionResult,
  type FeatureImportanceItem
} from "@/lib/api";

const DEFAULT_INPUT: LandPredictInput = {
  area_sqft: 15000,
  soil_ph: 7.2,
  no_of_owners: 1,
  land_type: "Dry",
  flood_risk: "No",
  water_availability: "Yes",
  soil_type: "Red Soil",
  document_issue: "Available",
  owner_objection: "No",
  court_case: "No",
  compensation_status: "To be paid",
  fmb: "Yes",
  a_register: "Yes",
  document_verified: "Yes",
  objection: "No",
  ownership_type: "Individual",
  land_id: "TN-LND-2026",
  district: "Kancheepuram",
};

const RISK_MODES_CONFIG = [
  { id: "screening", label: "Screening", threshold: 10, precision: "60.1%", recall: "99.1%", desc: "Screening (10% Cut-off): Max sensitivity to detect any potential delay" },
  { id: "early_warning", label: "Early Warning", threshold: 25, precision: "68.2%", recall: "94.5%", desc: "Early Warning (25% Cut-off): Proactive statutory review prior to Sec 15" },
  { id: "balanced", label: "Balanced (Default)", threshold: 50, precision: "78.9%", recall: "83.4%", desc: "Balanced (50% Cut-off): Standard operational monitoring baseline" },
  { id: "escalation", label: "Escalation", threshold: 75, precision: "85.4%", recall: "66.8%", desc: "Escalation (75% Cut-off): High confidence before resource allocation" },
  { id: "high_confidence", label: "High Confidence", threshold: 90, precision: "92.1%", recall: "45.3%", desc: "High Confidence (90% Cut-off): District Collector level priority" },
] as const;

type RiskModeKey = (typeof RISK_MODES_CONFIG)[number]["id"];

export function RiskPredictorPage() {
  const [formData, setFormData] = useState<LandPredictInput>(DEFAULT_INPUT);
  const [riskMode, setRiskMode] = useState<RiskModeKey>("balanced");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [importance, setImportance] = useState<FeatureImportanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [lifecycleStage, setLifecycleStage] = useState("Sec 15 Objections & Hearings");
  const [rehabStatus, setRehabStatus] = useState("Scheme Gazetted");
  const [consentPct, setConsentPct] = useState(75);
  const [compAcceptancePct, setCompAcceptancePct] = useState(80);

  // Load feature importance once
  useEffect(() => {
    getFeatureImportance()
      .then((res) => {
        if (res.features) {
          setImportance(
            res.features.slice(0, 8).map((f) => ({
              ...f,
              importance: Number((f.importance * 100).toFixed(1)),
            }))
          );
        }
      })
      .catch(() => {});
    // Initial prediction
    handlePredict(DEFAULT_INPUT, "balanced");
  }, []);

  const validate = (data: LandPredictInput): boolean => {
    const errs: Record<string, string> = {};
    if (!data.area_sqft || data.area_sqft <= 0) {
      errs.area_sqft = "Area must be greater than 0 sq.ft";
    }
    if (data.no_of_owners == null || data.no_of_owners < 1) {
      errs.no_of_owners = "Number of owners must be at least 1";
    }
    if (data.soil_ph == null || data.soil_ph < 0 || data.soil_ph > 14) {
      errs.soil_ph = "Soil pH must be between 0 and 14";
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePredict = async (dataToPredict: LandPredictInput, modeOverride?: RiskModeKey) => {
    if (!validate(dataToPredict)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const activeMode = modeOverride ?? riskMode;
      const res = await predictDelayRisk({ ...dataToPredict, risk_mode: activeMode });
      setPrediction(res);
    } catch (err: any) {
      console.error(err);
      setError("Prediction unavailable");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: keyof LandPredictInput, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2 text-cyan-400">
            <Brain size={14} /> Machine Learning Decision Engine
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
            AI Land Delay Risk Predictor
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Trained Random Forest model predicting expected acquisition timeline delays, 90% confidence intervals, and key risk drivers.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
          <Sparkles size={13} className="animate-spin" /> Random Forest Pipeline Active
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Form Inputs */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-md xl:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200">Parcel Parameters & Risk Signals</h2>
            <button
              onClick={() => {
                setFormData(DEFAULT_INPUT);
                handlePredict(DEFAULT_INPUT);
              }}
              className="text-xs text-slate-400 hover:text-cyan-300"
            >
              Reset to Defaults
            </button>
          </div>

          <form
            id="predictor-form"
            onSubmit={(e) => {
              e.preventDefault();
              handlePredict(formData);
            }}
            className="mt-5 space-y-5"
          >
            {/* Numerical Row 1 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Area (sq.ft)</label>
                <input
                  type="number"
                  value={formData.area_sqft}
                  onChange={(e) => updateField("area_sqft", Number(e.target.value))}
                  className={`mt-1.5 h-10 w-full rounded-md border ${validationErrors.area_sqft ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-700"} bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400`}
                />
                {validationErrors.area_sqft && (
                  <div className="mt-1 text-[10px] font-semibold text-rose-400">{validationErrors.area_sqft}</div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">No. of Owners</label>
                <input
                  type="number"
                  value={formData.no_of_owners}
                  onChange={(e) => updateField("no_of_owners", Number(e.target.value))}
                  className={`mt-1.5 h-10 w-full rounded-md border ${validationErrors.no_of_owners ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-700"} bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400`}
                />
                {validationErrors.no_of_owners && (
                  <div className="mt-1 text-[10px] font-semibold text-rose-400">{validationErrors.no_of_owners}</div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">Ownership Type</label>
                <select
                  value={formData.ownership_type}
                  onChange={(e) => updateField("ownership_type", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Individual</option>
                  <option>Joint</option>
                </select>
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg bg-slate-900/40 p-4 border border-slate-800">
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400">Soil pH</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {formData.soil_ph}
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="10"
                  step="0.1"
                  value={formData.soil_ph}
                  onChange={(e) => updateField("soil_ph", Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400">Land Type</span>
                </div>
                <select
                  value={formData.land_type}
                  onChange={(e) => updateField("land_type", e.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Wet</option>
                  <option>Dry</option>
                  <option>Manavari</option>
                </select>
              </div>
            </div>

            {/* Soil Type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Soil Type</label>
                <select
                  value={formData.soil_type}
                  onChange={(e) => updateField("soil_type", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Red Soil</option>
                  <option>Black Soil</option>
                  <option>Alluvial Soil</option>
                  <option>Clay Soil</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Flood Risk</label>
                <select
                  value={formData.flood_risk}
                  onChange={(e) => updateField("flood_risk", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Water Availability</label>
                <select
                  value={formData.water_availability}
                  onChange={(e) => updateField("water_availability", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>

            {/* Legal & Document flags */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Owner Objection</label>
                <select
                  value={formData.owner_objection}
                  onChange={(e) => updateField("owner_objection", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Court Case</label>
                <select
                  value={formData.court_case}
                  onChange={(e) => updateField("court_case", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Objection Filed</label>
                <select
                  value={formData.objection}
                  onChange={(e) => updateField("objection", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
            </div>

            {/* Documents & Compensation */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Document Issue</label>
                <select
                  value={formData.document_issue}
                  onChange={(e) => updateField("document_issue", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Available</option>
                  <option>Not Available</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Document Verified</label>
                <select
                  value={formData.document_verified}
                  onChange={(e) => updateField("document_verified", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Compensation Status</label>
                <select
                  value={formData.compensation_status}
                  onChange={(e) => updateField("compensation_status", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>To be paid</option>
                  <option>Verification completed</option>
                  <option>Withheld pending court</option>
                  <option>Verification pending</option>
                  <option>Objection enquiry</option>
                </select>
              </div>
            </div>

            {/* FMB & A-Register */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-400">FMB Available</label>
                <select
                  value={formData.fmb}
                  onChange={(e) => updateField("fmb", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">A-Register Available</label>
                <select
                  value={formData.a_register}
                  onChange={(e) => updateField("a_register", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>

            {/* SIH Statutory & Lifecycle Parameters */}
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  SIH Statutory & Rehabilitation Parameters
                </span>
                <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300">
                  RFCTLARR 2013
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Project Lifecycle Phase</label>
                  <select
                    value={lifecycleStage}
                    onChange={(e) => {
                      setLifecycleStage(e.target.value);
                      if (e.target.value.includes("Sec 15")) {
                        updateField("owner_objection", "Yes");
                        updateField("objection", "Yes");
                      } else {
                        updateField("owner_objection", "No");
                        updateField("objection", "No");
                      }
                    }}
                    className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200 outline-none focus:border-cyan-400"
                  >
                    <option>Sec 11(1) Preliminary Notification</option>
                    <option>Sec 4 Social Impact Assessment</option>
                    <option>Sec 15 Objections & Hearings</option>
                    <option>Sec 19 Declaration Scheme</option>
                    <option>Sec 23 & 30 Award Declaration</option>
                    <option>Sec 38 Final Possession & R&R</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Rehabilitation Status</label>
                  <select
                    value={rehabStatus}
                    onChange={(e) => setRehabStatus(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200 outline-none focus:border-cyan-400"
                  >
                    <option>Scheme Gazetted</option>
                    <option>Resettlement Site Allotted</option>
                    <option>Pending Local Hearing</option>
                    <option>Full R&R Compliance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Landowner Consent</span>
                    <span className="text-cyan-300 font-bold">{consentPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={consentPct}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setConsentPct(val);
                      if (val < 70) {
                        updateField("owner_objection", "Yes");
                        updateField("objection", "Yes");
                      }
                    }}
                    className="mt-1.5 w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                    <span>20% (Contested)</span>
                    <span>70% (Min SLA)</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Compensation Acceptance</span>
                    <span className="text-cyan-300 font-bold">{compAcceptancePct}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={compAcceptancePct}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCompAcceptancePct(val);
                      if (val >= 80) {
                        updateField("compensation_status", "Verification completed");
                      } else if (val < 50) {
                        updateField("compensation_status", "Withheld pending court");
                      }
                    }}
                    className="mt-1.5 w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                    <span>20% (Disputed)</span>
                    <span>80%</span>
                    <span>100% (Settled)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Configurable Risk Operating Mode & Threshold */}
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200">
                  Classification Operating Mode & Threshold
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  Cut-off: {RISK_MODES_CONFIG.find((m) => m.id === riskMode)?.threshold}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {RISK_MODES_CONFIG.map((m) => {
                  const isActive = riskMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setRiskMode(m.id);
                        if (prediction) {
                          handlePredict(formData, m.id);
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-md border p-2 text-center transition ${
                        isActive
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-300 font-bold shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                          : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-[10px]">{m.label}</span>
                      <span className="text-[9px] font-mono opacity-80 mt-0.5">P:{m.precision} | R:{m.recall}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                {RISK_MODES_CONFIG.find((m) => m.id === riskMode)?.desc}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-400 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Evaluating ML Pipeline...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Predict Acquisition Delay Risk
                </>
              )}
            </button>
          </form>
        </div>

        {/* Prediction Results & Explainability */}
        <div className="space-y-6 xl:col-span-5">
          {/* Main Risk Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="eyebrow text-slate-400">Prediction Output</div>
              {prediction && (
                <div className="flex items-center gap-2">
                  {prediction.delay_status && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                        prediction.delay_status === "Delayed"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {prediction.delay_status}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      prediction.risk_category === "High"
                        ? "bg-rose-500/20 text-rose-300"
                        : prediction.risk_category === "Medium"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {prediction.risk_category} Duration
                  </span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 mb-3 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                  <RefreshCw size={26} className="animate-spin" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Analyzing acquisition risk...</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Evaluating HistGradientBoosting classifier & ExtraTrees regressor on Tamil Nadu land records
                </p>
              </div>
            ) : error ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 mb-3">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-sm font-bold text-rose-200">Prediction unavailable</h3>
                <p className="mt-1.5 max-w-sm text-xs text-rose-300/80 leading-relaxed">
                  We couldn't generate a prediction for this case. Please verify the inputs and try again.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePredict(formData)}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 shadow transition hover:bg-cyan-300"
                  >
                    <RefreshCw size={13} /> Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("predictor-form")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
                  >
                    Review Inputs
                  </button>
                </div>
              </div>
            ) : prediction ? (
              <div className="mt-5 space-y-5">
                {/* Estimated Delay Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Estimated Delay</span>
                    <span className="font-mono text-[10px] text-slate-500">ExtraTrees Regressor</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-bold tracking-tight text-slate-100">
                      {prediction.predicted_delay_days.toFixed(0)}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">days</span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-amber-400/90">
                    Model estimate — actual duration may vary.
                  </p>
                  <div className="mt-1 text-xs text-cyan-300/80">
                    90% confidence interval: {prediction.predicted_delay_range.lower.toFixed(0)} -{" "}
                    {prediction.predicted_delay_range.upper.toFixed(0)} days
                  </div>
                </div>

                {/* Operating Precision & Classification Card */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Classification Operational Point</span>
                    <span className="font-mono text-[10px] text-cyan-400 font-bold uppercase">
                      {prediction.risk_mode_used || riskMode} Mode ({((prediction.threshold_used ?? 0.5) * 100).toFixed(0)}% Cut-off)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/70">
                    <span>Delay Probability:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {prediction.delay_status_probability !== undefined
                        ? `${(prediction.delay_status_probability * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/70 text-[11px]">
                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                      <div className="text-slate-400 text-[10px]">Empirical Precision</div>
                      <div className="font-bold text-slate-200 text-xs mt-0.5">
                        {prediction.threshold_metrics ? `${(prediction.threshold_metrics.precision * 100).toFixed(1)}%` : "78.9%"}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Confidence in delay flags</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                      <div className="text-slate-400 text-[10px]">Empirical Recall</div>
                      <div className="font-bold text-slate-200 text-xs mt-0.5">
                        {prediction.threshold_metrics ? `${(prediction.threshold_metrics.recall * 100).toFixed(1)}%` : "83.4%"}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Proportion of delays detected</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Evaluated on unseen land parcels. At the {prediction.risk_mode_used || riskMode} threshold, ~
                    {prediction.threshold_metrics ? `${(prediction.threshold_metrics.precision * 100).toFixed(0)}%` : "79%"} of flagged cases experience actual delay.
                  </p>
                </div>

                {/* Score Bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Risk Index</span>
                    <span className="font-bold text-slate-200">{prediction.risk_score} / 100</span>
                  </div>
                  <div className="mt-2 h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        prediction.risk_score > 60
                          ? "bg-rose-500"
                          : prediction.risk_score > 30
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${prediction.risk_score}%` }}
                    />
                  </div>
                </div>

                {/* Recommendation */}
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 text-xs leading-relaxed text-slate-300">
                  <div className="font-bold text-cyan-300">AI Recommendation</div>
                  <div className="mt-1">{prediction.recommendation}</div>
                </div>

                {/* Contributing Risk Factors */}
                <div>
                  <div className="text-xs font-bold text-slate-300">Identified Risk Drivers</div>
                  <div className="mt-2 space-y-2">
                    {prediction.risk_factors.map((rf, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-xs"
                      >
                        <span
                          className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            rf.impact === "High"
                              ? "bg-rose-500/20 text-rose-400"
                              : rf.impact === "Medium"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {rf.impact}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-200">{rf.factor}</div>
                          <div className="text-[11px] text-slate-400">{rf.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                Click Predict to compute delay forecast.
              </div>
            )}
          </div>

          {/* Feature Importance Chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-md">
            <div className="eyebrow text-slate-400">Model Interpretability</div>
            <h3 className="mt-1 text-sm font-bold text-slate-200">
              Top Delay Feature Contributions (%)
            </h3>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={importance} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} domain={[0, 'dataMax + 2']} />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={130}
                    tick={{ fontSize: 10, fill: "#cbd5e1" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="importance" fill="#38bdf8" radius={[0, 4, 4, 0]}>
                    {importance.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "#f43f5e" : index === 1 ? "#fb923c" : "#38bdf8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
