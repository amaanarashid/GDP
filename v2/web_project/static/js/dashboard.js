// dashboard.js — polls /api/state/<machine_id> every 1.5s and renders
// every section of the technician dashboard, including the SVG digital twin.

const POLL_MS = 1500;
let currentMachineId = "M001";
let charts = {};

const STATUS_COLORS = {
  "Healthy": "#3ddc84",
  "Warning": "#f5c542",
  "Critical": "#ff8c42",
  "Failure Risk": "#ff4d4d",
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

async function loadMachines() {
  const res = await fetch("/api/machines");
  const machines = await res.json();
  const select = document.getElementById("agvMachineSelect");
  const prev = select.value;
  select.innerHTML = "";
  machines.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.machine_id;
    opt.textContent = `${m.machine_id} - ${m.machine_name}`;
    select.appendChild(opt);
  });
  if (prev) select.value = prev;
}

async function scanQr() {
  const select = document.getElementById("agvMachineSelect");
  const machineId = select.value;
  if (!machineId) return;
  await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id: machineId }),
  });
  currentMachineId = machineId;
  document.getElementById("agvScanStatus").textContent = `Scanned: ${machineId}`;
  showToast(`QR scanned — loaded ${machineId}`);
  refresh();
}

async function generateQrCodes() {
  const res = await fetch("/api/machines");
  const machines = await res.json();
  for (const m of machines) {
    await fetch(`/api/qr/${m.machine_id}`);
  }
  showToast("QR codes generated for all machines");
}

function pct(value, lo, hi) {
  return Math.max(0, Math.min(100, ((value - lo) / (hi - lo)) * 100));
}

function setupCharts() {
  const opts = (label, color) => ({
    type: "line",
    data: { labels: [], datasets: [{ label, data: [], borderColor: color, backgroundColor: "transparent", tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: { display: true, text: label, color: "#8a96a3", font: { family: "JetBrains Mono", size: 11 } } },
      scales: {
        x: { display: false },
        y: { ticks: { color: "#5b6570", font: { size: 9 } }, grid: { color: "#232b33" } },
      },
    },
  });
  charts.temp = new Chart(document.getElementById("chart-temp"), opts("Temperature (°C)", "#ff4d4d"));
  charts.vib = new Chart(document.getElementById("chart-vib"), opts("Vibration (mm/s)", "#f5c542"));
  charts.hrs = new Chart(document.getElementById("chart-hrs"), opts("Operating Hours", "#3ddc84"));
}

function updateCharts(history) {
  const labels = history.timestamps.map((_, i) => i);
  charts.temp.data.labels = labels; charts.temp.data.datasets[0].data = history.temperature; charts.temp.update("none");
  charts.vib.data.labels = labels; charts.vib.data.datasets[0].data = history.vibration; charts.vib.update("none");
  charts.hrs.data.labels = labels; charts.hrs.data.datasets[0].data = history.operating_hours; charts.hrs.update("none");
}

function updateTwin(componentHealth) {
  for (const [name, health] of Object.entries(componentHealth)) {
    const rect = document.getElementById(`twin-${name}`);
    const label = document.getElementById(`twin-label-${name}`);
    if (!rect) continue;
    let color = "#3ddc84";
    if (health < 40) color = "#ff4d4d";
    else if (health < 60) color = "#ff8c42";
    else if (health < 80) color = "#f5c542";
    rect.setAttribute("fill", color);
    if (health < 40) {
      rect.style.filter = `drop-shadow(0 0 8px ${color})`;
    } else {
      rect.style.filter = "none";
    }
    if (label) label.textContent = `${health.toFixed(0)}%`;
  }
}

function renderLogs(logs) {
  const list = document.getElementById("log-list");
  if (!logs || logs.length === 0) {
    list.innerHTML = '<li class="muted">No activity yet</li>';
    return;
  }
  list.innerHTML = logs.map(l => `
    <li><span class="log-action">${l.action_taken}</span><span>${new Date(l.maintenance_date).toLocaleTimeString()}</span></li>
  `).join("");
}

async function refresh() {
  // Sync to whatever machine was last scanned (could be another tab/process)
  const activeRes = await fetch("/api/active_machine");
  const active = await activeRes.json();
  if (active.machine_id) currentMachineId = active.machine_id;

  const res = await fetch(`/api/state/${currentMachineId}`);
  if (!res.ok) return;
  const data = await res.json();

  // Section 1 — Machine Information
  document.getElementById("m-id").textContent = data.machine.machine_id;
  document.getElementById("m-name").textContent = data.machine.machine_name;
  document.getElementById("m-location").textContent = data.machine.location;
  document.getElementById("m-type").textContent = data.machine.machine_type;
  document.getElementById("m-updated").textContent = data.machine.last_updated || "—";

  if (!data.reading) return; // no sensor data written yet

  // Section 2 — Live Sensor Data
  document.getElementById("s-temp").innerHTML = `${data.reading.temperature.toFixed(1)} <span class="sensor-card__unit">°C</span>`;
  document.getElementById("s-vib").innerHTML = `${data.reading.vibration.toFixed(2)} <span class="sensor-card__unit">mm/s</span>`;
  document.getElementById("s-cur").innerHTML = `${data.reading.current.toFixed(1)} <span class="sensor-card__unit">A</span>`;
  document.getElementById("s-hrs").innerHTML = `${data.reading.operating_hours.toFixed(0)} <span class="sensor-card__unit">hrs</span>`;
  document.getElementById("s-temp-bar").style.width = pct(data.reading.temperature, 20, 120) + "%";
  document.getElementById("s-vib-bar").style.width = pct(data.reading.vibration, 0, 2) + "%";
  document.getElementById("s-cur-bar").style.width = pct(data.reading.current, 0, 20) + "%";
  document.getElementById("s-hrs-bar").style.width = pct(data.reading.operating_hours, 0, 10000) + "%";

  // Section 3 — Machine Health
  document.getElementById("h-score").innerHTML = `${data.overall_health.toFixed(1)} <span style="font-size:16px;color:var(--mist-dim);">/100</span>`;
  const statusPill = document.getElementById("h-status");
  statusPill.innerHTML = `<span class="dot"></span>${data.status}`;
  statusPill.style.color = data.status_color;

  // Section 4 — Predictive Maintenance
  const p = data.prediction;
  document.getElementById("p-component").textContent = `${p.most_critical_component} (${p.component_health.toFixed(1)}%)`;
  document.getElementById("p-failure").textContent = p.predicted_failure;
  document.getElementById("p-rul").textContent = `${p.remaining_useful_life_days.toFixed(1)} days`;
  document.getElementById("p-action").textContent = p.recommended_action;
  document.getElementById("p-confidence").textContent = `${p.confidence_pct.toFixed(1)}%`;

  // Section 5 — Digital Twin
  updateTwin(data.component_health);

  // Section 6 — Historical Trends
  updateCharts(data.history);

  // Section 7 — Maintenance Recommendation
  document.getElementById("r-action").textContent = p.recommended_action;
  document.getElementById("r-priority").textContent = p.priority_level;
  document.getElementById("r-downtime").textContent = `${p.estimated_downtime_hours.toFixed(1)} hrs`;
  document.getElementById("r-cost").textContent = `$${p.estimated_cost_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  renderLogs(data.maintenance_logs);
}

document.getElementById("scanBtn").addEventListener("click", scanQr);
document.getElementById("genQrBtn").addEventListener("click", generateQrCodes);

(async function init() {
  await loadMachines();
  setupCharts();
  await refresh();
  setInterval(refresh, POLL_MS);
  setInterval(loadMachines, 6000);
})();
