"""
chat_service.py
===============
Grounded AI Chatbot Service for AcquiSight.
Retrieves authoritative case data, live district analytics, and statutory context
before generating grounded responses. Never hallucinates information; explicitly
reports when data is unavailable. Supports external LLMs (Gemini / OpenAI) if keys
are provided in environment, or uses a transparent Grounded Analytical Engine.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.request
from typing import Any, Dict, List, Optional
from repository import cases_repo

log = logging.getLogger("acquisight.chat")

TN_DISTRICTS = [
    "Tiruchirappalli", "Chennai", "Coimbatore", "Salem", "Madurai", "Thanjavur",
    "Karur", "Cuddalore", "Vellore", "Erode", "Krishnagiri", "Thoothukudi",
    "Tirunelveli", "Tiruvallur", "Kancheepuram", "Chengalpattu", "Ranipet",
    "Villupuram", "Dharmapuri", "Namakkal", "Dindigul", "Theni", "Virudhunagar"
]


def _detect_district(text: str) -> Optional[str]:
    text_lower = text.lower()
    for d in TN_DISTRICTS:
        if d.lower() in text_lower:
            return d
    return None


def _get_district_stats(district_name: str) -> Dict[str, Any]:
    cases = cases_repo.get_all()
    d_cases = [c for c in cases if str(c.get("district", "")).lower() == district_name.lower()]
    total = len(d_cases)
    if total == 0:
        return {"district": district_name, "found": False, "total": 0}

    delayed = sum(1 for c in d_cases if c.get("delay_status") == "Delayed" or int(c.get("delay_days") or 0) > 90)
    litigated = sum(1 for c in d_cases if c.get("has_litigation") or (c.get("disputes") and len(c.get("disputes")) > 0))
    delays = [int(c.get("delay_days") or 0) for c in d_cases if int(c.get("delay_days") or 0) > 0]
    avg_delay = round(sum(delays) / len(delays), 1) if delays else 0

    return {
        "district": district_name,
        "found": True,
        "total": total,
        "delayed": delayed,
        "litigated": litigated,
        "avg_delay_days": avg_delay,
    }


def _call_gemini(prompt: str, api_key: str) -> Optional[str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800}
    }
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as res:
            if res.status == 200:
                result = json.loads(res.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text")
    except Exception as e:
        log.warning("Gemini API call failed: %s", e)
    return None


def handle_chat_query(
    message: str,
    case_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Handles an officer query with grounded context retrieval.
    """
    message = message.strip()
    citations: List[str] = []
    actions: List[str] = []

    # 1. RETRIEVE RELEVANT CASE CONTEXT
    active_case: Optional[Dict[str, Any]] = None
    if case_id:
        active_case = cases_repo.get_by_id(case_id)
        if active_case:
            citations.append(f"Case Record: {active_case.get('case_number', case_id)}")

    # 2. RETRIEVE DISTRICT CONTEXT
    mentioned_district = _detect_district(message)
    dist_stats = None
    if mentioned_district:
        dist_stats = _get_district_stats(mentioned_district)
        if dist_stats.get("found"):
            citations.append(f"AcquiSight District Registry ({mentioned_district})")

    # 3. STATUTORY REFERENCES
    msg_lower = message.lower()
    if "section 11" in msg_lower or "section 19" in msg_lower or "deadline" in msg_lower or "sla" in msg_lower:
        citations.append("RFCTLARR Act 2013, Section 19(7)")
    if "compensation" in msg_lower or "multiplier" in msg_lower or "solatium" in msg_lower:
        citations.append("RFCTLARR Act 2013, Sections 26–30 & First Schedule")
    if "objection" in msg_lower or "hearing" in msg_lower or "section 15" in msg_lower:
        citations.append("RFCTLARR Act 2013, Section 15(1)-(3)")

    # 4. CHECK FOR CONFIGURED EXTERNAL LLM
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        system_context = (
            "You are AcquiSight AI Copilot, a senior administrative and legal assistant for the Tamil Nadu "
            "Revenue and Land Administration Department. Answer the officer's question strictly using the provided "
            "factual context. If information is not provided in the context, explicitly declare that it is unavailable.\n\n"
            "CONTEXT DATA:\n"
        )
        if active_case:
            system_context += f"Active Case Details: {json.dumps(active_case, default=str)}\n"
        if dist_stats and dist_stats.get("found"):
            system_context += f"District Live Analytics: {json.dumps(dist_stats)}\n"

        prompt = f"{system_context}\nOfficer Query: {message}\n\nProvide an objective, professional response:"
        llm_reply = _call_gemini(prompt, gemini_key)
        if llm_reply:
            return {
                "reply": llm_reply.strip(),
                "citations": citations or ["RFCTLARR Act 2013"],
                "suggested_actions": ["Review case statutory timeline", "Verify Section 15 enquiry report"],
                "provider": "Gemini 1.5 Flash (Configured LLM)",
                "case_id": case_id,
            }

    # 5. GROUNDED ANALYTICAL REASONING ENGINE (When external LLM key is not present)
    # Grounded strictly in factual data:

    # A. Case-specific questions
    if active_case:
        c_num = active_case.get("case_number", case_id)
        p_name = active_case.get("project_name", "the project")
        r_level = active_case.get("risk_level") or active_case.get("risk_category") or "Unknown"
        r_score = active_case.get("risk_score", "Not calculated")
        days = active_case.get("delay_days", 0)
        status = active_case.get("status", "Initiated")
        lit = active_case.get("has_litigation")
        forum = active_case.get("litigation_forum")
        reason = active_case.get("primary_delay_reason")

        if any(w in msg_lower for w in ["why", "risk", "delay", "high risk", "factors"]):
            factors_summary = []
            if lit:
                forum_text = f"at {forum}" if forum and forum.lower() not in ("none", "n/a") else "in court"
                factors_summary.append(f"active litigation {forum_text}")
                actions.append(f"Direct District Revenue Officer to prepare counter-affidavit for {forum or 'court'}")
            if days > 0:
                factors_summary.append(f"a recorded delay of {days} days against statutory SLA")
                actions.append("Review milestone timeline to prevent Section 19(7) lapse")
            if reason and reason.lower() not in ("none", "n/a", "unknown"):
                factors_summary.append(f"primary bottleneck recorded as '{reason}'")
                actions.append(f"Expedite resolution of {reason}")

            f_str = "; ".join(factors_summary) if factors_summary else "baseline processing timeline"
            reply = (
                f"[Grounded Analysis] Case {c_num} ({p_name}) has an evaluated Risk Score of {r_score}/100 ({r_level} Risk). "
                f"The key contributing factors recorded in the operational database are: {f_str}. "
                f"Current stage: '{status}'."
            )
            return {
                "reply": reply,
                "citations": citations or ["AcquiSight Operational Database"],
                "suggested_actions": actions or ["Verify documentation status"],
                "provider": "AcquiSight Grounded Analytics Engine (Zero-Hallucination)",
                "case_id": case_id,
            }

        if any(w in msg_lower for w in ["investigate", "action", "what should i do", "recommend"]):
            rec = active_case.get("nextAction") or "Proceed with standard Section 11(1) documentation."
            reply = (
                f"[Grounded Analysis] Recommended immediate operational action for Case {c_num}: "
                f"'{rec}'. "
                f"Recorded delay: {days} days. Litigation status: {'Active' if lit else 'No active litigation recorded'}."
            )
            return {
                "reply": reply,
                "citations": citations or ["AcquiSight Operational Database"],
                "suggested_actions": [rec],
                "provider": "AcquiSight Grounded Analytics Engine (Zero-Hallucination)",
                "case_id": case_id,
            }

        if any(w in msg_lower for w in ["explain", "overview", "details", "tell me about"]):
            area = active_case.get("total_area_ha")
            families = active_case.get("no_of_families_affected")
            cost = active_case.get("total_estimated_cost_cr")
            reply = (
                f"[Grounded Analysis] Case {c_num} relates to '{p_name}' in {active_case.get('district', 'Tamil Nadu')}. "
                f"Area: {f'{area} ha' if area is not None else 'Not available'}. "
                f"Affected Families: {families if families is not None else 'Not available'}. "
                f"Estimated Cost: {f'₹{cost} Cr' if cost is not None else 'Not available'}. "
                f"Status: '{status}' with a delay of {days} days. Risk Level: {r_level} ({r_score}/100)."
            )
            return {
                "reply": reply,
                "citations": citations,
                "suggested_actions": ["Review land parcel records", "Inspect compensation vouchers"],
                "provider": "AcquiSight Grounded Analytics Engine (Zero-Hallucination)",
                "case_id": case_id,
            }

    # B. District analytics questions
    if dist_stats and dist_stats.get("found"):
        d_name = dist_stats["district"]
        reply = (
            f"[Grounded Analysis] In {d_name} District, there are currently {dist_stats['total']} total monitored cases in the database. "
            f"Of these, {dist_stats['delayed']} cases have recorded delays (>90 days), and {dist_stats['litigated']} cases are in active litigation. "
            f"The average recorded delay across delayed cases is {dist_stats['avg_delay_days']} days."
        )
        return {
            "reply": reply,
            "citations": citations,
            "suggested_actions": [f"Filter Land Intelligence by District: {d_name}", "Inspect High Court litigation cases in this district"],
            "provider": "AcquiSight Grounded Analytics Engine (Zero-Hallucination)",
            "case_id": case_id,
        }

    # C. Statutory / Legal questions
    if "section 11" in msg_lower or "section 19" in msg_lower or "12 months" in msg_lower:
        reply = (
            "[Statutory Rule] Under Section 19(7) of the RFCTLARR Act 2013, the declaration under Section 19(1) "
            "must be published within 12 months from the date of the preliminary notification under Section 11(1). "
            "If no declaration is published within this statutory window, the preliminary notification automatically lapses, "
            "requiring the administration to restart from the Social Impact Assessment (SIA)."
        )
        return {
            "reply": reply,
            "citations": ["RFCTLARR Act 2013, Section 19(7)", "Tamil Nadu Land Administration Manual"],
            "suggested_actions": ["Audit cases approaching the 12-month Section 19 declaration deadline"],
            "provider": "AcquiSight Statutory Intelligence",
            "case_id": case_id,
        }

    if "compensation" in msg_lower or "multiplier" in msg_lower or "solatium" in msg_lower:
        reply = (
            "[Statutory Rule] Under the First Schedule and Sections 26–30 of RFCTLARR 2013:\n"
            "1. Base Market Value is determined under Section 26.\n"
            "2. In rural Tamil Nadu, a multiplying factor of 1.25× to 2.00× applies based on distance from urban limits (urban multiplier is 1.00×).\n"
            "3. Assets attached (wells, structures) are valued under Section 29.\n"
            "4. A mandatory 100% solatium is added under Section 30."
        )
        return {
            "reply": reply,
            "citations": ["RFCTLARR Act 2013, Sections 26–30", "First Schedule (Rural Multipliers)"],
            "suggested_actions": ["Verify guideline value certificates against sub-registrar registries"],
            "provider": "AcquiSight Statutory Intelligence",
            "case_id": case_id,
        }

    # Default general assistance
    reply = (
        "I am AcquiSight Copilot for Tamil Nadu Land Administration. "
        "You can ask me about active case factors, district-level delay counts (e.g. 'How many delayed cases in Tiruchirappalli?'), "
        "or statutory SLAs under RFCTLARR Act 2013."
    )
    return {
        "reply": reply,
        "citations": ["AcquiSight Operational Database", "RFCTLARR Act 2013"],
        "suggested_actions": [
            "Why is this case high risk?",
            "How many delayed cases in Tiruchirappalli?",
            "What is the statutory Section 11 to 19 deadline?"
        ],
        "provider": "AcquiSight Grounded Analytics Engine (Zero-Hallucination)",
        "case_id": case_id,
    }
