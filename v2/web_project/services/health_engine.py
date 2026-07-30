"""
services/health_engine.py
==========================
Pure-logic engine that turns raw sensor readings into per-component health
scores and an overall weighted machine health score, using the machine-type
configuration in config.py. Contains no GUI or DB code, per the
"separate GUI logic from business logic" requirement.
"""

from __future__ import annotations
from typing import Dict
from models.sensor_data import SensorData
from config import components_for_type, status_for_score


class HealthEngine:
    def __init__(self, machine_type: str):
        self.machine_type = machine_type
        self.components = components_for_type(machine_type)

    def compute_component_health(self, reading: SensorData) -> Dict[str, float]:
        """Returns {component_name: health_score} for every component
        defined for this machine type."""
        kwargs = reading.as_kwargs()
        return {
            name: cfg.health_fn(**kwargs)
            for name, cfg in self.components.items()
        }

    def compute_overall_health(self, component_health: Dict[str, float]) -> float:
        total = 0.0
        for name, cfg in self.components.items():
            total += component_health.get(name, 100.0) * cfg.weight
        return round(max(0.0, min(100.0, total)), 2)

    def evaluate(self, reading: SensorData) -> tuple[Dict[str, float], float, str, str]:
        """Convenience: returns (component_health, overall_score, status, color)."""
        component_health = self.compute_component_health(reading)
        overall = self.compute_overall_health(component_health)
        status, color = status_for_score(overall)
        return component_health, overall, status, color
