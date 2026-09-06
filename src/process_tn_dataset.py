"""
process_tn_dataset.py
=====================
Extracts and joins all sheets from tn_land_acquisition_dataset.xlsx:
- projects
- land_acquisition_cases
- process_milestones
- stakeholders
- clearances
- disputes_litigation
- delay_events
- geo_parcel

Outputs:
1. data/tn_cases_processed.json
2. frontend/src/lib/tn_data.ts
"""

import json
import math
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
EXCEL_PATH = DATA_DIR / "tn_land_acquisition_dataset.xlsx"

print(f"Loading {EXCEL_PATH}...")
xl = pd.ExcelFile(EXCEL_PATH)

cases_df = xl.parse("land_acquisition_cases")
projects_df = xl.parse("projects")
milestones_df = xl.parse("process_milestones")
stakeholders_df = xl.parse("stakeholders")
clearances_df = xl.parse("clearances")
disputes_df = xl.parse("disputes_litigation")
delays_df = xl.parse("delay_events")
parcels_df = xl.parse("geo_parcel")

print(f"Loaded: {len(cases_df)} cases, {len(projects_df)} projects, {len(delays_df)} delays, {len(disputes_df)} disputes")

def clean_val(val):
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        if math.isnan(val) or math.isinf(val):
            return None
        return round(float(val), 2)
    if isinstance(val, (pd.Timestamp, np.datetime64)):
        return str(val)[:10]
    return str(val)

# Index projects by project_id
projects_map = {}
for _, p in projects_df.iterrows():
    pid = int(p["project_id"])
    projects_map[pid] = {
        "project_id": pid,
        "project_name": str(p["project_name"]),
        "project_type": str(p["project_type"]),
        "sector": str(p["sector"]),
        "implementing_agency": str(p["implementing_agency"]),
        "state": str(p["state"]),
        "district": str(p["district"]),
        "total_land_required_ha": clean_val(p.get("total_land_required_ha")),
        "total_estimated_cost_cr": clean_val(p.get("total_estimated_cost_cr")),
        "project_start_date": clean_val(p.get("project_start_date")),
        "expected_completion_date": clean_val(p.get("expected_completion_date")),
        "project_status": str(p.get("status", "")),
    }

# Group delays by la_case_id
delays_by_case = {}
for _, d in delays_df.iterrows():
    cid = int(d["la_case_id"])
    if cid not in delays_by_case:
        delays_by_case[cid] = []
    delays_by_case[cid].append({
        "delay_event_id": int(d["delay_event_id"]),
        "delay_reason_category": str(d["delay_reason_category"]).replace("_", " "),
        "delay_reason_detail": str(d["delay_reason_detail"]),
        "start_date": clean_val(d.get("start_date")),
        "end_date": clean_val(d.get("end_date")),
        "delay_days": clean_val(d.get("delay_days")),
    })

# Group disputes by la_case_id
disputes_by_case = {}
for _, d in disputes_df.iterrows():
    cid = int(d["la_case_id"])
    if cid not in disputes_by_case:
        disputes_by_case[cid] = []
    disputes_by_case[cid].append({
        "dispute_id": int(d["dispute_id"]),
        "dispute_type": str(d["dispute_type"]),
        "forum": str(d["forum"]),
        "filing_date": clean_val(d.get("filing_date")),
        "current_status": str(d.get("current_status", "Pending")),
        "outcome_summary": str(d.get("outcome_summary", "")),
        "impact_on_delay_days": clean_val(d.get("impact_on_delay_days")),
    })

# Group clearances by la_case_id
clearances_by_case = {}
for _, c in clearances_df.iterrows():
    cid = int(c["la_case_id"])
    if cid not in clearances_by_case:
        clearances_by_case[cid] = []
    clearances_by_case[cid].append({
        "clearance_id": int(c["clearance_id"]),
        "clearance_type": str(c["clearance_type"]),
        "authority": str(c["authority"]),
        "application_date": clean_val(c.get("application_date")),
        "approval_date": clean_val(c.get("approval_date")),
        "status": str(c.get("status", "")),
        "conditions_imposed": clean_val(c.get("conditions_imposed")),
    })

# Group milestones by la_case_id
milestones_by_case = {}
for _, m in milestones_df.iterrows():
    cid = int(m["la_case_id"])
    if cid not in milestones_by_case:
        milestones_by_case[cid] = []
    milestones_by_case[cid].append({
        "milestone_id": int(m["milestone_id"]),
        "milestone_type": str(m["milestone_type"]).replace("_", " "),
        "milestone_date": clean_val(m.get("milestone_date")),
        "remarks": clean_val(m.get("remarks")),
    })

# Group stakeholders summary by la_case_id
stakeholders_summary = {}
for _, s in stakeholders_df.iterrows():
    cid = int(s["la_case_id"])
    if cid not in stakeholders_summary:
        stakeholders_summary[cid] = {
            "count": 0,
            "objections_count": 0,
            "litigation_count": 0,
            "total_offered": 0.0,
            "total_accepted": 0.0,
        }
    stakeholders_summary[cid]["count"] += 1
    if s.get("objection_filed") is True or str(s.get("objection_filed")).lower() == "true":
        stakeholders_summary[cid]["objections_count"] += 1
    if s.get("litigation_involved") is True or str(s.get("litigation_involved")).lower() == "true":
        stakeholders_summary[cid]["litigation_count"] += 1
    if pd.notna(s.get("compensation_offered_inr")):
        stakeholders_summary[cid]["total_offered"] += float(s["compensation_offered_inr"])
    if pd.notna(s.get("compensation_accepted_inr")):
        stakeholders_summary[cid]["total_accepted"] += float(s["compensation_accepted_inr"])

# Build rich case items
all_cases = []
for _, row in cases_df.iterrows():
    cid = int(row["la_case_id"])
    pid = int(row["project_id"])
    proj = projects_map.get(pid, {})
    
    delays = delays_by_case.get(cid, [])
    disputes = disputes_by_case.get(cid, [])
    clearances = clearances_by_case.get(cid, [])
    milestones = milestones_by_case.get(cid, [])
    stk = stakeholders_summary.get(cid, {
        "count": 0, "objections_count": 0, "litigation_count": 0, "total_offered": 0, "total_accepted": 0
    })
    
    # Calculate effective delay_days
    raw_delay = row.get("delay_days")
    if pd.notna(raw_delay) and not math.isnan(raw_delay):
        delay_days = max(0, int(round(float(raw_delay))))
    elif delays:
        delay_days = int(sum([d["delay_days"] for d in delays if d["delay_days"] is not None]))
    else:
        delay_days = 0
    
    # Delay status label
    if delay_days > 90:
        delay_status = "Delayed"
    elif delay_days > 0:
        delay_status = "Moderate Delay"
    else:
        delay_status = "On time"
    
    has_litigation = len(disputes) > 0 or stk["litigation_count"] > 0 or str(row.get("status")).lower() == "litigated"
    litigation_forum = disputes[0]["forum"] if disputes else ("District Court" if has_litigation else "None")
    litigation_status = disputes[0]["current_status"] if disputes else ("Pending" if has_litigation else "None")
    
    # Determine primary delay category
    if delays:
        primary_delay_reason = delays[0]["delay_reason_category"]
        primary_delay_detail = delays[0]["delay_reason_detail"]
    elif has_litigation:
        primary_delay_reason = "Litigation"
        primary_delay_detail = f"Dispute pending at {litigation_forum}"
    elif stk["objections_count"] > 0:
        primary_delay_reason = "Compensation / Objections"
        primary_delay_detail = f"{stk['objections_count']} objections filed by landowners"
    else:
        primary_delay_reason = "None"
        primary_delay_detail = "Case proceeding normally without logged delay events."

    # Compute risk score (0-100) & risk level
    base_score = 15
    if delay_days > 180:
        base_score += 45
    elif delay_days > 90:
        base_score += 30
    elif delay_days > 30:
        base_score += 15

    if has_litigation:
        base_score += 25
    if stk["objections_count"] > 5:
        base_score += 15
    elif stk["objections_count"] > 0:
        base_score += 8
    if len(delays) >= 2:
        base_score += 10

    risk_score = min(100, max(5, base_score))
    if risk_score >= 65:
        risk_level = "High"
    elif risk_score >= 35:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    # Human readable case status
    raw_status = str(row.get("status", "In Progress")).replace("_", " ")

    case_obj = {
        "la_case_id": cid,
        "id": f"TN-LA-{cid}",
        "case_number": str(row["case_number"]),
        "project_id": pid,
        "project_name": proj.get("project_name", f"Project {pid}"),
        "project_type": proj.get("project_type", "Infrastructure"),
        "sector": proj.get("sector", "Public Works"),
        "implementing_agency": proj.get("implementing_agency", "Tamil Nadu Govt"),
        "district": proj.get("district", "Tamil Nadu"),
        "state": "Tamil Nadu",
        "notification_date": clean_val(row.get("notification_date")),
        "larr_applicable": bool(row.get("larr_applicable")),
        "acquisition_purpose": str(row.get("acquisition_purpose", "Infrastructure Development")),
        "total_area_ha": clean_val(row.get("total_area_ha")) or 0.0,
        "no_of_families_affected": int(row.get("no_of_families_affected", 0)) if pd.notna(row.get("no_of_families_affected")) else 0,
        "rural_urban_mix": str(row.get("rural_urban_mix", "Mixed")),
        "consent_required": bool(row.get("consent_required")),
        "consent_percentage": clean_val(row.get("consent_percentage")),
        "status": raw_status,
        "expected_possession_date": clean_val(row.get("expected_possession_date")),
        "actual_possession_date": clean_val(row.get("actual_possession_date")),
        "delay_days": delay_days,
        "delay_status": delay_status,
        "primary_delay_reason": primary_delay_reason,
        "primary_delay_detail": primary_delay_detail,
        "delay_events": delays,
        "disputes": disputes,
        "has_litigation": has_litigation,
        "litigation_forum": litigation_forum,
        "litigation_status": litigation_status,
        "total_estimated_cost_cr": proj.get("total_estimated_cost_cr", 0.0),
        "stakeholder_count": stk["count"],
        "objections_count": stk["objections_count"],
        "compensation_offered_cr": round(stk["total_offered"] / 1e7, 2),
        "compensation_accepted_cr": round(stk["total_accepted"] / 1e7, 2),
        "clearances": clearances,
        "milestones": milestones,
        "risk_level": risk_level,
        "risk_score": risk_score,
    }
    all_cases.append(case_obj)

print(f"Processed {len(all_cases)} full cases.")

# Save JSON file
out_json_path = DATA_DIR / "tn_cases_processed.json"
with open(out_json_path, "w", encoding="utf-8") as f:
    json.dump(all_cases, f, indent=2)
print(f"Saved JSON to {out_json_path}")

# Also generate frontend/src/lib/tn_data.ts
ts_path = ROOT / "frontend" / "src" / "lib" / "tn_data.ts"
ts_content = f"""/**
 * tn_data.ts
 * ==========
 * Pre-compiled Tamil Nadu Land Acquisition dataset.
 * Sourced directly from tn_land_acquisition_dataset.xlsx.
 */

export interface DelayEvent {{
  delay_event_id: number;
  delay_reason_category: string;
  delay_reason_detail: string;
  start_date: string | null;
  end_date: string | null;
  delay_days: number | null;
}}

export interface DisputeLitigation {{
  dispute_id: number;
  dispute_type: string;
  forum: string;
  filing_date: string | null;
  current_status: string;
  outcome_summary: string;
  impact_on_delay_days: number | null;
}}

export interface ClearanceItem {{
  clearance_id: number;
  clearance_type: string;
  authority: string;
  application_date: string | null;
  approval_date: string | null;
  status: string;
  conditions_imposed: string | null;
}}

export interface MilestoneItem {{
  milestone_id: number;
  milestone_type: string;
  milestone_date: string | null;
  remarks: string | null;
}}

export interface TnCase {{
  la_case_id: number;
  id: string;
  case_number: string;
  project_id: number;
  project_name: string;
  project_type: string;
  sector: string;
  implementing_agency: string;
  district: string;
  state: string;
  notification_date: string | null;
  larr_applicable: boolean;
  acquisition_purpose: string;
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
  delay_events: DelayEvent[];
  disputes: DisputeLitigation[];
  has_litigation: boolean;
  litigation_forum: string;
  litigation_status: string;
  total_estimated_cost_cr: number;
  stakeholder_count: number;
  objections_count: number;
  compensation_offered_cr: number;
  compensation_accepted_cr: number;
  clearances: ClearanceItem[];
  milestones: MilestoneItem[];
  risk_level: "High" | "Medium" | "Low";
  risk_score: number;
}}

export const tnCases: TnCase[] = {json.dumps(all_cases, indent=2)};

export interface TnSummary {{
  totalCases: number;
  totalProjects: number;
  delayedCases: number;
  onTimeCases: number;
  litigatedCases: number;
  totalAreaHa: number;
  totalFamiliesAffected: number;
  totalProjectCostCr: number;
  avgDelayDays: number;
  districts: string[];
  sectors: string[];
}}

export function getTnSummary(): TnSummary {{
  const totalCases = tnCases.length;
  const delayedCases = tnCases.filter((c) => c.delay_status === "Delayed").length;
  const onTimeCases = tnCases.filter((c) => c.delay_status === "On time").length;
  const litigatedCases = tnCases.filter((c) => c.has_litigation).length;
  const totalAreaHa = Math.round(tnCases.reduce((acc, c) => acc + (c.total_area_ha || 0), 0) * 100) / 100;
  const totalFamiliesAffected = tnCases.reduce((acc, c) => acc + (c.no_of_families_affected || 0), 0);
  const totalProjectCostCr = Math.round(tnCases.reduce((acc, c) => acc + (c.total_estimated_cost_cr || 0), 0) * 100) / 100;
  
  const delayedItems = tnCases.filter((c) => c.delay_days > 0);
  const avgDelayDays = delayedItems.length
    ? Math.round(delayedItems.reduce((acc, c) => acc + c.delay_days, 0) / delayedItems.length)
    : 0;

  const districts = Array.from(new Set(tnCases.map((c) => c.district))).sort();
  const sectors = Array.from(new Set(tnCases.map((c) => c.sector))).sort();

  return {{
    totalCases,
    totalProjects: 80,
    delayedCases,
    onTimeCases,
    litigatedCases,
    totalAreaHa,
    totalFamiliesAffected,
    totalProjectCostCr,
    avgDelayDays,
    districts,
    sectors,
  }};
}}

export const navGroups = [
  {{
    label: "Workspace",
    items: [
      ["Command Center", "/command-center", "CommandCenter"],
      ["Land Intelligence", "/land-intelligence", "Layers"],
      ["GIS Land Map", "/gis-map", "Globe2"],
      ["Risk Alerts", "/risk-alerts", "BellRing"],
    ],
  }},
  {{
    label: "Decisions & AI",
    items: [
      ["AI Risk Predictor", "/risk-predictor", "Sparkles"],
      ["Action Intelligence", "/action-intelligence", "ListChecks"],
      ["Analytics", "/analytics", "ChartNoAxesCombined"],
      ["Reports", "/reports", "FileBarChart"],
    ],
  }},
];
"""

with open(ts_path, "w", encoding="utf-8") as f:
    f.write(ts_content)
print(f"Saved TypeScript dataset to {ts_path}")
