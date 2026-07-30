"""models/sensor_data.py - dataclass representation of a sensor reading."""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class SensorData:
    machine_id: str
    temperature: float
    vibration: float
    current: float
    operating_hours: float
    timestamp: str = ""

    @classmethod
    def from_row(cls, row: dict) -> "SensorData":
        return cls(
            machine_id=row["machine_id"],
            temperature=row["temperature"],
            vibration=row["vibration"],
            current=row["current"],
            operating_hours=row["operating_hours"],
            timestamp=row.get("timestamp", ""),
        )

    def as_kwargs(self) -> dict:
        """Used to feed health_fn(**reading) calls in config.py formulas."""
        return {
            "temperature": self.temperature,
            "vibration": self.vibration,
            "current": self.current,
            "operating_hours": self.operating_hours,
        }
