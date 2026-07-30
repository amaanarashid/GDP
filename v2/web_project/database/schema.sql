-- schema.sql
-- AGV Predictive Maintenance & Digital Twin Monitoring System
-- Scalable schema: new machines are added as rows, never as new tables/columns.

CREATE TABLE IF NOT EXISTS machines (
    machine_id      TEXT PRIMARY KEY,
    machine_name    TEXT NOT NULL,
    location        TEXT NOT NULL,
    machine_type    TEXT NOT NULL,
    status          TEXT DEFAULT 'Healthy',
    health_score    REAL DEFAULT 100.0,
    last_updated    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_data (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,
    machine_id       TEXT NOT NULL,
    temperature      REAL,
    vibration        REAL,
    current          REAL,
    operating_hours  REAL,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
    maintenance_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id       TEXT NOT NULL,
    maintenance_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    action_taken     TEXT,
    notes            TEXT,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

-- Component-level health, kept generic (component_name is free text) so any
-- machine type's component set can be stored without schema changes.
CREATE TABLE IF NOT EXISTS component_health (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id      TEXT NOT NULL,
    component_name  TEXT NOT NULL,
    health_score    REAL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

-- Tracks which machine the AGV "scanned" most recently, so both GUIs
-- (running as separate processes) can stay in sync via the shared DB.
CREATE TABLE IF NOT EXISTS agv_state (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    active_machine_id TEXT,
    last_scan_time  DATETIME
);

CREATE INDEX IF NOT EXISTS idx_sensor_machine_time ON sensor_data(machine_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_component_machine ON component_health(machine_id, component_name);
