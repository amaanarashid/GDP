"""
config.py
=========
Single source of truth for machine-type definitions.

This is the heart of the system's scalability story: adding a brand-new
machine type (e.g. "Robotic Arm", "Hydraulic Press") requires ONLY adding an
entry to MACHINE_TYPE_CONFIGS below -- no changes to the GUI, database layer,
or prediction engine are needed. Adding a new *instance* of an existing
machine type requires only a new row in the `machines` table (see
database/schema.sql) plus a QR code.

Each component definition contains:
    weight            -> contribution to overall machine health (must sum to 1.0)
    degradation_rate  -> used for simulated Remaining-Useful-Life estimation
    health_fn         -> callable(SensorData) -> float health score (0-100)
    critical_threshold-> health value below which a maintenance alert fires
    fault_action      -> human-readable recommended action when critical
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Dict


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


@dataclass
class ComponentConfig:
    name: str
    weight: float
    degradation_rate: float
    health_fn: Callable[..., float]
    critical_threshold: float = 40.0
    fault_action: str = "Inspect Component"


# ---------------------------------------------------------------------------
# Health formulas (kept as small pure functions operating on raw sensor
# readings so they're easy to unit test and easy to extend per machine type)
# ---------------------------------------------------------------------------

def bearing_health(temperature: float, vibration: float, **_) -> float:
    return _clamp(100 - (vibration * 50 + max(0, temperature - 50) * 1.5))


def gearbox_health(vibration: float, operating_hours: float, **_) -> float:
    return _clamp(100 - (vibration * 30 + operating_hours * 0.01))


def motor_health(temperature: float, operating_hours: float, **_) -> float:
    return _clamp(100 - (max(0, temperature - 40) * 1.2 + operating_hours * 0.005))


def belt_health(operating_hours: float, **_) -> float:
    return _clamp(100 - (operating_hours * 0.02))


def fan_health(operating_hours: float, **_) -> float:
    return _clamp(100 - (operating_hours * 0.01))


# ---------------------------------------------------------------------------
# Machine-type registry
# ---------------------------------------------------------------------------

MACHINE_TYPE_CONFIGS: Dict[str, Dict[str, ComponentConfig]] = {
    "Conveyor": {
        "Motor": ComponentConfig(
            "Motor", 0.20, degradation_rate=0.45, health_fn=motor_health,
            fault_action="Service Motor",
        ),
        "Bearing": ComponentConfig(
            "Bearing", 0.35, degradation_rate=0.60, health_fn=bearing_health,
            fault_action="Replace Bearing",
        ),
        "Gearbox": ComponentConfig(
            "Gearbox", 0.25, degradation_rate=0.50, health_fn=gearbox_health,
            fault_action="Inspect Gearbox",
        ),
        "Conveyor Belt": ComponentConfig(
            "Conveyor Belt", 0.15, degradation_rate=0.30, health_fn=belt_health,
            fault_action="Replace Belt",
        ),
        "Cooling Fan": ComponentConfig(
            "Cooling Fan", 0.05, degradation_rate=0.20, health_fn=fan_health,
            fault_action="Replace Cooling Fan",
        ),
    },
    # --- Example of how a future machine type would be added ---
    # "Robotic Arm": {
    #     "Servo Motor": ComponentConfig("Servo Motor", 0.4, 0.5, motor_health),
    #     "Joint Bearing": ComponentConfig("Joint Bearing", 0.4, 0.6, bearing_health),
    #     "Controller": ComponentConfig("Controller", 0.2, 0.3, fan_health),
    # },
}

# Status thresholds shared across all machine types
STATUS_RULES = [
    (80, 100, "Healthy", "#2ecc71"),
    (60, 79.999, "Warning", "#f1c40f"),
    (40, 59.999, "Critical", "#e67e22"),
    (0, 39.999, "Failure Risk", "#e74c3c"),
]


def status_for_score(score: float) -> tuple[str, str]:
    """Return (status_label, hex_color) for a given health score."""
    for lo, hi, label, color in STATUS_RULES:
        if lo <= score <= hi:
            return label, color
    return "Unknown", "#7f8c8d"


def components_for_type(machine_type: str) -> Dict[str, ComponentConfig]:
    """Return the component config dict for a machine type, falling back to
    'Conveyor' if an unknown type is encountered (keeps the UI resilient)."""
    return MACHINE_TYPE_CONFIGS.get(machine_type, MACHINE_TYPE_CONFIGS["Conveyor"])


# Sensor slider ranges - centralized so the simulator GUI stays config-driven
SENSOR_RANGES = {
    "temperature": (20.0, 120.0, "°C"),
    "vibration": (0.0, 2.0, "mm/s"),
    "current": (0.0, 20.0, "A"),
    "operating_hours": (0.0, 10000.0, "hrs"),
}

DB_PATH = "database/factory.db"
