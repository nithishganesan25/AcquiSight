"""
import_20k_to_cases.py
"""
from __future__ import annotations
import gzip, json, logging, sys
from pathlib import Path
import numpy as np, pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False))])
log = logging.getLogger("import_20k")

_ROOT = Path(__file__).resolve().parent.parent
_DATA = _ROOT / "data"
SCORED_CSV  = _DATA / "land_records_scored.csv"
RAW_20K_CSV = _DATA / "AcquiSight_20K_Synthetic_Augmented_Dataset.csv"
OUT_JSON    = _DATA / "tn_cases_processed.json"

STATUS_MAP = {
    "possession taken":"Possession Taken","completed":"Completed",
    "award_declared":"Award Declared","award declared":"Award Declared",
    "objections_received":"Objections Received","objections received":"Objections Received",
    "consent_process_end":"Consent Process End","consent process end":"Consent Process End",
    "litigated":"Litigated","sia_completed":"SIA Completed","sia completed":"SIA Completed","initiated":"Initiated",
}
SECTOR_MAP={"transport":"Transport","housing":"Housing","energy":"Energy","manufacturing":"Manufacturing","agriculture":"Agriculture","infrastructure":"Infrastructure"}
def _safe(v,d=""): return d if v is None or (isinstance(v,float) and np.isnan(v)) else v
def _days_risk(d): return "Low" if d<=60 else "Medium" if d<=120 else "High"
def _norm_status(r): return STATUS_MAP.get(str(r).strip().lower(), str(r).strip().title())
def _norm_delay(r):
    k=str(r).strip().lower()
    if "delayed" in k: return "Delayed"
    if "moderate" in k: return "Moderate Delay"
    return "On time"

def build(scored, raw20k):
    raw_idx={}
    if "synthetic_record_id" in raw20k.columns:
        for _,row in raw20k.iterrows():
            rid=str(_safe(row.get("synthetic_record_id"),"")).strip()
            if rid: raw_idx[rid]=row

    cases=[]
    for i,row in scored.iterrows():
        lid=str(_safe(row.get("Land_ID"),f"REC_{i}"))
        raw=raw_idx.get(lid)
        district=str(_safe(row.get("District"),"Tamil Nadu")).strip()
        taluk=str(_safe(row.get("Taluk"),"Unknown")).strip()
        village=str(_safe(row.get("Village"),"Unknown")).strip()
        survey_no=str(_safe(row.get("Survey_No"),"")).strip()
        area_ha=float(_safe(row.get("Extent_Hectares"),1.0))
        area_sqft=float(_safe(row.get("Area_Sqft"),area_ha*107639.0))
        acq_days=float(_safe(row.get("Acquisition_Days"),0.0))
        delay_st=_norm_delay(str(_safe(row.get("Delay_Status"),"On time")))
        lat=float(_safe(row.get("latitude"),11.0)); lon=float(_safe(row.get("longitude"),79.0))
        pred_days=float(_safe(row.get("Predicted_Delay_Days"),acq_days))
        pred_risk=str(_safe(row.get("Predicted_Risk_Category"),_days_risk(pred_days)))
        pred_delay=str(_safe(row.get("Predicted_Delay_Status"),delay_st))
        pred_prob=_safe(row.get("Predicted_Delay_Probability"),None)

        proj_name=""; sector="Transport"; purpose="Infrastructure Development"; agency="Tamil Nadu Highways"
        status_raw=""; families=10; total_area=area_ha; cost_cr=round(area_ha*2.5,2)
        has_lit=False; lit_count=0; obj_count=0; disp_count=0; disp_days=0.0; ev_days=0.0
        market_val=0.0; comp_rate=0.0; notif_date="2024-01-01"; exp_poss=""; act_poss=""
        case_number=""; la_case_id=i+1; project_id=1; project_type="Highway"

        if raw is not None:
            proj_name=str(_safe(raw.get("project_name"),"")).strip()
            sr=str(_safe(raw.get("sector"),"Transport")).strip()
            sector=SECTOR_MAP.get(sr.lower(),sr.title())
            purpose=str(_safe(raw.get("acquisition_purpose"),"Infrastructure Development")).strip()
            agency=str(_safe(raw.get("implementing_agency"),"Tamil Nadu Highways")).strip()
            status_raw=str(_safe(raw.get("status"),"")).strip()
            try: families=max(1,int(float(_safe(raw.get("no_of_families_affected"),10))))
            except: families=10
            total_area=float(_safe(raw.get("total_area_ha"),area_ha))
            try: cost_cr=round(float(_safe(raw.get("total_estimated_cost_cr"),None)),2)
            except: cost_cr=round(area_ha*2.5,2)
            has_lit=bool(int(_safe(raw.get("has_litigation"),0) or 0))
            lit_count=int(_safe(raw.get("litigation_count"),0) or 0)
            obj_count=int(_safe(raw.get("objections_count"),0) or 0)
            disp_count=int(_safe(raw.get("dispute_count"),0) or 0)
            disp_days=float(_safe(raw.get("dispute_delay_days"),0.0) or 0.0)
            ev_days=float(_safe(raw.get("event_delay_days"),0.0) or 0.0)
            market_val=float(_safe(raw.get("market_value_per_ha_inr"),0.0) or 0.0)
            comp_rate=float(_safe(raw.get("compensation_rate_per_ha_inr"),0.0) or 0.0)
            notif_date=str(_safe(raw.get("notification_date"),"2024-01-01"))
            exp_poss=str(_safe(raw.get("expected_possession_date"),""))
            act_poss_v=_safe(raw.get("actual_possession_date"),None)
            act_poss="" if act_poss_v is None or str(act_poss_v).lower()=="nan" else str(act_poss_v)
            case_number=str(_safe(raw.get("case_number"),""))
            try: la_case_id=int(_safe(raw.get("la_case_id"),i+1) or i+1)
            except: la_case_id=i+1
            try: project_id=int(_safe(raw.get("project_id"),1) or 1)
            except: project_id=1
            project_type=str(_safe(raw.get("project_type"),"Highway")).strip()

        if not proj_name: proj_name=f"{purpose}: {district} {la_case_id}"
        acq_status=_norm_status(status_raw) if status_raw else ("Completed" if act_poss else "Litigated" if has_lit else "Possession Taken" if delay_st=="Delayed" else "Initiated")
        risk_score=int(min(100,max(0,(pred_days/200.0)*100)))
        disputes=[{"dispute_type":"Writ Petition","forum":"High Court of Madras","status":"Pending","filing_date":notif_date,"outcome_summary":f"Litigation pending for {proj_name} in {district}"}] if (has_lit or lit_count>0) else []
        prim_reason="Litigation" if has_lit else "Objections" if obj_count>0 else "Dispute" if disp_count>0 else "None"
        prim_detail="Active challenge before High Court of Madras" if has_lit else f"{obj_count} objections filed" if obj_count>0 else "Dispute pending" if disp_count>0 else "Standard process"

        cases.append({
            "id":f"TN-LA-{lid}","case_number":case_number or f"TN/LA/{district[:3].upper()}/{la_case_id}",
            "la_case_id":la_case_id,"land_id":lid,"project_id":project_id,
            "project_name":proj_name,"title":proj_name,
            "district":district,"taluk":taluk,"village":village,"survey_no":survey_no,
            "state":"Tamil Nadu","location":f"{village}, {taluk}, {district}","region":district,
            "latitude":lat,"longitude":lon,
            "implementing_agency":agency,"owner":agency,
            "acquisition_purpose":purpose,"project_type":project_type,"sector":sector,
            "total_area_ha":round(total_area,4),"area":f"{round(total_area,2)} ha","area_sqft":round(area_sqft,2),
            "no_of_families_affected":families,"landowners":families,"stakeholder_count":families,
            "total_estimated_cost_cr":cost_cr,"market_value_per_ha":round(market_val,2),"compensation_rate_per_ha":round(comp_rate,2),
            "notification_date":notif_date,"expected_possession_date":exp_poss,"actual_possession_date":act_poss or None,
            "status":acq_status,"acquisition_status":acq_status,
            "delay_days":int(round(acq_days)),"delay_status":delay_st,
            "event_delay_days":round(ev_days,1),"dispute_delay_days":round(disp_days,1),
            "primary_delay_reason":prim_reason,"primary_delay_detail":prim_detail,
            "has_litigation":has_lit or lit_count>0,"litigation_count":lit_count,
            "litigation_forum":"High Court of Madras" if (has_lit or lit_count>0) else "None",
            "litigation_status":"Pending" if (has_lit or lit_count>0) else "None",
            "legalDispute":has_lit or lit_count>0,"disputes":disputes,"objections_count":obj_count,
            "Document_Issue":str(_safe(row.get("Document_Issue"),"Available")),
            "Document_Verified":str(_safe(row.get("Document_Verified"),"Yes")),
            "Owner_Objection":str(_safe(row.get("Owner_Objection"),"No")),
            "Court_Case":str(_safe(row.get("Court_Case"),"No")),
            "Compensation_Status":str(_safe(row.get("Compensation_Status"),"To be paid")),
            "Flood_Risk":str(_safe(row.get("Flood_Risk"),"No")),
            "Water_Availability":str(_safe(row.get("Water_Availability"),"Yes")),
            "Land_Type":str(_safe(row.get("Land_Type"),"Agricultural")),
            "Soil_Type":str(_safe(row.get("Soil_Type"),"Red Soil")),
            "incompleteDocuments":str(_safe(row.get("Document_Issue"),"Available")).lower().startswith("not"),
            "compensationPending":"pending" in str(_safe(row.get("Compensation_Status"),"")).lower(),
            "activeCourtCase":has_lit or lit_count>0,
            "predicted_delay_days":round(pred_days,1),"Predicted_Delay_Days":round(pred_days,1),
            "Predicted_Delay_Status":pred_delay,"Predicted_Risk_Category":pred_risk,
            "Predicted_Delay_Probability":float(pred_prob) if pred_prob is not None else None,
            "risk_level":pred_risk,"risk_category":pred_risk,"risk_score":risk_score,
            "daysPending":int(round(acq_days)),
            "nextAction":"File counter-affidavit before High Court of Madras" if has_lit else "Conduct Section 15 enquiry hearing" if obj_count>0 else "Process compensation award",
            "delay_events":[],"clearances":[],"milestones":[],
            "larr_applicable":True,"source_reference":"AcquiSight 20K Synthetic Augmented Dataset",
        })
    return cases

log.info("Loading %s", SCORED_CSV)
scored=pd.read_csv(SCORED_CSV)
log.info("  %d rows", len(scored))
log.info("Loading %s", RAW_20K_CSV)
raw20k=pd.read_csv(RAW_20K_CSV) if RAW_20K_CSV.exists() else pd.DataFrame()
log.info("  %d rows", len(raw20k))
log.info("Building case documents ...")
cases=build(scored, raw20k)
log.info("Built %d cases", len(cases))
compact = json.dumps(cases, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
tmp = OUT_JSON.with_suffix(".tmp")
with open(tmp, "wb") as fh: fh.write(compact)
tmp.replace(OUT_JSON)
log.info("Written %s  (%.1f MB)", OUT_JSON, OUT_JSON.stat().st_size / 1e6)
gz_out = OUT_JSON.parent / (OUT_JSON.name + ".gz")
gz_tmp = gz_out.with_suffix(".tmp")
with gzip.open(gz_tmp, "wb", compresslevel=9) as fh: fh.write(compact)
gz_tmp.replace(gz_out)
log.info("Written %s  (%.1f MB)", gz_out, gz_out.stat().st_size / 1e6)
delayed=sum(1 for c in cases if c["delay_status"]=="Delayed")
litigated=sum(1 for c in cases if c["has_litigation"])
districts=len({c["district"] for c in cases})
log.info("Stats: %d total | %d delayed | %d litigated | %d districts", len(cases), delayed, litigated, districts)
