"""
app.py
=======
Flask backend for the web version of the AGV Predictive Maintenance system.
Reuses the exact same business-logic modules as the desktop PyQt version
(config.py, database/, models/, services/) - only the presentation layer
changed from PyQt widgets to HTML/JS + a JSON API.

Two separate pages (no shared navigation — open each URL independently):
    /             -> technician dashboard (main_dashboard.py equivalent)
    /simulator    -> machine simulator (machine_simulator.py equivalent)

Both poll the API every ~1.5s and share the same SQLite database,
mirroring the two-process desktop architecture as two standalone browser pages.

Run with:  python app.py
Then open: http://127.0.0.1:5000/           (technician dashboard)
           http://127.0.0.1:5000/simulator  (machine simulator)
"""

from __future__ import annotations
import os
from flask import Flask, render_template, request, jsonify, send_file

from database.database import Database
from models.sensor_data import SensorData
from services.health_engine import HealthEngine
from services.prediction_engine import PredictionEngine
from services.simulator_service import SimulatorService
from services.qr_service import QRService
from config import SENSOR_RANGES, status_for_score

app = Flask(__name__)
db = Database()
sim = SimulatorService()
qr_service = QRService(output_dir=os.path.join(os.path.dirname(__file__), "static", "qr_codes"))

# Seed initial machine on startup (same as desktop version)
db.seed_machine_if_missing("M001", "Conveyor Drive System", "Zone A", "Conveyor")


# ---------------------------------------------------------------------- #
# Pages
# ---------------------------------------------------------------------- #
@app.route("/")
def dashboard_page():
    return render_template("dashboard.html")


@app.route("/simulator")
def simulator_page():
    return render_template("simulator.html", sensor_ranges=SENSOR_RANGES)


# ---------------------------------------------------------------------- #
# API: machines
# ---------------------------------------------------------------------- #
@app.route("/api/machines")
def api_machines():
    return jsonify(db.list_machines())


@app.route("/api/machines", methods=["POST"])
def api_add_machine():
    data = request.json
    db.add_machine(data["machine_id"], data["machine_name"], data["location"],
                    data["machine_type"])
    return jsonify({"ok": True})


@app.route("/api/scan", methods=["POST"])
def api_scan():
    machine_id = request.json["machine_id"]
    db.set_active_machine(machine_id)
    return jsonify({"ok": True, "machine_id": machine_id})


@app.route("/api/active_machine")
def api_active_machine():
    return jsonify({"machine_id": db.get_active_machine()})


# ---------------------------------------------------------------------- #
# API: full dashboard state for a machine (one call -> everything needed)
# ---------------------------------------------------------------------- #
@app.route("/api/state/<machine_id>")
def api_state(machine_id):
    machine = db.get_machine(machine_id)
    if not machine:
        return jsonify({"error": "machine not found"}), 404

    latest = db.get_latest_sensor_reading(machine_id)
    if not latest:
        return jsonify({"machine": machine, "reading": None})

    reading = SensorData.from_row(latest)
    health_engine = HealthEngine(machine["machine_type"])
    component_health, overall, status, color = health_engine.evaluate(reading)

    for name, score in component_health.items():
        db.upsert_component_health(machine_id, name, score)
    db.update_machine_health(machine_id, overall, status)

    prediction_engine = PredictionEngine(machine["machine_type"])
    prediction = prediction_engine.predict(component_health)

    history = db.get_sensor_history(machine_id, limit=100)

    return jsonify({
        "machine": machine,
        "reading": {
            "temperature": reading.temperature,
            "vibration": reading.vibration,
            "current": reading.current,
            "operating_hours": reading.operating_hours,
            "timestamp": reading.timestamp,
        },
        "component_health": component_health,
        "overall_health": overall,
        "status": status,
        "status_color": color,
        "prediction": {
            "most_critical_component": prediction.most_critical_component,
            "component_health": prediction.component_health,
            "predicted_failure": prediction.predicted_failure,
            "remaining_useful_life_days": prediction.remaining_useful_life_days,
            "recommended_action": prediction.recommended_action,
            "confidence_pct": prediction.confidence_pct,
            "priority_level": prediction.priority_level,
            "estimated_downtime_hours": prediction.estimated_downtime_hours,
            "estimated_cost_usd": prediction.estimated_cost_usd,
        },
        "history": {
            "timestamps": [h["timestamp"] for h in history],
            "temperature": [h["temperature"] for h in history],
            "vibration": [h["vibration"] for h in history],
            "operating_hours": [h["operating_hours"] for h in history],
        },
        "maintenance_logs": db.get_maintenance_logs(machine_id)[:10],
    })


# ---------------------------------------------------------------------- #
# API: simulator controls
# ---------------------------------------------------------------------- #
@app.route("/api/sim/state/<machine_id>")
def api_sim_state(machine_id):
    latest = db.get_latest_sensor_reading(machine_id)
    if latest:
        sim.set_values(machine_id, latest["temperature"], latest["vibration"],
                        latest["current"], latest["operating_hours"])
    return jsonify(sim.as_dict(machine_id))


@app.route("/api/sim/update", methods=["POST"])
def api_sim_update():
    data = request.json
    machine_id = data["machine_id"]
    state = sim.set_values(machine_id, data["temperature"], data["vibration"],
                            data["current"], data["operating_hours"])
    db.insert_sensor_reading(machine_id, state.temperature, state.vibration,
                              state.current, state.operating_hours)
    return jsonify(sim.as_dict(machine_id))


@app.route("/api/sim/tick", methods=["POST"])
def api_sim_tick():
    """Called repeatedly by the browser's setInterval while auto-sim is on."""
    machine_id = request.json["machine_id"]
    state = sim.tick_auto_simulation(machine_id)
    db.insert_sensor_reading(machine_id, state.temperature, state.vibration,
                              state.current, state.operating_hours)
    return jsonify(sim.as_dict(machine_id))


@app.route("/api/sim/fault", methods=["POST"])
def api_sim_fault():
    data = request.json
    machine_id = data["machine_id"]
    fault_type = data["fault_type"]  # "bearing" | "gearbox" | "motor"

    fault_map = {
        "bearing": (sim.inject_bearing_fault, "Bearing Fault"),
        "gearbox": (sim.inject_gearbox_fault, "Gearbox Fault"),
        "motor": (sim.inject_motor_fault, "Motor Fault"),
    }
    if fault_type not in fault_map:
        return jsonify({"error": "unknown fault type"}), 400

    fault_fn, fault_name = fault_map[fault_type]
    state = fault_fn(machine_id)
    db.insert_sensor_reading(machine_id, state.temperature, state.vibration,
                              state.current, state.operating_hours)
    db.add_maintenance_log(machine_id, f"Fault Injected: {fault_name}",
                            "Simulated via web Simulator page")
    return jsonify(sim.as_dict(machine_id))


@app.route("/api/sim/reset", methods=["POST"])
def api_sim_reset():
    machine_id = request.json["machine_id"]
    state = sim.reset(machine_id)
    db.reset_machine_sensors(machine_id)
    db.add_maintenance_log(machine_id, "Machine Reset", "Reset to baseline via web Simulator page")
    return jsonify(sim.as_dict(machine_id))


# ---------------------------------------------------------------------- #
# API: QR codes
# ---------------------------------------------------------------------- #
@app.route("/api/qr/<machine_id>")
def api_qr(machine_id):
    path = qr_service.generate_qr(machine_id)
    if not path:
        return jsonify({"error": "qrcode package not installed"}), 500
    return send_file(path, mimetype="image/png")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
