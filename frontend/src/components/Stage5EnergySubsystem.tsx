import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { BatteryCharging, Cpu, AlertTriangle, Zap } from 'lucide-react';

export const Stage5EnergySubsystem: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  const energyStatus = telemetryData?.energy_status;
  const isHwOnline = energyStatus?.hardware_online ?? false;
  const statusLabel =
    energyStatus?.label ??
    (isHwOnline ? 'INA219 ONLINE' : 'HARDWARE SENSOR OFFLINE (INA219 DISCONNECTED)');

  const defaultScales = [
    0.0078, 0.0845, 0.1145, 0.0231, 0.0547, 0.0187,
    0.0173, 0.0450, 13.676, 0.0181, 0.0422, 0.1752,
  ];

  const featuresList = useMemo(() => {
    if (telemetryData?.int8_features) {
      const { names, float_vals, int8_vals, scale_factors } = telemetryData.int8_features;
      return names.map((name, i) => ({
        name,
        floatVal: float_vals[i] !== undefined ? float_vals[i] : 0,
        scaleVal: scale_factors && scale_factors[i] !== undefined ? scale_factors[i] : defaultScales[i] || 0.05,
        int8Val: int8_vals[i] !== undefined ? int8_vals[i] : 0,
      }));
    }

    if (telemetryData?.features_int8) {
      const { names, floats, ints } = telemetryData.features_int8;
      return names.map((name, i) => ({
        name,
        floatVal: floats[i] !== undefined ? floats[i] : 0,
        scaleVal: defaultScales[i] || 0.05,
        int8Val: ints[i] !== undefined ? ints[i] : 0,
      }));
    }

    const defaultNames = [
      'RMS', 'CrestFactor', 'Kurtosis', 'Skewness', 'Peak2Peak',
      'BPFO_Ratio', 'BPFI_Ratio', 'HarmonicRatio', 'SpectralCentroid',
      'HighFreqEnergy', 'CurrentRMS', 'TempDrift',
    ];
    return defaultNames.map((name, i) => ({
      name,
      floatVal: Number((0.05 + i * 0.1).toFixed(2)),
      scaleVal: defaultScales[i] || 0.05,
      int8Val: 8 + i * 4,
    }));
  }, [telemetryData]);

  return (
    <div
      className="rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-3 flex flex-col justify-between overflow-hidden shadow-xl font-mono text-xs"
      style={{
        height: '340px',
        minHeight: '340px',
        maxHeight: '340px',
        contain: 'paint layout size',
      }}
    >
      {/* Header with explicit INA219 instrumentation label */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-white tracking-wider uppercase">
            STAGE 5: ENERGY INSTRUMENTATION & INT8 SCALING
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.2 rounded-full text-[9px] font-bold border flex items-center gap-1 ${
              isHwOnline
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            [{statusLabel}]
          </span>
        </div>
      </div>

      {/* Power comparison metrics */}
      <div className="grid grid-cols-2 gap-2 my-1 shrink-0">
        <div className="p-2 rounded-lg bg-[#101622] border border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <div className="text-[9px] text-gray-400">ESP32-S3 Edge Baseline</div>
              <div className="text-xs font-bold text-emerald-300 font-mono">~310 mW</div>
            </div>
          </div>
          <span className="text-[9px] text-emerald-400/80 bg-emerald-500/10 px-1 rounded">0.50 mJ/inf</span>
        </div>

        <div className="p-2 rounded-lg bg-[#101622] border border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <div>
              <div className="text-[9px] text-gray-400">RTX 3050 Cloud Compute</div>
              <div className="text-xs font-bold text-purple-300 font-mono">~45 W Burst</div>
            </div>
          </div>
          <span className="text-[9px] text-purple-400/80 bg-purple-500/10 px-1 rounded">82.1 mJ/inf</span>
        </div>
      </div>

      {/* INT8 Quantization Matrix */}
      <div className="flex-1 overflow-y-auto border border-[#1E293B] rounded-lg bg-[#101622] p-1.5">
        <div className="grid grid-cols-3 gap-1">
          {featuresList.map((f) => (
            <div
              key={f.name}
              className="p-1 rounded bg-[#07090C] border border-[#1E293B] text-[9px] flex flex-col justify-between font-mono"
            >
              <div className="flex items-center justify-between text-gray-400 border-b border-[#151D2A] pb-0.5">
                <span className="truncate max-w-[65px] text-gray-300" title={f.name}>
                  {f.name}
                </span>
                <span className="text-gray-500">S:{f.scaleVal < 1 ? f.scaleVal.toFixed(3) : f.scaleVal.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-cyan-300 font-bold">{f.floatVal}</span>
                <span className="text-emerald-400 font-bold">i8:{f.int8Val >= 0 ? `+${f.int8Val}` : f.int8Val}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Stage5EnergySubsystem;
