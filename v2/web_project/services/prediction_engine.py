"""
services/prediction_engine.py
==============================
Generates predictive-maintenance recommendations from component health
scores: identifies the weakest component, estimates Remaining Useful Life
(RUL), recommended action, confidence, priority, downtime and cost.

All numbers are simplified simulated estimates appropriate for a
demo/prototype Industry 4.0 system, not real reliability engineering.
"""

from __future__ import annotations
from typing import Dict
from config import components_for_type
from models.maintenance import MaintenancePrediction

ALERT_THRESHOLD = 40.0


class PredictionEngine:
    def __init__(self, machine_type: str):
        self.machine_type = machine_type
        self.components = components_for_type(machine_type)

    def predict(self, component_health: Dict[str, float]) -> MaintenancePrediction:
        if not component_health:
            return MaintenancePrediction(
                most_critical_component="N/A", component_health=100.0,
                predicted_failure="No data yet", remaining_useful_life_days=999,
                recommended_action="None", confidence_pct=0.0,
                priority_level="Low", estimated_downtime_hours=0.0,
                estimated_cost_usd=0.0,
            )

        # Find weakest component
        worst_name = min(component_health, key=component_health.get)
        worst_score = component_health[worst_name]
        cfg = self.components.get(worst_name)
        degradation_rate = cfg.degradation_rate if cfg else 0.5

        # Simulated RUL: lower health & higher degradation rate -> fewer days left
        rul_days = round(worst_score / max(degradation_rate, 0.01), 1)
        rul_days = max(0.0, min(rul_days, 365.0))

        if worst_score < ALERT_THRESHOLD:
            recommended_action = cfg.fault_action if cfg else f"Inspect {worst_name}"
            predicted_failure = f"{worst_name} failure likely within {int(rul_days)} days"
            priority = "Urgent" if worst_score < 20 else "High"
        elif worst_score < 60:
            recommended_action = f"Schedule inspection of {worst_name}"
            predicted_failure = f"{worst_name} degrading - monitor closely"
            priority = "Medium"
        else:
            recommended_action = "No immediate action required"
            predicted_failure = "No imminent failure predicted"
            priority = "Low"

        # Confidence grows as health moves away from the 50 (most ambiguous) midpoint
        confidence = round(50 + abs(worst_score - 50) * 0.9, 1)
        confidence = max(50.0, min(99.0, confidence))

        downtime_map = {"Urgent": 8.0, "High": 4.0, "Medium": 2.0, "Low": 0.0}
        cost_map = {"Urgent": 2500.0, "High": 1200.0, "Medium": 400.0, "Low": 0.0}

        return MaintenancePrediction(
            most_critical_component=worst_name,
            component_health=round(worst_score, 1),
            predicted_failure=predicted_failure,
            remaining_useful_life_days=rul_days,
            recommended_action=recommended_action,
            confidence_pct=confidence,
            priority_level=priority,
            estimated_downtime_hours=downtime_map[priority],
            estimated_cost_usd=cost_map[priority],
        )
