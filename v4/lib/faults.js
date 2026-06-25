// ============================================================
// FAULT DEFINITIONS — per machine type
// Each fault targets specific sensors on specific components,
// pushing them toward warning/critical over a ramp period.
// ============================================================

// A fault describes: which sensors it affects and how their
// target value shifts (as a fraction toward/past critical).
// intensity 0..1 → how far the affected sensors are driven.

export const FAULTS = {
  // ── CONVEYOR DRIVE SYSTEM ──────────────────────────────
  conveyor_drive: [
    {
      id: 'motor_overheat',
      label: 'Motor overheating',
      component: 'Electric Motor',
      icon: 'thermometer',
      description: 'Motor temperature and current climb as windings overheat.',
      effects: [
        { sensor: 'Temperature', component: 'Electric Motor', mode: 'spike', toward: 'critical' },
        { sensor: 'Current',     component: 'Electric Motor', mode: 'rise',  toward: 'warning'  },
        { sensor: 'Vibration',   component: 'Electric Motor', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'motor_overload',
      label: 'Motor overload',
      component: 'Electric Motor',
      icon: 'zap',
      description: 'Excessive current draw under mechanical overload.',
      effects: [
        { sensor: 'Current',     component: 'Electric Motor', mode: 'spike', toward: 'critical' },
        { sensor: 'Temperature', component: 'Electric Motor', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'gear_wear',
      label: 'Gear wear',
      component: 'Gearbox',
      icon: 'settings',
      description: 'Worn gear teeth raise vibration and temperature.',
      effects: [
        { sensor: 'Vibration',   component: 'Gearbox', mode: 'spike', toward: 'critical' },
        { sensor: 'Temperature', component: 'Gearbox', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'bearing_wear',
      label: 'Bearing wear',
      component: 'Bearings',
      icon: 'circle-dot',
      description: 'Degraded bearings increase vibration, noise and heat.',
      effects: [
        { sensor: 'Vibration',   component: 'Bearings', mode: 'spike', toward: 'critical' },
        { sensor: 'Noise',       component: 'Bearings', mode: 'rise',  toward: 'critical' },
        { sensor: 'Temperature', component: 'Bearings', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'belt_slip',
      label: 'Belt slip / tension loss',
      component: 'Drive Belt',
      icon: 'move-horizontal',
      description: 'Slipping belt loses speed and vibrates.',
      effects: [
        { sensor: 'Slip',       component: 'Drive Belt', mode: 'spike', toward: 'critical' },
        { sensor: 'Belt Speed', component: 'Drive Belt', mode: 'drop',  toward: 'warning'  },
        { sensor: 'Vibration',  component: 'Drive Belt', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'vfd_fault',
      label: 'VFD electrical fault',
      component: 'VFD Drive',
      icon: 'cpu',
      description: 'Drive faults — overcurrent, overheating, fault codes.',
      effects: [
        { sensor: 'Fault Count',    component: 'VFD Drive', mode: 'spike', toward: 'critical' },
        { sensor: 'Temperature',    component: 'VFD Drive', mode: 'rise',  toward: 'critical' },
        { sensor: 'Current',        component: 'VFD Drive', mode: 'rise',  toward: 'warning'  },
        { sensor: 'DC Bus Voltage', component: 'VFD Drive', mode: 'rise',  toward: 'warning'  },
      ],
    },
  ],

  // ── INDUSTRIAL HYDRAULIC PRESS ─────────────────────────
  hydraulic_press: [
    {
      id: 'motor_overheat',
      label: 'Motor overheating',
      component: 'Electric Motor',
      icon: 'thermometer',
      description: 'Drive motor overheats under continuous load.',
      effects: [
        { sensor: 'Temperature', component: 'Electric Motor', mode: 'spike', toward: 'critical' },
        { sensor: 'Current',     component: 'Electric Motor', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'pump_cavitation',
      label: 'Pump cavitation',
      component: 'Hydraulic Pump',
      icon: 'waves',
      description: 'Cavitation drives vibration up and pressure unstable.',
      effects: [
        { sensor: 'Vibration',   component: 'Hydraulic Pump', mode: 'spike', toward: 'critical' },
        { sensor: 'Pressure',    component: 'Hydraulic Pump', mode: 'drop',  toward: 'warning'  },
        { sensor: 'Temperature', component: 'Hydraulic Pump', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'pump_wear',
      label: 'Pump wear',
      component: 'Hydraulic Pump',
      icon: 'settings',
      description: 'Worn pump loses pressure and runs hot.',
      effects: [
        { sensor: 'Pressure',    component: 'Hydraulic Pump', mode: 'drop',  toward: 'warning'  },
        { sensor: 'Temperature', component: 'Hydraulic Pump', mode: 'spike', toward: 'critical' },
        { sensor: 'Vibration',   component: 'Hydraulic Pump', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'seal_wear',
      label: 'Cylinder seal wear',
      component: 'Hydraulic Cylinder',
      icon: 'circle-dot',
      description: 'Internal leakage reduces pressure and force.',
      effects: [
        { sensor: 'Pressure',    component: 'Hydraulic Cylinder', mode: 'spike', toward: 'critical' },
        { sensor: 'Position',    component: 'Hydraulic Cylinder', mode: 'rise',  toward: 'warning'  },
        { sensor: 'Temperature', component: 'Hydraulic Cylinder', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'oil_degradation',
      label: 'Oil degradation / low level',
      component: 'Oil Tank',
      icon: 'droplet',
      description: 'Hot, degrading oil and dropping level.',
      effects: [
        { sensor: 'Oil Temperature', component: 'Oil Tank', mode: 'spike', toward: 'critical' },
        { sensor: 'Oil Level',       component: 'Oil Tank', mode: 'drop',  toward: 'critical' },
      ],
    },
    {
      id: 'filter_clog',
      label: 'Oil filter clogging',
      component: 'Oil Filter',
      icon: 'filter',
      description: 'Clogged filter raises differential pressure.',
      effects: [
        { sensor: 'Differential Pressure', component: 'Oil Filter', mode: 'spike', toward: 'critical' },
      ],
    },
  ],

  // ── AIR COMPRESSOR ─────────────────────────────────────
  air_compressor: [
    {
      id: 'motor_overheat',
      label: 'Motor overheating',
      component: 'Electric Motor',
      icon: 'thermometer',
      description: 'Motor overheats and draws more current.',
      effects: [
        { sensor: 'Temperature', component: 'Electric Motor', mode: 'spike', toward: 'critical' },
        { sensor: 'Current',     component: 'Electric Motor', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'pump_wear',
      label: 'Compressor pump wear',
      component: 'Compressor Pump',
      icon: 'settings',
      description: 'Worn pump overheats, vibrates, loses pressure.',
      effects: [
        { sensor: 'Temperature', component: 'Compressor Pump', mode: 'spike', toward: 'critical' },
        { sensor: 'Vibration',   component: 'Compressor Pump', mode: 'rise',  toward: 'critical' },
        { sensor: 'Pressure',    component: 'Compressor Pump', mode: 'drop',  toward: 'warning'  },
      ],
    },
    {
      id: 'air_filter_clog',
      label: 'Air filter clogging',
      component: 'Air Filter',
      icon: 'filter',
      description: 'Restricted airflow raises differential pressure.',
      effects: [
        { sensor: 'Differential Pressure', component: 'Air Filter', mode: 'spike', toward: 'critical' },
      ],
    },
    {
      id: 'tank_leak',
      label: 'Receiver tank leak',
      component: 'Air Receiver Tank',
      icon: 'wind',
      description: 'Leaking tank loses pressure.',
      effects: [
        { sensor: 'Pressure',    component: 'Air Receiver Tank', mode: 'drop',  toward: 'critical' },
        { sensor: 'Temperature', component: 'Air Receiver Tank', mode: 'rise',  toward: 'warning'  },
      ],
    },
    {
      id: 'fan_failure',
      label: 'Cooling fan failure',
      component: 'Cooling Fan',
      icon: 'fan',
      description: 'Fan slows or stops — cooling efficiency drops, heat rises.',
      effects: [
        { sensor: 'RPM',         component: 'Cooling Fan', mode: 'drop',  toward: 'critical' },
        { sensor: 'Temperature', component: 'Cooling Fan', mode: 'spike', toward: 'critical' },
      ],
    },
  ],
}

// Map machine type → fault list
export function faultsForType(type) {
  return FAULTS[type] || []
}
