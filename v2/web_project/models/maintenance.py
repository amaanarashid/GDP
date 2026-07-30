"""models/maintenance.py - dataclasses for maintenance logs & predictions."""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class MaintenanceLog:
    machine_id: str
    action_taken: str
    notes: str = ""
    maintenance_date: str = ""

    @classmethod
    def from_row(cls, row: dict) -> "MaintenanceLog":
        return cls(
            machine_id=row["machine_id"],
            action_taken=row["action_taken"],
            notes=row.get("notes", ""),
            maintenance_date=row.get("maintenance_date", ""),
        )


@dataclass
class MaintenancePrediction:
    """Output of the prediction engine - what the dashboard renders in
    Section 4 (Predictive Maintenance) and Section 7 (Recommendation)."""
    most_critical_component: str
    component_health: float
    predicted_failure: str          # human readable description
    remaining_useful_life_days: float
    recommended_action: str
    confidence_pct: float
    priority_level: str             # Low / Medium / High / Urgent
    estimated_downtime_hours: float
    estimated_cost_usd: float
