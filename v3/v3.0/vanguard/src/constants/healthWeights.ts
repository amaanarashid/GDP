export const HEALTH_WEIGHTS = {
    motor: {
      weight: 0.30,
      sensors: {
        temperature_motor: 0.40,
        current_draw: 0.35,
        vibration_x: 0.25,
      },
    },
    gearbox: {
      weight: 0.25,
      sensors: {
        temperature_gearbox: 0.45,
        vibration_y: 0.35,
        current_draw: 0.20,
      },
    },
    bearing: {
      weight: 0.20,
      sensors: {
        temperature_bearing: 0.40,
        vibration_x: 0.30,
        vibration_z: 0.30,
      },
    },
    belt: {
      weight: 0.15,
      sensors: {
        belt_speed: 0.40,
        belt_tension: 0.40,
        load_percentage: 0.20,
      },
    },
    roller: {
      weight: 0.10,
      sensors: {
        vibration_z: 0.50,
        belt_speed: 0.30,
        load_percentage: 0.20,
      },
    },
  }
  
  export const CONDITION_THRESHOLDS = {
    good: 80,
    fair: 60,
    poor: 40,
    critical: 0,
  }