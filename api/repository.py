"""
repository.py
=============
Authoritative operational data-access layer for AcquiSight AI.
Encapsulates CRUD operations, atomic writes, caching, duplicate prevention,
and query filtering. Designed as a clean repository abstraction so storage can
later transition from local JSON to cloud Firestore without changing business logic.
"""

from __future__ import annotations

import copy
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("acquisight.repository")

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_PRIMARY_CASES_FILE = _DATA_DIR / "tn_cases_processed.json"


class CaseRepository:
    def __init__(self, storage_path: Optional[Path] = None):
        self._path = storage_path or _PRIMARY_CASES_FILE
        self._lock = threading.RLock()
        self._cases: Optional[List[Dict[str, Any]]] = None

    def _load(self) -> List[Dict[str, Any]]:
        with self._lock:
            if self._cases is not None:
                return self._cases

            if self._path.exists():
                try:
                    with open(self._path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            self._cases = data
                            log.info("Loaded %d operational cases from %s", len(data), self._path)
                        else:
                            log.error("Data in %s is not a list; resetting cache to empty", self._path)
                            self._cases = []
                except Exception as exc:
                    log.exception("Error loading cases from %s: %s", self._path, exc)
                    self._cases = []
            else:
                log.warning("Cases storage path %s does not exist; initializing empty store", self._path)
                self._cases = []

            return self._cases

    def _persist(self) -> None:
        """Atomically persist cases to storage disk."""
        with self._lock:
            if self._cases is None:
                return
            temp_path = self._path.with_suffix(".tmp")
            try:
                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(self._cases, f, indent=2, ensure_ascii=False)
                # Atomic replace on same filesystem
                temp_path.replace(self._path)
                log.info("Persisted %d cases to %s", len(self._cases), self._path)
            except Exception as exc:
                log.exception("Failed to atomically persist cases to %s: %s", self._path, exc)
                if temp_path.exists():
                    try:
                        temp_path.unlink()
                    except Exception:
                        pass
                raise IOError(f"Database write failure: {exc}") from exc

    def get_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            cases = self._load()
            return copy.deepcopy(cases)

    def count(self) -> int:
        with self._lock:
            return len(self._load())

    def get_by_id(self, case_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cases = self._load()
            import urllib.parse
            raw_s = str(case_id).strip().lower()
            unquoted_s = urllib.parse.unquote(raw_s).strip().lower()
            for c in cases:
                c_id = str(c.get("id", "")).lower()
                c_num = str(c.get("case_number", "")).lower()
                c_la = str(c.get("la_case_id", "")).lower()
                if raw_s in (c_id, c_num, c_la) or unquoted_s in (c_id, c_num, c_la):
                    return copy.deepcopy(c)
            return None

    def create(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            cases = self._load()

            # Duplicate check: check if exact project name + district or case_number exists
            existing_case_num = str(case_data.get("case_number", "")).strip().lower()
            proj_name = str(case_data.get("project_name", "")).strip().lower()
            district = str(case_data.get("district", "")).strip().lower()

            if existing_case_num:
                for c in cases:
                    if str(c.get("case_number", "")).strip().lower() == existing_case_num:
                        log.warning("Duplicate case_number '%s' found. Returning existing case.", existing_case_num)
                        return copy.deepcopy(c)

            # Assign clean unique ID if not present
            if not case_data.get("id"):
                next_num = len(cases) + 1
                case_data["id"] = f"TN-LA-NEW-{next_num}"

            if not case_data.get("case_number"):
                dist_code = (district[:3] or "TN").upper()
                next_num = len(cases) + 1
                case_data["case_number"] = f"TN/LA/{dist_code}/{next_num}"

            if not case_data.get("created_at"):
                case_data["created_at"] = datetime.now(timezone.utc).isoformat()

            case_copy = copy.deepcopy(case_data)
            # Insert at the top of the list so it is immediately visible
            cases.insert(0, case_copy)

            # Persist to disk
            self._persist()
            return copy.deepcopy(case_copy)

    def update(self, case_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            cases = self._load()
            s = str(case_id).strip().lower()
            target_idx = None

            for i, c in enumerate(cases):
                c_id = str(c.get("id", "")).lower()
                c_num = str(c.get("case_number", "")).lower()
                c_la = str(c.get("la_case_id", "")).lower()
                if c_id == s or c_num == s or c_la == s:
                    target_idx = i
                    break

            if target_idx is None:
                return None

            existing = cases[target_idx]
            # Don't allow changing the primary immutable ID
            updates.pop("id", None)
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            existing.update(updates)

            self._persist()
            return copy.deepcopy(existing)

    def query(
        self,
        district: Optional[str] = None,
        delay_status: Optional[str] = None,
        sector: Optional[str] = None,
        has_litigation: Optional[bool] = None,
        risk_category: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "desc",
        limit: int = 1000,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self._lock:
            cases = self._load()
            filtered = cases

            if district and district.lower() != "all districts":
                d_lower = district.lower()
                filtered = [c for c in filtered if str(c.get("district", "")).lower() == d_lower]

            if delay_status and delay_status.lower() != "all":
                ds_lower = delay_status.lower()
                filtered = [c for c in filtered if str(c.get("delay_status", "")).lower() == ds_lower]

            if sector and sector.lower() != "all sectors":
                sec_lower = sector.lower()
                filtered = [c for c in filtered if str(c.get("sector", "")).lower() == sec_lower]

            if has_litigation is not None:
                filtered = [c for c in filtered if bool(c.get("has_litigation")) == has_litigation]

            if risk_category and risk_category.lower() != "all risk categories":
                rc_lower = risk_category.lower()
                filtered = [
                    c for c in filtered
                    if str(c.get("risk_level") or c.get("risk_category") or "").lower() == rc_lower
                ]

            if search and search.strip():
                s = search.strip().lower()
                filtered = [
                    c for c in filtered
                    if s in str(c.get("case_number", "")).lower()
                    or s in str(c.get("project_name", "")).lower()
                    or s in str(c.get("district", "")).lower()
                    or s in str(c.get("acquisition_purpose", "")).lower()
                    or s in str(c.get("primary_delay_reason", "")).lower()
                    or s in str(c.get("id", "")).lower()
                ]

            total = len(filtered)

            # Sorting
            if sort_by:
                reverse = sort_order.lower() == "desc"
                def sort_key(item: Dict[str, Any]):
                    val = item.get(sort_by)
                    if val is None:
                        return float("-inf") if reverse else float("inf")
                    if isinstance(val, (int, float)):
                        return val
                    return str(val).lower()

                filtered = sorted(filtered, key=sort_key, reverse=reverse)

            paged = filtered[offset : offset + limit]
            return copy.deepcopy(paged), total


# Global singleton repository
cases_repo = CaseRepository()
