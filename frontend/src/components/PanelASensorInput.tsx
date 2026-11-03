import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import Plotly from 'plotly.js-dist-min';
import { Cpu, Activity, Hash } from 'lucide-react';

export const PanelASensorInput: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  const isPhysical = telemetryData?.hardware_status?.is_physical ?? false;
  const modeLabel =
    telemetryData?.hardware_status?.mode_label ??
    (isPhysical ? 'PHYSICAL HARDWARE ACQUISITION' : 'STANDBY ENGINE ACTIVE');

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
      uirevision: 'SCADA_LOCKED',
      autosize: true,
      paper_bgcolor: '#101622',
      plot_bgcolor: '#101622',
      font: { family: 'JetBrains Mono, Courier New, monospace', color: '#9CA3AF', size: 9 },
      margin: { l: 40, r: 15, t: 15, b: 30 },
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
        range: [-0.6, 0.6],
      },
    }),
    []
  );

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
          <span>100-Sample Waveform Scope</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Live Oscilloscope (Cols 1-7) - Explicit Height to Prevent Collapse */}
        <div className="xl:col-span-7 rounded-xl border border-[#1E293B] bg-[#101622] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 mb-1">
            <span className="flex items-center gap-1.5 font-bold text-gray-300">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Time-Domain Vibration Waveform [Normalized ±1.0]
            </span>
            <span className="text-emerald-400 font-bold">ADXL345 SPI + INMP441 Acoustic</span>
          </div>
          <div className="h-[280px] min-h-[280px] max-h-[280px] w-full rounded-lg overflow-hidden border border-[#1E293B]">
            <PlotlyChart data={waveformData} layout={waveformLayout} />
          </div>
        </div>

        {/* 12-Feature INT8 Quantization Grid (Cols 8-12) - Explicit Height & Scale Factors */}
        <div className="xl:col-span-5 rounded-xl border border-[#1E293B] bg-[#101622] p-2.5 flex flex-col justify-between h-[324px] min-h-[324px] max-h-[324px] overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 border-b border-[#1E293B] pb-1.5 mb-1.5">
            <span className="font-bold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              12 DSP Edge Features (Float → INT8)
            </span>
            <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
              <Hash className="w-3 h-3" />
              q = round(x / S)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-y-auto pr-1">
            {featuresList.map((f) => (
              <div
                key={f.name}
                className="p-1.5 rounded bg-[#07090C] border border-[#1E293B] text-[10px] flex flex-col justify-between font-mono hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-gray-400 border-b border-[#151D2A] pb-0.5">
                  <span className="truncate max-w-[90px] font-semibold text-gray-300" title={f.name}>
                    {f.name}
                  </span>
                  <span className="text-[9px] text-gray-500">S:{f.scaleVal < 1 ? f.scaleVal.toFixed(4) : f.scaleVal.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-cyan-300 font-bold">{f.floatVal}</span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">
                    INT8: {f.int8Val >= 0 ? `+${f.int8Val}` : f.int8Val}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelASensorInput;
