/**
 * api.ts
 * =======
 * Typed client for AcquiSight FastAPI ML & GIS Backend
 */

export interface LandPredictInput {
  // Numerical features
  area_sqft: number;
  soil_ph: number;
  no_of_owners: number;
  // Categorical features — must exactly match real LandRequest schema
  land_type: string;          // "Wet" | "Dry" | "Manavari"
  flood_risk: string;         // "Yes" | "No"
  water_availability: string; // "Yes" | "No"
  soil_type: string;          // "Red Soil" | "Black Soil" | "Alluvial Soil" | "Clay Soil"
  document_issue: string;     // "Available" | "Not Available"
  owner_objection: string;    // "Yes" | "No"
  court_case: string;         // "Yes" | "No"
  compensation_status: string;// real gazette values
  fmb: string;                // "Yes" | "No"
  a_register: string;         // "Yes" | "No"
  document_verified: string;  // "Yes" | "No"
  objection: string;          // "Yes" | "No"
  ownership_type: string;     // "Individual" | "Joint"
  // Optional identifiers (not used by model)
  land_id?: string;
  district?: string;
  taluk?: string;
  village?: string;
  survey_no?: string;
}

export interface RiskFactor {
  factor: string;
  impact: "High" | "Medium" | "Low";
  description: string;
}

export interface PredictionResult {
  land_id?: string;
  predicted_delay_days: number;
  predicted_delay_range: { lower: number; upper: number };
  risk_category: "Low" | "Medium" | "High";
  risk_score: number;
  risk_factors: RiskFactor[];
  recommendation: string;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ModelInfoResult {
  trained_at: string;
  winning_model: string;
  final_metrics: Record<string, any>;
  best_params: Record<string, any>;
}

export interface GisSummaryResult {
  total_parcels: number;
  districts: number;
  villages: number;
  avg_acquisition_days?: number | null;
  coordinate_note?: string;
}

export interface GisFiltersResult {
  districts: string[];
  taluks_by_district: Record<string, string[]>;
  risk_categories: string[];
  delay_status: string[];
}

export interface GisParcel {
  Land_ID: string;
  District: string;
  Taluk: string;
  Village: string;
  Survey_No: string;
  Extent_Hectares: number;
  Area_Sqft: number;
  Land_Type: string;
  Soil_Type: string;
  Acquisition_Days: number;
  Delay_Status: string;
  Predicted_Delay_Days: number;
  Predicted_Delay_Status: string;
  Predicted_Risk_Category: "Low" | "Medium" | "High";
  Predicted_Delay_Probability?: number;
  latitude: number;
  longitude: number;
  coord_source?: string;
}

export interface GisParcelsResponse {
  total: number;
  limit: number;
  offset: number;
  parcels: GisParcel[];
}

const API_BASE = "https://acquisight-kba3.onrender.com";

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err}`);
    }
    return await res.json();
  } catch (err: any) {
    // If backend is offline or network fails, throw informative message
    console.warn(`[AcquiSight API] Request to ${url} failed:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ML Prediction APIs
// ---------------------------------------------------------------------------

export async function predictDelayRisk(payload: LandPredictInput): Promise<PredictionResult> {
  return fetchJson<PredictionResult>("/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getFeatureImportance(): Promise<{ features: FeatureImportanceItem[] }> {
  return fetchJson<{ features: FeatureImportanceItem[] }>("/feature-importance");
}

export async function getModelInfo(): Promise<ModelInfoResult> {
  return fetchJson<ModelInfoResult>("/model-info");
}

// ---------------------------------------------------------------------------
// GIS APIs
// ---------------------------------------------------------------------------

export async function getGisSummary(): Promise<GisSummaryResult> {
  return fetchJson<GisSummaryResult>("/gis/summary");
}

export async function getGisFilters(): Promise<GisFiltersResult> {
  return fetchJson<GisFiltersResult>("/gis/filters");
}

export async function getGisParcels(params?: {
  district?: string;
  taluk?: string;
  land_use?: string;
  risk_category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<GisParcelsResponse> {
  const q = new URLSearchParams();
  if (params?.district && params.district !== "All Districts") q.set("district", params.district);
  if (params?.taluk && params.taluk !== "All Taluks") q.set("taluk", params.taluk);
  if (params?.land_use && params.land_use !== "All Land Uses") q.set("land_use", params.land_use);
  if (params?.risk_category && params.risk_category !== "All Risk Categories") q.set("risk_category", params.risk_category);
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  const qs = q.toString();
  return fetchJson<GisParcelsResponse>(`/gis/parcels${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Tamil Nadu Cases APIs
// ---------------------------------------------------------------------------

export interface TnCasesResponse {
  total: number;
  limit: number;
  offset: number;
  cases: any[];
}

export async function getTnCasesSummary(): Promise<any> {
  return fetchJson<any>("/cases/summary");
}

export async function getTnCases(params?: {
  district?: string;
  delay_status?: string;
  sector?: string;
  has_litigation?: boolean;
  risk_category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<TnCasesResponse> {
  const q = new URLSearchParams();
  if (params?.district && params.district !== "All Districts") q.set("district", params.district);
  if (params?.delay_status && params.delay_status !== "All") q.set("delay_status", params.delay_status);
  if (params?.sector && params.sector !== "All Sectors") q.set("sector", params.sector);
  if (params?.has_litigation !== undefined) q.set("has_litigation", String(params.has_litigation));
  if (params?.risk_category && params.risk_category !== "All Risk Categories") {
    q.set("risk_category", params.risk_category);
  }
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  const qs = q.toString();
  return fetchJson<TnCasesResponse>(`/cases${qs ? `?${qs}` : ""}`);
}

export async function getDashboardSummary(): Promise<{
  total_cases: number;
  delayed_cases: number;
  moderate_delay_cases: number;
  on_time_cases: number;
  litigated_cases: number;
  completed_cases: number;
  total_families_affected: number;
  total_area_ha: number;
  total_cost_cr: number;
  avg_delay_days: number;
  monitored_districts_count: number;
  district_delay_ranking: Array<{
    district: string;
    total: number;
    delayed: number;
    litigated: number;
    avg_delay_days: number;
    area_ha: number;
  }>;
}> {
  return fetchJson("/dashboard/summary");
}

export async function getAlerts(limit: number = 20): Promise<Array<{
  id: string;
  caseId: string;
  case_id: string;
  district: string;
  title: string;
  detail: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  time: string;
  type: "Legal" | "Timeline" | "Clearance";
}>> {
  return fetchJson(`/alerts?limit=${limit}`);
}

export async function getAnalyticsDistricts(): Promise<Array<{
  district: string;
  total: number;
  delayed: number;
  litigated: number;
  avg_delay_days: number;
  area_ha: number;
}>> {
  return fetchJson("/analytics/districts");
}

export async function getAnalyticsRiskDistribution(): Promise<{
  risk_distribution: Array<{ name: string; value: number }>;
  delay_distribution: Array<{ name: string; value: number }>;
  sector_distribution: Array<{ name: string; value: number }>;
}> {
  return fetchJson("/analytics/risk-distribution");
}

export async function createBackendCase(caseData: any): Promise<{ success: boolean; case: any }> {
  return fetchJson("/cases", {
    method: "POST",
    body: JSON.stringify(caseData),
  });
}

export async function getTnCaseById(caseId: string): Promise<any> {
  return fetchJson<any>(`/cases/${encodeURIComponent(caseId)}`);
}

// ---------------------------------------------------------------------------
// Analytics — Delay Causes & Status Distribution
// ---------------------------------------------------------------------------

export async function getAnalyticsDelayCauses(
  limit: number = 12
): Promise<Array<{ name: string; count: number }>> {
  return fetchJson(`/analytics/delay-causes?limit=${limit}`);
}

export async function getAnalyticsStatusDistribution(): Promise<
  Array<{ status: string; count: number }>
> {
  return fetchJson("/analytics/status-distribution");
}

export interface ActionItem {
  id: string;
  title: string;
  caseId: string;
  case_id: string;
  district: string;
  owner: string;
  due: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  detail: string;
  type: "Legal" | "Timeline" | "Clearance";
}

export async function getActions(limit: number = 20): Promise<ActionItem[]> {
  return fetchJson(`/actions?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Operational Case Updates & Excel Export
// ---------------------------------------------------------------------------

export async function updateBackendCase(caseId: string, updates: any): Promise<{ success: boolean; case: any }> {
  return fetchJson(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export function getExcelExportUrl(): string {
  return `${API_BASE}/cases/export/excel`;
}

// ---------------------------------------------------------------------------
// Explainable AI & Risk Breakdown
// ---------------------------------------------------------------------------

export interface ModelRiskFactor {
  source: "ML_MODEL";
  factor: string;
  weight: number;
  // Display fields used in UI
  model_weight_pct: number;
  contribution_direction: "increases_risk" | "reduces_risk" | "neutral";
  feature_value: string | number | null;
  description: string;
  // Legacy
  value?: string;
  impact?: "High" | "Medium" | "Low";
  explanation?: string;
}

export interface StatutoryRuleFactor {
  source: "STATUTORY_RULE";
  rule_name: string;
  // Display fields
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  legal_basis: string;
  condition_matched: string;
  impact: string;
  // Legacy
  statutory_ref?: string;
  value?: string;
  explanation?: string;
}

export interface RiskExplanationResponse {
  case_id: string;
  risk_category: string;
  risk_score: number;
  predicted_delay_days: number;
  confidence_score: number;
  model_type: string;
  delay_status: string;
  ml_model_factors: ModelRiskFactor[];
  statutory_business_rules: StatutoryRuleFactor[];
  summary_narrative: string;
  disclaimer: string;
  data_availability_note?: string;
  // Legacy
  model_derived_factors?: ModelRiskFactor[];
}

export async function getRiskExplanation(caseId: string): Promise<RiskExplanationResponse> {
  return fetchJson<RiskExplanationResponse>(`/cases/${encodeURIComponent(caseId)}/risk-explanation`);
}

// ---------------------------------------------------------------------------
// Grounded AI Chatbot
// ---------------------------------------------------------------------------

export interface ChatQueryPayload {
  message: string;
  case_id?: string;
  conversation_id?: string;
}

export interface ChatResponse {
  reply: string;
  citations: string[];
  suggested_actions: string[];
  provider: string;
  case_id?: string;
}

export async function sendChatMessage(payload: ChatQueryPayload): Promise<ChatResponse> {
  return fetchJson<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Safe ML Retraining Pipeline
// ---------------------------------------------------------------------------

export interface MlStatusResponse {
  model_version: string;
  trained_at: string;
  winning_regressor: string;
  current_production_metrics: Record<string, any>;
  total_operational_cases: number;
  eligible_labeled_cases: number;
  unlabeled_excluded_cases: number;
  eligibility_policy: string;
  // UI display helpers (computed or returned by backend)
  active_model_name: string;
  active_version: string;
  verified_training_samples: number;
  excluded_unverified_cases: number;
  current_rmse_days: number;
  current_r2_score: number;
  last_retrained: string;
}

export async function getMlStatus(): Promise<MlStatusResponse> {
  return fetchJson<MlStatusResponse>("/ml/status");
}

export async function triggerSafeRetrain(): Promise<{
  status: "deployed" | "rejected_inferior_performance" | "DEPLOYED" | "REJECTED";
  message: string;
  deployed_version?: string;
  previous_version?: string;
  metrics?: Record<string, any>;
  candidate_metrics?: { rmse_days: number; r2_score: number };
  production_metrics?: { rmse_days: number; r2_score: number };
  training_samples?: number;
  new_eligible_samples?: number;
}> {
  return fetchJson("/admin/ml/retrain", {
    method: "POST",
  });
}
