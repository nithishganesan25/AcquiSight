/**
 * data.ts
 * =======
 * Tamil Nadu Land Acquisition Intelligence Data Store.
 * Powered by tn_land_acquisition_dataset.xlsx.
 */

import { tnCases, type TnCase, type DelayEvent, type DisputeLitigation, type ClearanceItem, type MilestoneItem } from "./tn_data";

export type RiskLevel = "Low" | "Medium" | "High";
export type CaseStatus =
  | "Possession Taken"
  | "Award Declared"
  | "Completed"
  | "Objections Received"
  | "Consent Process End"
  | "Litigated"
  | "Initiated"
  | "SIA Completed"
  | "In review"
  | "Pending compensation"
  | "Legal hold"
  | "Ready for acquisition"
  | "Escalated";

export type AcquisitionCase = {
  id: string;
  ref: string;
  la_case_id: number;
  case_number: string;
  project_id: number;
  project_name: string;
  project_type: string;
  sector: string;
  implementing_agency: string;
  district: string;
  state: string;
  title: string;
  location: string;
  region: string;
  owner: string;
  landowners: number;
  area: string;
  total_area_ha: number;
  no_of_families_affected: number;
  rural_urban_mix: string;
  consent_required: boolean;
  consent_percentage: number | null;
  status: string;
  expected_possession_date: string | null;
  actual_possession_date: string | null;
  delay_days: number;
  delay_status: "Delayed" | "Moderate Delay" | "On time";
  primary_delay_reason: string;
  primary_delay_detail: string;
  has_litigation: boolean;
  litigation_forum: string;
  litigation_status: string;
  total_estimated_cost_cr: number;
  value: string;
  compensation_offered_cr: number;
  compensation_accepted_cr: number;
  objections_count: number;
  stakeholder_count: number;
  legalDispute: boolean;
  incompleteDocuments: boolean;
  compensationPending: boolean;
  daysPending: number;
  activeCourtCase: boolean;
  nextAction: string;
  delay_events: DelayEvent[];
  disputes: DisputeLitigation[];
  clearances: ClearanceItem[];
  milestones: MilestoneItem[];
  risk_level: RiskLevel;
  risk_score: number;
  updated: string;
  opened: string;
  acquisition_purpose?: string;
  larr_applicable?: boolean;
  notification_date?: string | null;
};

export type IntakeCase = {
  name: string;
  location: string;
  region: string;
  area: string;
  owner: string;
  landowners: string;
  dispute: boolean;
  documents: boolean;
  compensation: boolean;
};

export function mapTnToCase(c: any): AcquisitionCase {
  const isHighDelay = Number(c.delay_days || 0) > 90;
  const isLegal = Boolean(c.has_litigation || (c.disputes && c.disputes.length > 0));
  const isCompPending = Boolean((c.objections_count && c.objections_count > 0) || (c.primary_delay_reason && String(c.primary_delay_reason).toLowerCase().includes("compensation")));
  const isDocPending = Boolean(c.clearances && c.clearances.some((cl: any) => cl.status && (cl.status.toLowerCase().includes("process") || cl.status.toLowerCase().includes("pending"))));

  let nextAction = "Proceed with standard possession notification";
  if (isLegal) {
    nextAction = `File response before ${c.litigation_forum || "High Court of Madras"}`;
  } else if (c.objections_count > 0) {
    nextAction = `Conduct Section 15 hearing for ${c.objections_count} objections`;
  } else if (Number(c.delay_days || 0) > 90) {
    nextAction = `Expedite ${c.primary_delay_reason || "clearance"} review`;
  } else if (String(c.status || "").toLowerCase().includes("award")) {
    nextAction = "Disburse compensation tranches to verified landowners";
  }

  return {
    id: c.id,
    ref: c.case_number,
    la_case_id: c.la_case_id,
    case_number: c.case_number,
    project_id: c.project_id,
    project_name: c.project_name,
    project_type: c.project_type,
    sector: c.sector,
    implementing_agency: c.implementing_agency,
    district: c.district,
    state: c.state || "Tamil Nadu",
    title: `${c.project_name} [${c.case_number}]`,
    location: `${c.district}, Tamil Nadu`,
    region: c.district,
    owner: c.implementing_agency || "District Revenue Officer",
    landowners: c.no_of_families_affected || c.stakeholder_count || 12,
    area: `${c.total_area_ha} ha`,
    total_area_ha: c.total_area_ha,
    no_of_families_affected: c.no_of_families_affected,
    rural_urban_mix: c.rural_urban_mix,
    consent_required: c.consent_required,
    consent_percentage: c.consent_percentage,
    status: c.status,
    expected_possession_date: c.expected_possession_date,
    actual_possession_date: c.actual_possession_date,
    delay_days: c.delay_days,
    delay_status: c.delay_status,
    primary_delay_reason: c.primary_delay_reason,
    primary_delay_detail: c.primary_delay_detail,
    has_litigation: c.has_litigation,
    litigation_forum: c.litigation_forum,
    litigation_status: c.litigation_status,
    total_estimated_cost_cr: c.total_estimated_cost_cr,
    value: c.total_estimated_cost_cr ? `₹${c.total_estimated_cost_cr.toLocaleString()} Cr` : `₹${(c.total_area_ha * 1.8).toFixed(1)} Cr`,
    compensation_offered_cr: c.compensation_offered_cr,
    compensation_accepted_cr: c.compensation_accepted_cr,
    objections_count: c.objections_count,
    stakeholder_count: c.stakeholder_count,
    legalDispute: isLegal,
    incompleteDocuments: isDocPending,
    compensationPending: isCompPending,
    daysPending: c.delay_days || 45,
    activeCourtCase: isLegal,
    nextAction,
    delay_events: c.delay_events || [],
    disputes: c.disputes || [],
    clearances: c.clearances || [],
    milestones: c.milestones || [],
    risk_level: c.risk_level,
    risk_score: c.risk_score,
    updated: c.actual_possession_date || c.expected_possession_date || "Recent update",
    opened: c.notification_date || "2021-03-16",
    acquisition_purpose: c.acquisition_purpose || "Infrastructure Development",
    larr_applicable: c.larr_applicable ?? true,
    notification_date: c.notification_date || null,
  };
}

export const cases: AcquisitionCase[] = tnCases.map(mapTnToCase);

export function getAllCases(): AcquisitionCase[] {
  if (typeof window === "undefined") return cases;
  try {
    // Read locally-drafted cases from sessionStorage (written during CreateCase flow)
    const raw = window.sessionStorage.getItem("acquiSight_draftCases");
    if (!raw) return cases;
    const registered: AcquisitionCase[] = JSON.parse(raw);
    if (!registered || registered.length === 0) return cases;
    const existingIds = new Set(cases.map(c => c.id));
    const newCases = registered.filter(c => !existingIds.has(c.id));
    return [...newCases, ...cases];
  } catch {
    return cases;
  }
}

export function scoreCase(item: {
  risk_score?: number;
  risk_level?: RiskLevel;
  delay_days?: number;
  legalDispute?: boolean;
  incompleteDocuments?: boolean;
  compensationPending?: boolean;
  daysPending?: number;
  activeCourtCase?: boolean;
  has_litigation?: boolean;
}) {
  if (typeof item.risk_score === "number" && item.risk_level) {
    return { score: item.risk_score, level: item.risk_level };
  }
  const score =
    10 +
    (item.legalDispute || item.has_litigation ? 30 : 0) +
    (item.incompleteDocuments ? 15 : 0) +
    (item.compensationPending ? 20 : 0) +
    ((item.delay_days ?? item.daysPending ?? 0) > 90 ? 25 : 0) +
    (item.activeCourtCase ? 20 : 0);
  const capped = Math.min(100, score);
  const level: RiskLevel = capped >= 65 ? "High" : capped >= 35 ? "Medium" : "Low";
  return { score: capped, level };
}

// Extract real alerts from TN cases with litigation or high delays
export const alerts = [
  ...cases
    .filter(c => c.has_litigation && c.disputes.length > 0)
    .slice(0, 5)
    .map((c, i) => ({
      id: `alert-lit-${c.la_case_id}`,
      caseId: c.case_number,
      title: `Active dispute at ${c.litigation_forum || "High Court of Madras"}`,
      detail: c.disputes[0]?.outcome_summary || `Filing in progress: ${c.project_name} (${c.district})`,
      severity: "Critical" as const,
      time: c.disputes[0]?.filing_date ? `Filed ${c.disputes[0].filing_date}` : "Active",
      type: "Legal" as const,
    })),
  ...cases
    .filter(c => c.delay_days > 120 && !c.has_litigation)
    .slice(0, 5)
    .map((c, i) => ({
      id: `alert-del-${c.la_case_id}`,
      caseId: c.case_number,
      title: `Exceeded delay SLA: ${c.delay_days} days`,
      detail: `${c.primary_delay_reason}: ${c.primary_delay_detail} in ${c.district}`,
      severity: "High" as const,
      time: `${c.delay_days}d delayed`,
      type: "Timeline" as const,
    })),
];

export function buildCaseFromIntake(input: IntakeCase): AcquisitionCase {
  const daysPending = 0;
  const activeCourtCase = input.dispute;
  const numArea = parseFloat(input.area) || 10.5;
  return {
    id: `TN-LA-NEW-${Date.now().toString().slice(-4)}`,
    ref: `TN/LA/${input.region || "Chennai"}/NEW`,
    la_case_id: 9999,
    case_number: `TN/LA/${input.region || "Chennai"}/NEW`,
    project_id: 999,
    project_name: input.name || "New Infrastructure Acquisition",
    project_type: "Highway",
    sector: "Transport",
    implementing_agency: "Tamil Nadu Highways",
    district: input.location || input.region || "Chennai",
    state: "Tamil Nadu",
    title: input.name || "Untitled Acquisition Case",
    location: `${input.location || "Chennai"}, Tamil Nadu`,
    region: input.region || "Chennai",
    owner: input.owner || "District Revenue Officer",
    landowners: Number(input.landowners) || 15,
    area: input.area || "10.5 ha",
    total_area_ha: numArea,
    no_of_families_affected: Number(input.landowners) || 15,
    rural_urban_mix: "Mixed",
    consent_required: false,
    consent_percentage: null,
    status: "Initiated",
    expected_possession_date: "2026-12-31",
    actual_possession_date: null,
    delay_days: 0,
    delay_status: "On time",
    primary_delay_reason: input.dispute ? "Litigation" : "None",
    primary_delay_detail: input.dispute ? "Reported title dispute" : "Standard acquisition timeline",
    has_litigation: input.dispute,
    litigation_forum: input.dispute ? "District Court" : "None",
    litigation_status: input.dispute ? "Pending" : "None",
    total_estimated_cost_cr: Math.round(numArea * 1.5 * 100) / 100,
    value: `₹${(numArea * 1.5).toFixed(1)} Cr`,
    compensation_offered_cr: 0,
    compensation_accepted_cr: 0,
    objections_count: 0,
    stakeholder_count: Number(input.landowners) || 15,
    legalDispute: input.dispute,
    incompleteDocuments: input.documents,
    compensationPending: input.compensation,
    daysPending,
    activeCourtCase,
    nextAction: input.dispute ? "File representation before DRO" : "Issue Section 11(1) Notification",
    delay_events: [],
    disputes: [],
    clearances: [],
    milestones: [],
    risk_level: input.dispute ? "High" : "Low",
    risk_score: input.dispute ? 70 : 20,
    updated: "Just now",
    opened: "Today",
    acquisition_purpose: "Infrastructure Project",
    larr_applicable: true,
    notification_date: new Date().toISOString().split("T")[0],
  };
}

const draftCaseKey = "acquisight-draft-case";

export function saveDraftCase(item: AcquisitionCase) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(draftCaseKey, JSON.stringify(item));
  }
}

export function getDraftCase(): AcquisitionCase | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(draftCaseKey);
    return value ? (JSON.parse(value) as AcquisitionCase) : null;
  } catch {
    return null;
  }
}

export const navGroups = [
  {
    label: "Workspace",
    items: [
      ["Command Center", "/command-center", "CommandCenter"],
      ["Land Intelligence", "/land-intelligence", "Layers"],
      ["GIS Land Map", "/gis-map", "Globe2"],
      ["Risk Alerts", "/risk-alerts", "BellRing"],
    ],
  },
  {
    label: "Decisions & AI",
    items: [
      ["AI Risk Predictor", "/risk-predictor", "Sparkles"],
      ["Action Intelligence", "/action-intelligence", "ListChecks"],
      ["Analytics", "/analytics", "ChartNoAxesCombined"],
      ["Reports", "/reports", "FileBarChart"],
    ],
  },
];