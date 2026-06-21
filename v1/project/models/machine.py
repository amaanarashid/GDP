"""models/machine.py - dataclass representation of a machine row."""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Machine:
    machine_id: str
    machine_name: str
    location: str
    machine_type: str
    status: str = "Healthy"
    health_score: float = 100.0
    last_updated: str = ""

    @classmethod
    def from_row(cls, row: dict) -> "Machine":
        return cls(
            machine_id=row["machine_id"],
            machine_name=row["machine_name"],
            location=row["location"],
            machine_type=row["machine_type"],
            status=row.get("status", "Healthy"),
            health_score=row.get("health_score", 100.0),
            last_updated=row.get("last_updated", ""),
        )
