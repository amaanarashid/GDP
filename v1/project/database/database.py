"""
database/database.py
=====================
Thin, thread-safe-ish data access layer wrapping SQLite.

Both GUIs (machine_simulator.py and main_dashboard.py) import this module
and talk to the SAME factory.db file, which is how the two separate
processes/windows stay in sync without any direct IPC.
"""

from __future__ import annotations
import sqlite3
import os
import datetime as dt
from typing import Optional, List, Dict, Any

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")
DB_PATH = os.path.join(os.path.dirname(__file__), "factory.db")


class Database:
    """Lightweight wrapper around sqlite3 with row factory + helper methods."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")  # allows concurrent reader/writer GUIs
        return conn

    def _init_schema(self) -> None:
        with open(SCHEMA_PATH, "r") as f:
            schema = f.read()
        conn = self._connect()
        try:
            conn.executescript(schema)
            conn.execute(
                "INSERT OR IGNORE INTO agv_state (id, active_machine_id, last_scan_time) "
                "VALUES (1, NULL, NULL)"
            )
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # Machines
    # ------------------------------------------------------------------ #
    def seed_machine_if_missing(self, machine_id: str, name: str, location: str,
                                 machine_type: str) -> None:
        conn = self._connect()
        try:
            existing = conn.execute(
                "SELECT machine_id FROM machines WHERE machine_id = ?", (machine_id,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO machines (machine_id, machine_name, location, machine_type, "
                    "status, health_score, last_updated) VALUES (?, ?, ?, ?, 'Healthy', 100.0, ?)",
                    (machine_id, name, location, machine_type, dt.datetime.now()),
                )
                conn.commit()
        finally:
            conn.close()

    def add_machine(self, machine_id: str, name: str, location: str, machine_type: str) -> None:
        """Public API for adding future machines (M002, M003, ...) at runtime
        with zero code changes elsewhere -- satisfies the scalability requirement."""
        self.seed_machine_if_missing(machine_id, name, location, machine_type)

    def get_machine(self, machine_id: str) -> Optional[Dict[str, Any]]:
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT * FROM machines WHERE machine_id = ?", (machine_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def list_machines(self) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            rows = conn.execute("SELECT * FROM machines ORDER BY machine_id").fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def update_machine_health(self, machine_id: str, health_score: float, status: str) -> None:
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE machines SET health_score = ?, status = ?, last_updated = ? "
                "WHERE machine_id = ?",
                (health_score, status, dt.datetime.now(), machine_id),
            )
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # Sensor data
    # ------------------------------------------------------------------ #
    def insert_sensor_reading(self, machine_id: str, temperature: float, vibration: float,
                               current: float, operating_hours: float) -> None:
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO sensor_data (timestamp, machine_id, temperature, vibration, "
                "current, operating_hours) VALUES (?, ?, ?, ?, ?, ?)",
                (dt.datetime.now(), machine_id, temperature, vibration, current, operating_hours),
            )
            conn.commit()
        finally:
            conn.close()

    def get_latest_sensor_reading(self, machine_id: str) -> Optional[Dict[str, Any]]:
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT * FROM sensor_data WHERE machine_id = ? "
                "ORDER BY timestamp DESC, id DESC LIMIT 1",
                (machine_id,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_sensor_history(self, machine_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM sensor_data WHERE machine_id = ? "
                "ORDER BY timestamp ASC, id ASC LIMIT ?",
                (machine_id, limit),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # Component health
    # ------------------------------------------------------------------ #
    def upsert_component_health(self, machine_id: str, component_name: str,
                                 health_score: float) -> None:
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO component_health (machine_id, component_name, health_score, "
                "timestamp) VALUES (?, ?, ?, ?)",
                (machine_id, component_name, health_score, dt.datetime.now()),
            )
            conn.commit()
        finally:
            conn.close()

    def get_latest_component_health(self, machine_id: str) -> Dict[str, float]:
        conn = self._connect()
        try:
            rows = conn.execute(
                """
                SELECT ch.component_name, ch.health_score
                FROM component_health ch
                INNER JOIN (
                    SELECT component_name, MAX(id) AS max_id
                    FROM component_health
                    WHERE machine_id = ?
                    GROUP BY component_name
                ) latest ON ch.component_name = latest.component_name AND ch.id = latest.max_id
                """,
                (machine_id,),
            ).fetchall()
            return {r["component_name"]: r["health_score"] for r in rows}
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # Maintenance logs
    # ------------------------------------------------------------------ #
    def add_maintenance_log(self, machine_id: str, action_taken: str, notes: str = "") -> None:
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO maintenance_logs (machine_id, maintenance_date, action_taken, notes) "
                "VALUES (?, ?, ?, ?)",
                (machine_id, dt.datetime.now(), action_taken, notes),
            )
            conn.commit()
        finally:
            conn.close()

    def get_maintenance_logs(self, machine_id: str) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM maintenance_logs WHERE machine_id = ? "
                "ORDER BY maintenance_date DESC",
                (machine_id,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # AGV state (used to simulate the QR scan hand-off between processes)
    # ------------------------------------------------------------------ #
    def set_active_machine(self, machine_id: str) -> None:
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE agv_state SET active_machine_id = ?, last_scan_time = ? WHERE id = 1",
                (machine_id, dt.datetime.now()),
            )
            conn.commit()
        finally:
            conn.close()

    def get_active_machine(self) -> Optional[str]:
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT active_machine_id FROM agv_state WHERE id = 1"
            ).fetchone()
            return row["active_machine_id"] if row else None
        finally:
            conn.close()

    def reset_machine_sensors(self, machine_id: str) -> None:
        """Used by the 'Reset Machine' button - writes baseline healthy readings."""
        self.insert_sensor_reading(machine_id, temperature=25.0, vibration=0.1,
                                    current=4.0, operating_hours=0.0)
