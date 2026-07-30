export interface Machine {
    id: string
    name: string
    model: string
    serial_number: string
    location: string
    qr_code: string
    manufacturer: string
    status: 'running' | 'idle' | 'warning' | 'critical' | 'offline'
    rated_capacity: number
    belt_length: number
    belt_width: number
    operating_speed: number
    commissioned_at: string
    created_at: string
  }
  
  export interface Component {
    id: string
    machine_id: string
    name: string
    type: 'motor' | 'gearbox' | 'bearing' | 'belt' | 'roller'
    manufacturer: string
    model_number: string
    specs_json: Record<string, any>
    rated_temperature: number
    rated_vibration: number
    rated_current: number
    installed_at: string
    created_at: string
  }
  
  export interface SensorReading {
    id: string
    machine_id: string
    temperature_motor: number
    temperature_gearbox: number
    temperature_bearing: number
    vibration_x: number
    vibration_y: number
    vibration_z: number
    current_draw: number
    belt_speed: number
    belt_tension: number
    load_percentage: number
    ambient_temperature: number
    recorded_at: string
  }
  
  export interface ComponentHealthScore {
    id: string
    machine_id: string
    component_id: string
    health_score: number
    condition: 'good' | 'fair' | 'poor' | 'critical'
    anomaly_flags: string
    rul_hours: number
    calculated_at: string
    component?: Component
  }
  
  export interface MachineHealthSummary {
    id: string
    machine_id: string
    overall_health_score: number
    overall_condition: 'good' | 'fair' | 'poor' | 'critical'
    active_alerts: number
    pending_recommendations: number
    calculated_at: string
  }
  
  export interface MaintenanceHistory {
    id: string
    machine_id: string
    component_id: string
    technician_id: string
    type: 'preventive' | 'corrective' | 'predictive' | 'inspection'
    description: string
    parts_replaced: string
    downtime_hours: number
    cost: number
    performed_at: string
    created_at: string
    component?: Component
    technician?: Technician
  }
  
  export interface MaintenanceRecommendation {
    id: string
    machine_id: string
    component_id: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    trigger_reason: string
    action: string
    estimated_cost: number
    estimated_hours: number
    is_resolved: boolean
    recommended_at: string
    resolved_at: string | null
    component?: Component
  }
  
  export interface Alert {
    id: string
    machine_id: string
    component_id: string
    severity: 'info' | 'warning' | 'critical'
    type: string
    message: string
    is_acknowledged: boolean
    acknowledged_by: string | null
    triggered_at: string
    acknowledged_at: string | null
    component?: Component
  }
  
  export interface MLModelSnapshot {
    id: string
    machine_id: string
    model_type: 'anomaly_detector' | 'rul_predictor'
    model_weights: Record<string, any>
    training_loss: number
    training_samples: number
    trained_at: string
  }
  
  export interface FailureSimulation {
    id: string
    machine_id: string
    failure_type: string
    affected_component: string
    sensor_overrides: Partial<SensorReading>
    severity: 'low' | 'medium' | 'high' | 'critical'
    is_active: boolean
    started_at: string
    ended_at: string | null
  }
  
  export interface Technician {
    id: string
    name: string
    employee_id: string
    email: string
    phone: string
    role: string
    created_at: string
  }
  
  export interface AnomalyResult {
    isAnomaly: boolean
    score: number
    threshold: number
  }
  
  export interface RULResult {
    rul_hours: number
    confidence: number
  }