// ============================================================
// MACHINE PRESETS
// When admin adds a machine by type, these define the
// components + sensors to auto-create (matches the seed data).
// ============================================================

export const PRESETS = {
  conveyor_drive: {
    label: 'Conveyor Drive System',
    components: [
      { name: 'Electric Motor', sensors: [
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 70, warning_threshold: 80, critical_threshold: 95, current_value: 45, detects: ['Overheating','Rotor/Stator Issues'] },
        { name: 'Current',     unit: 'A',   normal_min: 5,  normal_max: 25, warning_threshold: 30, critical_threshold: 40, current_value: 15, detects: ['Overload','Electrical Fault'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 4.5,warning_threshold: 7,  critical_threshold: 11, current_value: 1.2,detects: ['Imbalance','Misalignment'] },
      ]},
      { name: 'Gearbox', sensors: [
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 75, warning_threshold: 85, critical_threshold: 95, current_value: 52, detects: ['Gear Wear','Lubrication Problems'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 5,  warning_threshold: 8,  critical_threshold: 12, current_value: 2.1,detects: ['Misalignment','Gear Wear'] },
      ]},
      { name: 'Bearings', sensors: [
        { name: 'Temperature', unit: '°C',  normal_min: 15, normal_max: 60, warning_threshold: 75, critical_threshold: 90, current_value: 38, detects: ['Bearing Wear','Lubrication Failure'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 4,  warning_threshold: 7,  critical_threshold: 11, current_value: 1.5,detects: ['Looseness','Imbalance'] },
        { name: 'Noise',       unit: 'dB',  normal_min: 50, normal_max: 75, warning_threshold: 85, critical_threshold: 95, current_value: 62, detects: ['Bearing Wear','Lubrication Failure'] },
      ]},
      { name: 'Drive Belt', sensors: [
        { name: 'Belt Speed',  unit: 'RPM', normal_min: 800,normal_max: 1500,warning_threshold: 1600,critical_threshold: 1800,current_value: 1200,detects: ['Misalignment','Wear'] },
        { name: 'Slip',        unit: '%',   normal_min: 0,  normal_max: 3,  warning_threshold: 5,  critical_threshold: 8,  current_value: 1.2,detects: ['Belt Slip','Tension Loss'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 4,  warning_threshold: 6,  critical_threshold: 10, current_value: 1.8,detects: ['Belt Slip','Misalignment'] },
      ]},
      { name: 'VFD Drive', sensors: [
        { name: 'Temperature',    unit: '°C', normal_min: 20, normal_max: 55, warning_threshold: 65, critical_threshold: 75, current_value: 42, detects: ['Overheating','Drive Failure'] },
        { name: 'Current',        unit: 'A',  normal_min: 5,  normal_max: 30, warning_threshold: 35, critical_threshold: 45, current_value: 18, detects: ['Overcurrent','Electrical Faults'] },
        { name: 'DC Bus Voltage', unit: 'V',  normal_min: 540,normal_max: 680,warning_threshold: 700,critical_threshold: 720,current_value: 620,detects: ['Electrical Faults','Drive Failure'] },
        { name: 'Fault Count',    unit: 'cnt',normal_min: 0,  normal_max: 5,  warning_threshold: 10, critical_threshold: 20, current_value: 0,  detects: ['Drive Failure','Electrical Faults'] },
      ]},
    ],
  },

  hydraulic_press: {
    label: 'Industrial Hydraulic Press',
    components: [
      { name: 'Electric Motor', sensors: [
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 70, warning_threshold: 80, critical_threshold: 95, current_value: 48, detects: ['Overheating','Rotor/Stator Issues'] },
        { name: 'Current',     unit: 'A',   normal_min: 10, normal_max: 50, warning_threshold: 60, critical_threshold: 75, current_value: 32, detects: ['Overload','Electrical Fault'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 4.5,warning_threshold: 7,  critical_threshold: 11, current_value: 1.8,detects: ['Imbalance','Misalignment'] },
      ]},
      { name: 'Hydraulic Pump', sensors: [
        { name: 'Pressure',    unit: 'bar', normal_min: 100,normal_max: 250,warning_threshold: 270,critical_threshold: 300,current_value: 185,detects: ['Pump Wear','Leakage'] },
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 65, warning_threshold: 75, critical_threshold: 90, current_value: 50, detects: ['Overheating','Cavitation'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 5,  warning_threshold: 8,  critical_threshold: 12, current_value: 2.2,detects: ['Pump Wear','Cavitation'] },
      ]},
      { name: 'Hydraulic Cylinder', sensors: [
        { name: 'Pressure',    unit: 'bar', normal_min: 80, normal_max: 220,warning_threshold: 240,critical_threshold: 270,current_value: 160,detects: ['Seal Wear','Internal Leakage'] },
        { name: 'Position',    unit: 'mm',  normal_min: 0,  normal_max: 500,warning_threshold: 510,critical_threshold: 520,current_value: 250,detects: ['Sticking','Force Reduction'] },
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 60, warning_threshold: 70, critical_threshold: 85, current_value: 42, detects: ['Seal Wear','Overheating'] },
      ]},
      { name: 'Oil Tank', sensors: [
        { name: 'Oil Temperature', unit: '°C', normal_min: 20, normal_max: 60, warning_threshold: 70, critical_threshold: 85, current_value: 45, detects: ['Oil Degradation','Overheating'] },
        { name: 'Oil Level',       unit: '%',  normal_min: 40, normal_max: 100,warning_threshold: 30, critical_threshold: 20, current_value: 78, detects: ['Low Oil Level'] },
      ]},
      { name: 'Oil Filter', sensors: [
        { name: 'Differential Pressure', unit: 'bar', normal_min: 0, normal_max: 3, warning_threshold: 5, critical_threshold: 7, current_value: 1.2, detects: ['Filter Clogging','Restricted Flow'] },
      ]},
    ],
  },

  air_compressor: {
    label: 'Air Compressor',
    components: [
      { name: 'Electric Motor', sensors: [
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 70, warning_threshold: 80, critical_threshold: 95, current_value: 50, detects: ['Overheating','Rotor/Stator Issues'] },
        { name: 'Current',     unit: 'A',   normal_min: 5,  normal_max: 35, warning_threshold: 42, critical_threshold: 55, current_value: 22, detects: ['Overload','Electrical Fault'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 4.5,warning_threshold: 7,  critical_threshold: 11, current_value: 2.0,detects: ['Imbalance','Misalignment'] },
      ]},
      { name: 'Compressor Pump', sensors: [
        { name: 'Pressure',    unit: 'bar', normal_min: 6,  normal_max: 12, warning_threshold: 13, critical_threshold: 15, current_value: 8.5,detects: ['Pressure Loss','Wear & Tear'] },
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 80, warning_threshold: 90, critical_threshold: 105,current_value: 65, detects: ['Overheating','Mechanical Failure'] },
        { name: 'Vibration',   unit: 'mm/s',normal_min: 0,  normal_max: 5,  warning_threshold: 8,  critical_threshold: 12, current_value: 2.5,detects: ['Mechanical Failure','Wear'] },
      ]},
      { name: 'Air Filter', sensors: [
        { name: 'Differential Pressure', unit: 'bar', normal_min: 0, normal_max: 0.5, warning_threshold: 0.8, critical_threshold: 1.2, current_value: 0.15, detects: ['Filter Clogging','Airflow Restriction'] },
      ]},
      { name: 'Air Receiver Tank', sensors: [
        { name: 'Pressure',    unit: 'bar', normal_min: 6,  normal_max: 10, warning_threshold: 11, critical_threshold: 13, current_value: 8.0,detects: ['Pressure Loss','Leakage'] },
        { name: 'Temperature', unit: '°C',  normal_min: 15, normal_max: 50, warning_threshold: 60, critical_threshold: 75, current_value: 35, detects: ['Abnormal Operation'] },
      ]},
      { name: 'Cooling Fan', sensors: [
        { name: 'RPM',         unit: 'RPM', normal_min: 900,normal_max: 1500,warning_threshold: 1600,critical_threshold: 1800,current_value: 1200,detects: ['Fan Failure','Reduced Cooling'] },
        { name: 'Temperature', unit: '°C',  normal_min: 20, normal_max: 55, warning_threshold: 65, critical_threshold: 80, current_value: 40, detects: ['Overheating','Fan Failure'] },
      ]},
    ],
  },
}

export const PRESET_TYPES = Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))

export function presetSensorCount(type) {
  const p = PRESETS[type]
  if (!p) return 0
  return p.components.reduce((a, c) => a + c.sensors.length, 0)
}
