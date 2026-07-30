export const THRESHOLDS = {
    temperature: {
      motor: { warning: 75, critical: 90 },
      gearbox: { warning: 70, critical: 85 },
      bearing: { warning: 80, critical: 95 },
    },
    vibration: {
      x: { warning: 4.5, critical: 7.1 },
      y: { warning: 4.5, critical: 7.1 },
      z: { warning: 4.5, critical: 7.1 },
    },
    current: {
      draw: { warning: 38, critical: 45 },
    },
    belt: {
      speed: { warning: 2.8, critical: 3.2 },
      tension: { warning: 800, critical: 1000 },
    },
    load: {
      percentage: { warning: 85, critical: 95 },
    },
  }