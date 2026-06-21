"""
main_dashboard.py
===================
Standalone PyQt6 window: "AGV Predictive Maintenance Dashboard".
Polls the shared SQLite database on a QTimer, recomputes health +
predictions via the services layer, and renders:

  1. Machine Information
  2. Live Sensor Data
  3. Machine Health
  4. Predictive Maintenance
  5. Digital Twin
  6. Historical Trends (Matplotlib)
  7. Maintenance Recommendation
  8. AGV Simulation panel (QR scan simulation, scalable to future machines)

Run with:  python main_dashboard.py
"""

from __future__ import annotations
import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QGroupBox, QLabel, QPushButton, QComboBox, QFrame, QScrollArea, QSizePolicy
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

from database.database import Database
from models.sensor_data import SensorData
from services.health_engine import HealthEngine
from services.prediction_engine import PredictionEngine
from services.qr_service import QRService
from digital_twin.twin_widget import TwinWidget
from config import status_for_score


def card(title: str) -> tuple[QGroupBox, QGridLayout]:
    box = QGroupBox(title)
    box.setStyleSheet("QGroupBox { font-weight: bold; }")
    layout = QGridLayout(box)
    return box, layout


class MetricLabel(QLabel):
    """A bold value label used inside info cards."""

    def __init__(self, text: str = "--"):
        super().__init__(text)
        f = QFont()
        f.setPointSize(11)
        f.setBold(True)
        self.setFont(f)


class DashboardWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("AGV Predictive Maintenance Dashboard")
        self.resize(1280, 900)

        self.db = Database()
        self.db.seed_machine_if_missing("M001", "Conveyor Drive System", "Zone A", "Conveyor")

        self.current_machine_id = "M001"
        self.qr_service = QRService()

        self._build_ui()

        self.timer = QTimer()
        self.timer.setInterval(1500)
        self.timer.timeout.connect(self.refresh)
        self.timer.start()

        self._load_machine_dropdown()
        self.refresh()

    # ------------------------------------------------------------------ #
    # UI construction
    # ------------------------------------------------------------------ #
    def _build_ui(self) -> None:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        container = QWidget()
        outer = QVBoxLayout(container)

        outer.addWidget(self._build_agv_panel())

        top_row = QHBoxLayout()
        top_row.addWidget(self._build_machine_info_card(), 1)
        top_row.addWidget(self._build_sensor_card(), 1)
        outer.addLayout(top_row)

        mid_row = QHBoxLayout()
        mid_row.addWidget(self._build_health_card(), 1)
        mid_row.addWidget(self._build_prediction_card(), 1)
        outer.addLayout(mid_row)

        outer.addWidget(self._build_twin_card())
        outer.addWidget(self._build_trends_card())
        outer.addWidget(self._build_recommendation_card())

        scroll.setWidget(container)
        self.setCentralWidget(scroll)

    def _build_agv_panel(self) -> QWidget:
        box, layout_grid = card("AGV Simulation Panel")
        layout = QHBoxLayout()
        layout.addWidget(QLabel("Select Machine to Scan:"))
        self.agv_combo = QComboBox()
        layout.addWidget(self.agv_combo)
        self.scan_btn = QPushButton("📷 Scan QR")
        self.scan_btn.clicked.connect(self._on_scan_qr)
        layout.addWidget(self.scan_btn)
        self.gen_qr_btn = QPushButton("Generate QR Codes for All Machines")
        self.gen_qr_btn.clicked.connect(self._on_generate_qr_codes)
        layout.addWidget(self.gen_qr_btn)
        layout.addStretch()
        wrapper = QWidget()
        wrapper.setLayout(layout)
        layout_grid.addWidget(wrapper, 0, 0)
        return box

    def _build_machine_info_card(self) -> QWidget:
        box, grid = card("1. Machine Information")
        self.lbl_machine_id = MetricLabel()
        self.lbl_machine_name = MetricLabel()
        self.lbl_location = MetricLabel()
        self.lbl_machine_type = MetricLabel()
        self.lbl_last_updated = MetricLabel()

        rows = [
            ("Machine ID:", self.lbl_machine_id),
            ("Machine Name:", self.lbl_machine_name),
            ("Location:", self.lbl_location),
            ("Machine Type:", self.lbl_machine_type),
            ("Last Updated:", self.lbl_last_updated),
        ]
        for i, (caption, widget) in enumerate(rows):
            grid.addWidget(QLabel(caption), i, 0)
            grid.addWidget(widget, i, 1)
        return box

    def _build_sensor_card(self) -> QWidget:
        box, grid = card("2. Live Sensor Data")
        self.lbl_temp = MetricLabel()
        self.lbl_vib = MetricLabel()
        self.lbl_cur = MetricLabel()
        self.lbl_hours = MetricLabel()

        rows = [
            ("Temperature:", self.lbl_temp),
            ("Vibration:", self.lbl_vib),
            ("Current:", self.lbl_cur),
            ("Operating Hours:", self.lbl_hours),
        ]
        for i, (caption, widget) in enumerate(rows):
            grid.addWidget(QLabel(caption), i, 0)
            grid.addWidget(widget, i, 1)
        return box

    def _build_health_card(self) -> QWidget:
        box, grid = card("3. Machine Health")
        self.lbl_overall_health = MetricLabel()
        self.lbl_overall_health.setFont(QFont("Segoe UI", 22, QFont.Weight.Bold))
        self.lbl_status = QLabel("Healthy")
        self.lbl_status.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.lbl_status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.lbl_status.setFixedHeight(40)
        self.lbl_status.setStyleSheet("background-color:#2ecc71; color:#0d0d14; border-radius:6px;")

        grid.addWidget(QLabel("Overall Health Score:"), 0, 0)
        grid.addWidget(self.lbl_overall_health, 0, 1)
        grid.addWidget(QLabel("Status:"), 1, 0)
        grid.addWidget(self.lbl_status, 1, 1)
        return box

    def _build_prediction_card(self) -> QWidget:
        box, grid = card("4. Predictive Maintenance")
        self.lbl_critical_component = MetricLabel()
        self.lbl_predicted_failure = MetricLabel()
        self.lbl_rul = MetricLabel()
        self.lbl_rec_action = MetricLabel()
        self.lbl_confidence = MetricLabel()

        rows = [
            ("Most Critical Component:", self.lbl_critical_component),
            ("Predicted Failure:", self.lbl_predicted_failure),
            ("Remaining Useful Life (days):", self.lbl_rul),
            ("Recommended Action:", self.lbl_rec_action),
            ("Confidence:", self.lbl_confidence),
        ]
        for i, (caption, widget) in enumerate(rows):
            widget.setWordWrap(True)
            grid.addWidget(QLabel(caption), i, 0)
            grid.addWidget(widget, i, 1)
        return box

    def _build_twin_card(self) -> QWidget:
        box, grid = card("5. Digital Twin")
        self.twin_widget = TwinWidget()
        grid.addWidget(self.twin_widget, 0, 0)
        legend = QLabel(
            "🟩 Healthy (80-100)   🟨 Warning (60-79)   🟧 Critical (40-59)   🟥 Failure Risk (<40)"
        )
        grid.addWidget(legend, 1, 0)
        return box

    def _build_trends_card(self) -> QWidget:
        box, grid = card("6. Historical Trends")
        self.figure = Figure(figsize=(10, 3.2))
        self.canvas = FigureCanvas(self.figure)
        self.ax_temp = self.figure.add_subplot(131)
        self.ax_vib = self.figure.add_subplot(132)
        self.ax_hours = self.figure.add_subplot(133)
        self.figure.tight_layout()
        grid.addWidget(self.canvas, 0, 0)
        return box

    def _build_recommendation_card(self) -> QWidget:
        box, grid = card("7. Maintenance Recommendation")
        self.lbl_rec2_action = MetricLabel()
        self.lbl_priority = MetricLabel()
        self.lbl_downtime = MetricLabel()
        self.lbl_cost = MetricLabel()

        rows = [
            ("Recommended Action:", self.lbl_rec2_action),
            ("Priority Level:", self.lbl_priority),
            ("Estimated Downtime (hrs):", self.lbl_downtime),
            ("Estimated Maintenance Cost ($):", self.lbl_cost),
        ]
        for i, (caption, widget) in enumerate(rows):
            grid.addWidget(QLabel(caption), i, 0)
            grid.addWidget(widget, i, 1)
        return box

    # ------------------------------------------------------------------ #
    # Data loading
    # ------------------------------------------------------------------ #
    def _load_machine_dropdown(self) -> None:
        self.agv_combo.blockSignals(True)
        self.agv_combo.clear()
        for m in self.db.list_machines():
            self.agv_combo.addItem(f"{m['machine_id']} - {m['machine_name']}", m["machine_id"])
        self.agv_combo.blockSignals(False)
        if self.agv_combo.count() > 0:
            self.agv_combo.setCurrentIndex(0)

    def _on_scan_qr(self) -> None:
        idx = self.agv_combo.currentIndex()
        machine_id = self.agv_combo.itemData(idx)
        if not machine_id:
            return
        # Simulate the QR scan hand-off: write to shared DB state, then load.
        self.db.set_active_machine(machine_id)
        self.current_machine_id = machine_id
        self.refresh()

    def _on_generate_qr_codes(self) -> None:
        paths = []
        for m in self.db.list_machines():
            p = self.qr_service.generate_qr(m["machine_id"])
            if p:
                paths.append(p)
        if paths:
            self.scan_btn.setToolTip(f"QR codes saved to assets/qr_codes/ ({len(paths)} files)")

    # ------------------------------------------------------------------ #
    # Refresh cycle (called every QTimer tick)
    # ------------------------------------------------------------------ #
    def refresh(self) -> None:
        # Reload dropdown in case new machines were added elsewhere
        if self.agv_combo.count() != len(self.db.list_machines()):
            self._load_machine_dropdown()

        # Pick up AGV scan state shared via DB (in case another process set it)
        active = self.db.get_active_machine()
        if active:
            self.current_machine_id = active

        machine = self.db.get_machine(self.current_machine_id)
        if not machine:
            return

        latest = self.db.get_latest_sensor_reading(self.current_machine_id)
        if not latest:
            self._update_machine_info(machine)
            return

        reading = SensorData.from_row(latest)

        health_engine = HealthEngine(machine["machine_type"])
        component_health, overall, status, color = health_engine.evaluate(reading)

        for name, score in component_health.items():
            self.db.upsert_component_health(self.current_machine_id, name, score)
        self.db.update_machine_health(self.current_machine_id, overall, status)

        prediction_engine = PredictionEngine(machine["machine_type"])
        prediction = prediction_engine.predict(component_health)

        self._update_machine_info(machine)
        self._update_sensor_data(reading)
        self._update_health(overall, status, color)
        self._update_prediction(prediction)
        self.twin_widget.update_health(component_health)
        self._update_trends()
        self._update_recommendation(prediction)

    def _update_machine_info(self, machine: dict) -> None:
        self.lbl_machine_id.setText(machine["machine_id"])
        self.lbl_machine_name.setText(machine["machine_name"])
        self.lbl_location.setText(machine["location"])
        self.lbl_machine_type.setText(machine["machine_type"])
        self.lbl_last_updated.setText(str(machine.get("last_updated", "--")))

    def _update_sensor_data(self, reading: SensorData) -> None:
        self.lbl_temp.setText(f"{reading.temperature:.1f} °C")
        self.lbl_vib.setText(f"{reading.vibration:.2f} mm/s")
        self.lbl_cur.setText(f"{reading.current:.1f} A")
        self.lbl_hours.setText(f"{reading.operating_hours:.0f} hrs")

    def _update_health(self, overall: float, status: str, color: str) -> None:
        self.lbl_overall_health.setText(f"{overall:.1f} / 100")
        self.lbl_status.setText(status)
        self.lbl_status.setStyleSheet(
            f"background-color:{color}; color:#0d0d14; border-radius:6px;"
        )

    def _update_prediction(self, prediction) -> None:
        self.lbl_critical_component.setText(
            f"{prediction.most_critical_component} ({prediction.component_health:.1f}%)"
        )
        self.lbl_predicted_failure.setText(prediction.predicted_failure)
        self.lbl_rul.setText(f"{prediction.remaining_useful_life_days:.1f}")
        self.lbl_rec_action.setText(prediction.recommended_action)
        self.lbl_confidence.setText(f"{prediction.confidence_pct:.1f}%")

    def _update_recommendation(self, prediction) -> None:
        self.lbl_rec2_action.setText(prediction.recommended_action)
        self.lbl_priority.setText(prediction.priority_level)
        self.lbl_downtime.setText(f"{prediction.estimated_downtime_hours:.1f}")
        self.lbl_cost.setText(f"{prediction.estimated_cost_usd:,.2f}")

    def _update_trends(self) -> None:
        history = self.db.get_sensor_history(self.current_machine_id, limit=100)
        if not history:
            return
        idx = list(range(len(history)))
        temps = [h["temperature"] for h in history]
        vibs = [h["vibration"] for h in history]
        hours = [h["operating_hours"] for h in history]

        for ax, data, title, color in (
            (self.ax_temp, temps, "Temperature", "#e74c3c"),
            (self.ax_vib, vibs, "Vibration", "#f1c40f"),
            (self.ax_hours, hours, "Operating Hours", "#3498db"),
        ):
            ax.clear()
            ax.plot(idx, data, color=color, linewidth=1.5)
            ax.set_title(title, fontsize=9)
            ax.tick_params(labelsize=7)

        self.figure.tight_layout()
        self.canvas.draw()


def main():
    app = QApplication(sys.argv)
    window = DashboardWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
