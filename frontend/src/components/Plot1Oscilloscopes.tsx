import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import { Activity, BarChart3 } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';

export const Plot1Oscilloscopes: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  // 1. Time-Domain Waveform Plot (3,200 Hz downsampled 1-second window)
  const timePlotData: Plotly.Data[] = useMemo(() => {
    if (!telemetryData || !telemetryData.sig_down_g || !telemetryData.time_down_s) return [];

    // Map 0.0-1.0s to 0-1000 ms for authentic oscilloscope timebase
    const times_ms = telemetryData.time_down_s.map((t) => Number((t * 1000).toFixed(1)));

    return [
      {
        x: times_ms,
        y: telemetryData.sig_down_g,
        type: 'scatter',
        mode: 'lines',
        name: 'ADXL345 3,200 Hz Anti-Aliased',
        line: { color: '#10B981', width: 1 },
      },
    ];
  }, [telemetryData]);

  const timePlotLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      xaxis: {
        title: {
          text: 'Time [ms]',
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 10, color: '#9CA3AF' },
        },
        range: [0, 1000],
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickcolor: '#475569',
      },
      yaxis: {
        title: {
          text: 'Acceleration Amplitude [g]',
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 10, color: '#9CA3AF' },
        },
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickcolor: '#475569',
      },
      margin: { l: 48, r: 15, t: 15, b: 35 },
    }),
    []
  );

  // 2. Radix-2 FFT Power Spectral Density Plot (0 to 1,600 Hz)
  const DEFECT_MARKERS = [
    { freq: 29.95, label: '1X (29.95 Hz)', color: '#10B981', dash: 'dash' },
    { freq: 59.9, label: '2X (59.9 Hz)', color: '#38BDF8', dash: 'dot' },
    { freq: 89.85, label: '3X (89.85 Hz)', color: '#A855F7', dash: 'dot' },
    { freq: 107.4, label: 'BPFO (107.4 Hz)', color: '#EF4444', dash: 'solid' },
    { freq: 162.2, label: 'BPFI (162.2 Hz)', color: '#F59E0B', dash: 'solid' },
  ];

  const fftPlotData: Plotly.Data[] = useMemo(() => {
    if (!telemetryData || !telemetryData.fft_freqs || !telemetryData.fft_psd_db) return [];

    return [
      {
        x: telemetryData.fft_freqs,
        y: telemetryData.fft_psd_db,
        type: 'scatter',
        mode: 'lines',
        name: 'Radix-2 FFT PSD [dB]',
        line: { color: '#38BDF8', width: 1 },
      },
    ];
  }, [telemetryData]);

  const fftPlotLayout: Partial<Plotly.Layout> = useMemo(() => {
    const shapes: Partial<Plotly.Shape>[] = DEFECT_MARKERS.map((m) => ({
      type: 'line',
      x0: m.freq,
      x1: m.freq,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: m.color, width: 1, dash: m.dash as any },
    }));

    const annotations: Partial<Plotly.Annotation>[] = DEFECT_MARKERS.map((m) => ({
      x: m.freq,
      y: 0.98,
      yref: 'paper',
      text: m.label.split(' ')[0],
      showarrow: false,
      font: { family: 'JetBrains Mono, monospace', size: 8, color: m.color },
      bgcolor: 'rgba(11, 15, 25, 0.85)',
      bordercolor: m.color,
      borderwidth: 1,
      borderpad: 2,
    }));

    return {
      xaxis: {
        title: {
          text: 'Frequency [Hz]',
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 10, color: '#9CA3AF' },
        },
        range: [0, 800],
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickcolor: '#475569',
      },
      yaxis: {
        title: {
          text: 'PSD [dB/Hz]',
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 10, color: '#9CA3AF' },
        },
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickcolor: '#475569',
      },
      shapes,
      annotations,
      margin: { l: 48, r: 15, t: 15, b: 35 },
    };
  }, []);

  // Compute live window stats
  const stats = useMemo(() => {
    if (!telemetryData || !telemetryData.sig_down_g || telemetryData.sig_down_g.length === 0) {
      return { rms: 0, p2p: 0, kurtosis: 0, crest: 0 };
    }
    const arr = telemetryData.sig_down_g;
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const rms = Math.sqrt(arr.reduce((a, b) => a + b * b, 0) / n);
    const p2p = Math.max(...arr) - Math.min(...arr);
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n || 1e-6;
    const kurt = arr.reduce((a, b) => a + Math.pow(b - mean, 4), 0) / n / Math.pow(variance, 2);
    const crest = p2p / 2 / (rms || 1e-6);
    return { rms, p2p, kurtosis: kurt, crest };
  }, [telemetryData]);

  if (!telemetryData) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 font-mono text-xs">
      {/* Scope A: 1-Second Time-Domain Oscilloscope */}
      <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-3.5 space-y-2">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 text-[11px]">
          <span className="flex items-center gap-2 text-white font-bold uppercase">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Stage 1 & 2 — Scope A: 1-Second Vibration Waveform [g vs ms]
          </span>
          <span className="text-[10px] text-gray-400">
            fs = 3,200 Hz • 4th-Order LPF (fc = 1500 Hz)
          </span>
        </div>

        <div className="h-52 w-full rounded-lg overflow-hidden border border-[#1E293B] bg-[#101622]">
          <PlotlyChart data={timePlotData} layout={timePlotLayout} />
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-gray-400">
          <div>
            RMS: <strong className="text-emerald-400">{stats.rms.toFixed(4)} g</strong>
          </div>
          <div>
            P2P: <strong className="text-white">{stats.p2p.toFixed(4)} g</strong>
          </div>
          <div>
            Kurtosis (β₂): <strong className="text-cyan-300">{stats.kurtosis.toFixed(2)}</strong>
          </div>
          <div>
            Crest (Cf): <strong className="text-amber-300">{stats.crest.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Scope B: Radix-2 FFT Power Spectral Density */}
      <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-3.5 space-y-2">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 text-[11px]">
          <span className="flex items-center gap-2 text-white font-bold uppercase">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            Stage 1 & 2 — Scope B: Radix-2 FFT Power Spectral Density [dB vs Hz]
          </span>
          <span className="text-[10px] text-gray-400">N_fft = 1024 • 0–1600 Hz Nyquist</span>
        </div>

        <div className="h-52 w-full rounded-lg overflow-hidden border border-[#1E293B] bg-[#101622]">
          <PlotlyChart data={fftPlotData} layout={fftPlotLayout} />
        </div>

        <div className="flex flex-wrap items-center justify-between px-1 text-[10px] text-gray-400">
          <div className="flex items-center gap-2">
            <span>Harmonic Markers:</span>
            {DEFECT_MARKERS.map((m) => (
              <span key={m.label} style={{ color: m.color }} className="font-bold">
                {m.label}
              </span>
            ))}
          </div>
          <span className="text-cyan-400 font-bold">BPFO: 107.4 Hz | BPFI: 162.2 Hz</span>
        </div>
      </div>
    </div>
  );
};
