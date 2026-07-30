"""
machine_simulator.py
======================
Standalone PyQt6 window that acts as a "virtual machine". Lets the user
manually set sensor values or run auto-simulation, and inject faults.
All changes are written immediately to the shared SQLite database so the
Technician Dashboard (running in a separate process) picks them up on its
next QTimer poll.

Run with:  python machine_simulator.py
"""

from __future__ import annotations
import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGroupBox,
    QLabel, QSlider, QPushButton, QComboBox, QGridLayout, QMessageBox
)
from PyQt6.QtCore import Qt, QTimer

from database.database import Database
from services.simulator_service import SimulatorService
from config import SENSOR_RANGES


class SliderRow(QWidget):
    """A labeled slider with a live value readout, scaled to one decimal
    place for sliders whose real range is fractional (vibration)."""

    def __init__(self, label: str, lo: float, hi: float, unit: str, decimals: int = 1):
        super().__init__()
        self.decimals = decimals
        self.scale = 10 ** decimals
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.title = QLabel(f"{label}:")
        self.title.setFixedWidth(120)
        self.slider = QSlider(Qt.Orientation.Horizontal)
        self.slider.setMinimum(int(lo * self.scale))
        self.slider.setMaximum(int(hi * self.scale))
        self.value_label = QLabel("")
        self.value_label.setFixedWidth(80)
        self.unit = unit

        self.slider.valueChanged.connect(self._on_change)

        layout.addWidget(self.title)
        layout.addWidget(self.slider)
        layout.addWidget(self.value_label)

    def _on_change(self, raw_value: int) -> None:
        self.value_label.setText(f"{self.value():.{self.decimals}f} {self.unit}")

    def value(self) -> float:
        return self.slider.value() / self.scale

    def set_value(self, v: float) -> None:
        self.slider.blockSignals(True)
        self.slider.setValue(int(v * self.scale))
        self.slider.blockSignals(False)
        self.value_label.setText(f"{v:.{self.decimals}f} {self.unit}")


class MachineSimulatorWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Machine Simulator")
        self.resize(520, 480)

        self.db = Database()
        self.sim = SimulatorService()
        self.auto_timer = QTimer()
        self.auto_timer.setInterval(1500)
        self.auto_timer.timeout.connect(self._auto_tick)

        self._build_ui()
        self._load_machines()
        self._sync_sliders_from_state()

    # ------------------------------------------------------------------ #
    # UI construction
    # ------------------------------------------------------------------ #
    def _build_ui(self) -> None:
        central = QWidget()
        layout = QVBoxLayout(central)

        # Machine selector
        sel_box = QGroupBox("Machine Selection")
        sel_layout = QHBoxLayout(sel_box)
        self.machine_combo = QComboBox()
        self.machine_combo.currentTextChanged.connect(self._on_machine_changed)
        sel_layout.addWidget(QLabel("Active Machine:"))
        sel_layout.addWidget(self.machine_combo)
        layout.addWidget(sel_box)

        # Sensor controls
        sensor_box = QGroupBox("Sensor Controls")
        sensor_layout = QVBoxLayout(sensor_box)

        t_lo, t_hi, t_unit = SENSOR_RANGES["temperature"]
        v_lo, v_hi, v_unit = SENSOR_RANGES["vibration"]
        c_lo, c_hi, c_unit = SENSOR_RANGES["current"]
        h_lo, h_hi, h_unit = SENSOR_RANGES["operating_hours"]

        self.temp_slider = SliderRow("Temperature", t_lo, t_hi, t_unit, decimals=0)
        self.vib_slider = SliderRow("Vibration", v_lo, v_hi, v_unit, decimals=2)
        self.cur_slider = SliderRow("Current", c_lo, c_hi, c_unit, decimals=1)
        self.hrs_slider = SliderRow("Operating Hours", h_lo, h_hi, h_unit, decimals=0)

        for row in (self.temp_slider, self.vib_slider, self.cur_slider, self.hrs_slider):
            sensor_layout.addWidget(row)

        layout.addWidget(sensor_box)

        # Buttons
        btn_box = QGroupBox("Controls")
        btn_grid = QGridLayout(btn_box)

        self.update_btn = QPushButton("Update Values")
        self.start_btn = QPushButton("Start Auto Simulation")
        self.stop_btn = QPushButton("Stop Auto Simulation")
        self.bearing_fault_btn = QPushButton("Inject Bearing Fault")
        self.gearbox_fault_btn = QPushButton("Inject Gearbox Fault")
        self.motor_fault_btn = QPushButton("Inject Motor Fault")
        self.reset_btn = QPushButton("Reset Machine")

        self.update_btn.clicked.connect(self._on_update_clicked)
        self.start_btn.clicked.connect(self._on_start_auto)
        self.stop_btn.clicked.connect(self._on_stop_auto)
        self.bearing_fault_btn.clicked.connect(self._on_bearing_fault)
        self.gearbox_fault_btn.clicked.connect(self._on_gearbox_fault)
        self.motor_fault_btn.clicked.connect(self._on_motor_fault)
        self.reset_btn.clicked.connect(self._on_reset)

        btn_grid.addWidget(self.update_btn, 0, 0)
        btn_grid.addWidget(self.start_btn, 0, 1)
        btn_grid.addWidget(self.stop_btn, 1, 1)
        btn_grid.addWidget(self.bearing_fault_btn, 2, 0)
        btn_grid.addWidget(self.gearbox_fault_btn, 2, 1)
        btn_grid.addWidget(self.motor_fault_btn, 3, 0)
        btn_grid.addWidget(self.reset_btn, 3, 1)

        layout.addWidget(btn_box)

        self.status_label = QLabel("Status: Idle")
        layout.addWidget(self.status_label)

        self.setCentralWidget(central)

    # ------------------------------------------------------------------ #
    # Data loading
    # ------------------------------------------------------------------ #
    def _load_machines(self) -> None:
        # Seed the initial machine on first run (scalability: future machines
        # are simply added rows, picked up automatically here).
        self.db.seed_machine_if_missing("M001", "Conveyor Drive System", "Zone A", "Conveyor")

        self.machine_combo.blockSignals(True)
        self.machine_combo.clear()
        machines = self.db.list_machines()
        for m in machines:
            self.machine_combo.addItem(f"{m['machine_id']} - {m['machine_name']}", m["machine_id"])
        self.machine_combo.blockSignals(False)

    def current_machine_id(self) -> str:
        idx = self.machine_combo.currentIndex()
        return self.machine_combo.itemData(idx) if idx >= 0 else "M001"

    def _sync_sliders_from_state(self) -> None:
        machine_id = self.current_machine_id()
        latest = self.db.get_latest_sensor_reading(machine_id)
        if latest:
            state = self.sim.set_values(
                machine_id, latest["temperature"], latest["vibration"],
                latest["current"], latest["operating_hours"],
            )
        else:
            state = self.sim.get_state(machine_id)

        self.temp_slider.set_value(state.temperature)
        self.vib_slider.set_value(state.vibration)
        self.cur_slider.set_value(state.current)
        self.hrs_slider.set_value(state.operating_hours)

    # ------------------------------------------------------------------ #
    # Event handlers
    # ------------------------------------------------------------------ #
    def _on_machine_changed(self, _text: str) -> None:
        self._sync_sliders_from_state()

    def _write_current_sliders_to_db(self) -> None:
        machine_id = self.current_machine_id()
        self.db.insert_sensor_reading(
            machine_id,
            temperature=self.temp_slider.value(),
            vibration=self.vib_slider.value(),
            current=self.cur_slider.value(),
            operating_hours=self.hrs_slider.value(),
        )
        self.status_label.setText(f"Status: Updated {machine_id} at sliders' current values")

    def _on_update_clicked(self) -> None:
        machine_id = self.current_machine_id()
        self.sim.set_values(
            machine_id, self.temp_slider.value(), self.vib_slider.value(),
            self.cur_slider.value(), self.hrs_slider.value(),
        )
        self._write_current_sliders_to_db()

    def _on_start_auto(self) -> None:
        self.auto_timer.start()
        self.status_label.setText("Status: Auto Simulation Running...")

    def _on_stop_auto(self) -> None:
        self.auto_timer.stop()
        self.status_label.setText("Status: Auto Simulation Stopped")

    def _auto_tick(self) -> None:
        machine_id = self.current_machine_id()
        state = self.sim.tick_auto_simulation(machine_id)
        self.temp_slider.set_value(state.temperature)
        self.vib_slider.set_value(state.vibration)
        self.cur_slider.set_value(state.current)
        self.hrs_slider.set_value(state.operating_hours)
        self.db.insert_sensor_reading(machine_id, state.temperature, state.vibration,
                                       state.current, state.operating_hours)

    def _apply_fault(self, fault_fn, fault_name: str) -> None:
        machine_id = self.current_machine_id()
        state = fault_fn(machine_id)
        self.temp_slider.set_value(state.temperature)
        self.vib_slider.set_value(state.vibration)
        self.cur_slider.set_value(state.current)
        self.hrs_slider.set_value(state.operating_hours)
        self.db.insert_sensor_reading(machine_id, state.temperature, state.vibration,
                                       state.current, state.operating_hours)
        self.db.add_maintenance_log(machine_id, f"Fault Injected: {fault_name}",
                                     "Simulated via Machine Simulator GUI")
        self.status_label.setText(f"Status: {fault_name} injected on {machine_id}")

    def _on_bearing_fault(self) -> None:
        self._apply_fault(self.sim.inject_bearing_fault, "Bearing Fault")

    def _on_gearbox_fault(self) -> None:
        self._apply_fault(self.sim.inject_gearbox_fault, "Gearbox Fault")

    def _on_motor_fault(self) -> None:
        self._apply_fault(self.sim.inject_motor_fault, "Motor Fault")

    def _on_reset(self) -> None:
        machine_id = self.current_machine_id()
        state = self.sim.reset(machine_id)
        self.temp_slider.set_value(state.temperature)
        self.vib_slider.set_value(state.vibration)
        self.cur_slider.set_value(state.current)
        self.hrs_slider.set_value(state.operating_hours)
        self.db.reset_machine_sensors(machine_id)
        self.db.add_maintenance_log(machine_id, "Machine Reset", "Reset to baseline via Simulator GUI")
        self.status_label.setText(f"Status: {machine_id} reset to baseline")


def main():
    app = QApplication(sys.argv)
    window = MachineSimulatorWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
