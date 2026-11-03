import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import Plotly from 'plotly.js-dist-min';
import { Cpu, Activity } from 'lucide-react';

export const PanelASensorInput: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  const isPhysical = telemetryData?.hardware_status?.is_physical ?? false;
  const modeLabel = telemetryData?.hardware_status?.mode_label ?? (isPhysical ? 'PHYSICAL HARDWARE ACQUISITION' : 'STANDBY ENGINE ACTIVE');

  const waveformData: Plotly.Data[] = useMemo(() => {
    if (!telemetryData) return [];

    let wave: number[] = [];
    if (telemetryData.raw_waveform && telemetryData.raw_waveform.length > 0) {
      wave = telemetryData.raw_waveform;
    } else if (telemetryData.sig_down_g && telemetryData.sig_down_g.length > 0) {
      wave = telemetryData.sig_down_g.slice(0, 100);
    } else {
      wave = new Array(100).fill(0);
    }

    const xPts = wave.map((_, i) => i * 10);
    return [
      {
        x: xPts,
        y: wave,
        type: 'scatter',
        mode: 'lines',
        name: 'Transducer Waveform',
        line: { color: isPhysical ? '#10B981' : '#F59E0B', width: 1.5 },
      },
    ];
  }, [telemetryData, isPhysical]);

  const waveformLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      paper_bgcolor: '#101622',
      plot_bgcolor: '#101622',
      font: { family: 'JetBrains Mono, Courier New, monospace', color: '#9CA3AF', size: 9 },
      margin: { l: 35, r: 15, t: 15, b: 25 },
      xaxis: {
        title: { text: 'Time [ms]', font: { size: 9 } },
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
      },
      yaxis: {
        title: { text: 'Amp [g]', font: { size: 9 } },
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
      },
    }),
    []
  );

  const featuresList = useMemo(() => {
    if (telemetryData?.int8_features) {
      const { names, float_vals, int8_vals } = telemetryData.int8_features;
      return names.map((name, i) => ({
        name,
        floatVal: float_vals[i] !== undefined ? float_vals[i] : 0,
        int8Val: int8_vals[i] !== undefined ? int8_vals[i] : 0,
      }));
    }

    // Default 12 features fallback
    const defaultNames = [
      'RMS', 'CrestFactor', 'Kurtosis', 'Skewness', 'Peak2Peak',
      'BPFO_Ratio', 'BPFI_Ratio', 'HarmonicRatio', 'SpectralCentroid',
      'HighFreqEnergy', 'CurrentRMS', 'TempDrift'
    ];
    return defaultNames.map((name, i) => ({
      name,
      floatVal: 0.05 + i * 0.1,
      int8Val: 8 + i * 4,
    }));
  }, [telemetryData]);

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3 shadow-xl font-mono text-xs">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            PANEL A: SENSOR INPUT & INT8 QUANTIZATION
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isPhysical
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            [{modeLabel}]
          </span>
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-2">
          <span>ODR: <strong className="text-gray-200">3,200 Hz</strong></span>
          <span>•</span>
          <span>100-Sample Waveform Buffer</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Live Oscilloscope (Cols 1-7) */}
        <div className="xl:col-span-7 rounded-xl border border-[#1E293B] bg-[#101622] p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span className="flex items-center gap-1.5 font-bold text-gray-300">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Time-Domain Vibration Waveform [Normalized ±1.0]
            </span>
            <span className="text-emerald-400 font-bold">ADXL345 SPI + INMP441 Acoustic</span>
          </div>
          <div className="h-44 w-full rounded-lg overflow-hidden border border-[#1E293B]">
            <PlotlyChart data={waveformData} layout={waveformLayout} />
          </div>
        </div>

        {/* 12-Feature INT8 Quantization Grid (Cols 8-12) */}
        <div className="xl:col-span-5 rounded-xl border border-[#1E293B] bg-[#101622] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 mb-1 border-b border-[#1E293B] pb-1.5">
            <span className="font-bold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              12 Edge Features (Float → INT8)
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">Q = round(x / S)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 flex-1 content-center">
            {featuresList.map((f) => (
              <div
                key={f.name}
                className="p-1 rounded bg-[#07090C] border border-[#1E293B] text-[10px] flex items-center justify-between font-mono"
              >
                <span className="text-gray-400 truncate w-14" title={f.name}>{f.name}</span>
                <span className="text-cyan-300 font-bold">{f.floatVal}</span>
                <span className="text-[9px] text-emerald-400 font-bold">i8:{f.int8Val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
