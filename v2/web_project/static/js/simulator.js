// simulator.js — drives the Machine Simulator page: sliders, fault
// injection, auto-simulation polling, and writes through to the shared
// SQLite database via the Flask API. Mirrors machine_simulator.py.

const SENSOR_KEYS = ["temperature", "vibration", "current", "operating_hours"];
const DECIMALS = { temperature: 0, vibration: 2, current: 1, operating_hours: 0 };
const UNITS = { temperature: "°C", vibration: "mm/s", current: "A", operating_hours: "hrs" };

let currentMachineId = "M001";
let autoTimer = null;
const AUTO_MS = 1500;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function setStatus(msg) {
  document.getElementById("simStatus").textContent = `Status: ${msg}`;
}

function applyStateToSliders(state) {
  SENSOR_KEYS.forEach(key => {
    const slider = document.getElementById(`slider-${key}`);
    const label = document.getElementById(`val-${key}`);
    const value = state[key];
    slider.value = value;
    label.textContent = value.toFixed(DECIMALS[key]);
  });
}

function readSlidersAsPayload() {
  const payload = { machine_id: currentMachineId };
  SENSOR_KEYS.forEach(key => {
    payload[key] = parseFloat(document.getElementById(`slider-${key}`).value);
  });
  return payload;
}

async function loadMachines() {
  const res = await fetch("/api/machines");
  const machines = await res.json();
  const select = document.getElementById("machineSelect");
  const prev = select.value;
  select.innerHTML = "";
  machines.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.machine_id;
    opt.textContent = `${m.machine_id} - ${m.machine_name}`;
    select.appendChild(opt);
  });
  if (prev && [...select.options].some(o => o.value === prev)) {
    select.value = prev;
  }
  currentMachineId = select.value || "M001";
}

async function syncStateFromServer() {
  const res = await fetch(`/api/sim/state/${currentMachineId}`);
  const state = await res.json();
  applyStateToSliders(state);
}

async function onMachineChanged() {
  currentMachineId = document.getElementById("machineSelect").value;
  stopAuto();
  await syncStateFromServer();
  setStatus(`Idle — viewing ${currentMachineId}`);
}

async function onUpdateClicked() {
  const payload = readSlidersAsPayload();
  const res = await fetch("/api/sim/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const state = await res.json();
  applyStateToSliders(state);
  setStatus(`Updated ${currentMachineId}`);
  showToast(`${currentMachineId} sensor values written to database`);
}

async function autoTick() {
  const res = await fetch("/api/sim/tick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id: currentMachineId }),
  });
  const state = await res.json();
  applyStateToSliders(state);
}

function startAuto() {
  if (autoTimer) return;
  autoTimer = setInterval(autoTick, AUTO_MS);
  setStatus(`Auto Simulation Running on ${currentMachineId}...`);
  showToast("Auto simulation started");
}

function stopAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    setStatus(`Auto Simulation Stopped`);
  }
}

async function injectFault(faultType, label) {
  const res = await fetch("/api/sim/fault", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id: currentMachineId, fault_type: faultType }),
  });
  const state = await res.json();
  applyStateToSliders(state);
  setStatus(`${label} injected on ${currentMachineId}`);
  showToast(`⚠ ${label} injected — check the dashboard`);
}

async function resetMachine() {
  const res = await fetch("/api/sim/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id: currentMachineId }),
  });
  const state = await res.json();
  applyStateToSliders(state);
  stopAuto();
  setStatus(`${currentMachineId} reset to baseline`);
  showToast(`${currentMachineId} reset to baseline`);
}

// Wire up live readout while dragging (before "Update Values" commits to DB)
SENSOR_KEYS.forEach(key => {
  document.getElementById(`slider-${key}`).addEventListener("input", (e) => {
    document.getElementById(`val-${key}`).textContent =
      parseFloat(e.target.value).toFixed(DECIMALS[key]);
  });
});

document.getElementById("machineSelect").addEventListener("change", onMachineChanged);
document.getElementById("updateBtn").addEventListener("click", onUpdateClicked);
document.getElementById("startAutoBtn").addEventListener("click", startAuto);
document.getElementById("stopAutoBtn").addEventListener("click", stopAuto);
document.getElementById("bearingFaultBtn").addEventListener("click", () => injectFault("bearing", "Bearing Fault"));
document.getElementById("gearboxFaultBtn").addEventListener("click", () => injectFault("gearbox", "Gearbox Fault"));
document.getElementById("motorFaultBtn").addEventListener("click", () => injectFault("motor", "Motor Fault"));
document.getElementById("resetBtn").addEventListener("click", resetMachine);

(async function init() {
  await loadMachines();
  await syncStateFromServer();
  setStatus(`Idle — viewing ${currentMachineId}`);
  setInterval(loadMachines, 6000);
})();
