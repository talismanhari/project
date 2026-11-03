export interface HardwareStatus {
  is_physical: boolean;
  mode_label: string;
}

export interface Int8Features {
  names: string[];
  float_vals: number[];
  int8_vals: number[];
}

export interface DecisionPayload {
  action: 'EDGE' | 'CLOUD' | 'EDGE_FAILSAFE';
  risk_score: number;
  threshold: number;
  predicted_class: string;
  confidence: number;
  defer_to_cloud?: boolean;
}

export interface CloudVerdict {
  status: string;
  gpu_device: string;
  latency_ms?: number;
  confirmed_fault?: string;
}

export interface QuantizationRecord {
  name: string;
  label: string;
  unit: string;
  sensor: string;
  fp32: number;
  scale: number;
  zero_point: number;
  int8: number;
  hex: string;
  dequant: number;
  error: number;
}

export interface Ina219Trace {
  times_ms: number[];
  power_mw: number[];
  energy_mj: number;
}

export interface TelemetryPayload {
  state_name: string;
  state_index: number;
  window_idx?: number;
  timestamp_s?: number;
  time_raw_s?: number[];
  sig_raw_g?: number[];
  time_down_s?: number[];
  sig_down_g?: number[];
  raw_waveform?: number[];
  fft_freqs?: number[];
  fft_psd_db?: number[];
  stft_times?: number[];
  stft_freqs?: number[];
  stft_zxx_db?: number[][];
  features_fp32?: number[];
  quantization_records?: QuantizationRecord[];
  raw_logits?: number[];
  ina219_trace?: Ina219Trace;
  hardware_status?: HardwareStatus;
  int8_features?: Int8Features;
  decision?: DecisionPayload;
  cloud_verdict?: CloudVerdict;
  min_risk?: number;
  spectrogram?: {
    z: number[][];
    times: number[];
    freqs: number[];
  } | null;
  telemetry?: {
    times_ms: number[];
    accel_x: number[];
    accel_y: number[];
    accel_z: number[];
    acoustic: number[];
    current_a: number[];
    rms_g: number;
    p2p_g: number;
    kurtosis: number;
    crest: number;
  };
  energy?: {
    instantaneous_mj: number;
    cumulative_measured_j: number;
    cumulative_baseline_j: number;
    saved_percent: number;
  };
  risk?: {
    score: number;
    deferred: boolean;
    threshold: number;
    decision: string;
    probs: number[];
    labels: string[];
    hypothesis: string;
    expected_risks: number[];
  };
  model_metrics?: {
    model_architecture: string;
    train_accuracy_pct: number;
    test_accuracy_pct: number;
    sampling_rate_adxl345_hz: number;
    anti_aliasing_filter: string;
    feature_count: number;
  };
}

export interface InferenceCycleLog {
  cycleId: number;
  timestamp: string;
  stateName: string;
  decision: 'KEEP_LOCAL' | 'OFFLOAD_CLOUD' | 'FAILSAFE_LOCAL';
  minRisk: number;
  threshold: number;
  tinyDeferEnergy: number;
  baselineEnergy: number;
  cumulativeTinyDefer: number;
  cumulativeBaseline: number;
  isFailSafeActive?: boolean;
}
