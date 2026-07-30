"""
services/simulator_service.py
===============================
Business logic behind the Machine Simulator GUI: holds current sensor
state for the selected machine, applies fault-injection rules, and drives
"auto simulation" drift. Kept separate from the PyQt widget code so the
simulation logic is independently testable and reusable.
"""

from __future__ import annotations
import random
from dataclasses import dataclass, asdict
from config import SENSOR_RANGES


@dataclass
class SimState:
    temperature: float = 25.0
    vibration: float = 0.1
    current: float = 4.0
    operating_hours: float = 0.0

    def clamp(self) -> None:
        t_lo, t_hi, _ = SENSOR_RANGES["temperature"]
        v_lo, v_hi, _ = SENSOR_RANGES["vibration"]
        c_lo, c_hi, _ = SENSOR_RANGES["current"]
        h_lo, h_hi, _ = SENSOR_RANGES["operating_hours"]
        self.temperature = max(t_lo, min(t_hi, self.temperature))
        self.vibration = max(v_lo, min(v_hi, self.vibration))
        self.current = max(c_lo, min(c_hi, self.current))
        self.operating_hours = max(h_lo, min(h_hi, self.operating_hours))


class SimulatorService:
    """Holds one SimState per machine_id so switching machines in the
    dropdown doesn't lose each machine's independent simulated state."""

    def __init__(self):
        self._states: dict[str, SimState] = {}

    def get_state(self, machine_id: str) -> SimState:
        if machine_id not in self._states:
            self._states[machine_id] = SimState()
        return self._states[machine_id]

    def set_values(self, machine_id: str, temperature: float, vibration: float,
                   current: float, operating_hours: float) -> SimState:
        state = self.get_state(machine_id)
        state.temperature = temperature
        state.vibration = vibration
        state.current = current
        state.operating_hours = operating_hours
        state.clamp()
        return state

    def reset(self, machine_id: str) -> SimState:
        self._states[machine_id] = SimState()
        return self._states[machine_id]

    # ------------------------------------------------------------------ #
    # Fault injection
    # ------------------------------------------------------------------ #
    def inject_bearing_fault(self, machine_id: str) -> SimState:
        s = self.get_state(machine_id)
        s.vibration += 0.9
        s.temperature += 25
        s.clamp()
        return s

    def inject_gearbox_fault(self, machine_id: str) -> SimState:
        s = self.get_state(machine_id)
        s.vibration += 0.5
        s.operating_hours += 2500
        s.clamp()
        return s

    def inject_motor_fault(self, machine_id: str) -> SimState:
        s = self.get_state(machine_id)
        s.temperature += 40
        s.current += 8
        s.clamp()
        return s

    # ------------------------------------------------------------------ #
    # Auto simulation drift (called on a QTimer tick)
    # ------------------------------------------------------------------ #
    def tick_auto_simulation(self, machine_id: str) -> SimState:
        s = self.get_state(machine_id)
        s.temperature += random.uniform(-0.5, 1.0)
        s.vibration += random.uniform(-0.02, 0.05)
        s.current += random.uniform(-0.3, 0.5)
        s.operating_hours += random.uniform(1, 5)
        s.vibration = max(0.0, s.vibration)
        s.current = max(0.0, s.current)
        s.clamp()
        return s

    def as_dict(self, machine_id: str) -> dict:
        return asdict(self.get_state(machine_id))
