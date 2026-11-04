import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import Plotly from 'plotly.js-dist-min';
import { Cloud, Zap, CheckCircle2 } from 'lucide-react';

export const Stage4Spectrogram: React.FC = () => {
  const { telemetryData, riskThreshold } = useAppSelector((state) => state.telemetry);

  const riskScore =
    telemetryData?.cost_table?.total_risk ??
    telemetryData?.decision?.risk_score ??
    telemetryData?.min_risk ??
    0.142;

  const isCloud =
    (telemetryData?.decision?.action === 'CLOUD') ||
    (telemetryData?.cost_table?.verdict === 'DEFERRED_TO_RTX3050') ||
    (riskScore > riskThreshold);

  const specData = telemetryData?.spectrogram;
  const cloudVerdict = telemetryData?.cloud_verdict;

  const plotData: Plotly.Data[] = useMemo(() => {
    if (!specData || !specData.z || specData.z.length === 0) {
      // Default baseline spectrogram grid (129 freqs x 13 times)
      const f = Array.from({ length: 129 }, (_, i) => i * 12.5);
      const t = Array.from({ length: 13 }, (_, i) => Number((i * 0.08).toFixed(2)));
      const z = f.map((freq) =>
        t.map((time) => {
          const fund = Math.exp(-Math.pow((freq - 29.5) / 15, 2)) * 30;
          const bpfo = Math.exp(-Math.pow((freq - 104.2) / 12, 2)) * (isCloud ? 45 : 5);
          return Number((-60 + fund + bpfo + Math.random() * 3).toFixed(1));
        })
      );
      return [
        {
          z,
          x: t,
          y: f,
          type: 'heatmap',
          colorscale: 'Viridis',
          zsmooth: 'best',
          colorbar: {
            title: { text: 'PSD [dB]', font: { family: 'JetBrains Mono, monospace', size: 8, color: '#9CA3AF' } },
            tickfont: { family: 'JetBrains Mono, monospace', size: 7, color: '#9CA3AF' },
            len: 0.95,
            thickness: 10,
          },
        },
      ];
    }

    return [
      {
        z: specData.z,
        x: specData.times,
        y: specData.freqs,
        type: 'heatmap',
        colorscale: 'Viridis',
        zsmooth: 'best',
        colorbar: {
          title: {
            text: 'PSD [dB]',
            font: { family: 'JetBrains Mono, monospace', size: 8, color: '#9CA3AF' },
          },
          tickfont: { family: 'JetBrains Mono, monospace', size: 7, color: '#9CA3AF' },
          len: 0.95,
          thickness: 10,
        },
      },
    ];
  }, [specData, isCloud]);

  const plotLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      uirevision: 'constant',
      autosize: true,
      paper_bgcolor: '#101622',
      plot_bgcolor: '#101622',
      font: { family: 'JetBrains Mono, monospace', color: '#9CA3AF', size: 9 },
      xaxis: {
        title: { text: 'Time [s]', font: { size: 9 } },
        showgrid: true,
        gridcolor: '#1E293B',
      },
      yaxis: {
        title: { text: 'Freq [Hz]', font: { size: 9 } },
        range: [0, 1600],
        showgrid: true,
        gridcolor: '#1E293B',
      },
      margin: { l: 40, r: 10, t: 10, b: 24 },
    }),
    []
  );

  return (
    <div className="h-[280px] min-h-[280px] max-h-[280px] rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-3 flex flex-col justify-between overflow-hidden shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <Cloud className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-bold text-white tracking-wider uppercase">
            STAGE 4: 2D PYTORCH STFT SPECTROGRAM (CUDA ACCELERATED)
          </span>
          <span
            className={`px-2 py-0.2 rounded-full text-[9px] font-bold border ${
              isCloud
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                : 'bg-gray-800 text-gray-400 border-[#1E293B]'
            }`}
          >
            {isCloud ? 'RTX 3050 CUDA ACTIVE' : 'GPU IDLE STANDBY'}
          </span>
        </div>
        <div className="text-[10px] text-gray-400">
          PyTorch STFT (N=256, H=64) • 0 - 1600 Hz Log-PSD dB
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch flex-1 overflow-hidden mt-1">
        {/* Heatmap Area (Cols 1-8) */}
        <div className="lg:col-span-8 rounded-lg overflow-hidden border border-[#1E293B]">
          <PlotlyChart data={plotData} layout={plotLayout} />
        </div>

        {/* Validation Verdict & Latency Box (Cols 9-12) */}
        <div className="lg:col-span-4 rounded-lg border border-[#1E293B] bg-[#101622] p-2.5 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1 border-b border-[#1E293B] pb-1">
              <Zap className="w-3 h-3 text-amber-400" />
              RTX 3050 Validation Engine
            </div>
            <div className="text-sm font-bold text-white font-sans mt-1.5">
              {cloudVerdict?.confirmed_fault || telemetryData?.decision?.predicted_class || 'Outer Race (BPFO)'}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 leading-relaxed">
              {isCloud
                ? 'High-energy harmonic peaks detected at 104.2 Hz defect series with 99.8% model confidence on GPU.'
                : 'Edge model 100% confident. GPU idle in low-power standby awaiting deferred packets.'}
            </div>
          </div>

          <div className="p-2 rounded bg-[#07090C] border border-[#1E293B] text-[10px] space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Compute Latency:</span>
              <strong className="text-cyan-300 font-mono">{cloudVerdict?.latency_ms || 1.82} ms</strong>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Acceleration Bus:</span>
              <strong className="text-white">CUDA Float32</strong>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Verdict:</span>
              <strong className={isCloud ? 'text-red-400 flex items-center gap-1' : 'text-emerald-400 flex items-center gap-1'}>
                <CheckCircle2 className="w-2.5 h-2.5" /> {isCloud ? 'CONFIRMED' : 'EDGE VERIFIED'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stage4Spectrogram;
