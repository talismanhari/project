import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import {
  Cloud,
  Zap,
  TrendingDown,
  Clock,
  Battery,
  Layers,
  WifiOff,
  Wifi,
} from 'lucide-react';
import Plotly from 'plotly.js-dist-min';

export const Plot2CloudAndEnergy: React.FC = () => {
  const { telemetryData, operatingMode, isOutageFailSafe } = useAppSelector(
    (state) => state.telemetry
  );
  const { history, tinyDeferCumulative_mJ, baselineCumulative_mJ, cycleCount } =
    useAppSelector((state) => state.energy);

  const isSevereMode = operatingMode === 'MODE_2_SEVERE';
  const isOffloadActive = isSevereMode && !isOutageFailSafe;

  // 1. Live 2D STFT Cloud Spectrogram
  const spectrogramData: Plotly.Data[] = useMemo(() => {
    if (
      !telemetryData ||
      !telemetryData.stft_zxx_db ||
      !telemetryData.stft_times ||
      !telemetryData.stft_freqs
    ) {
      return [];
    }

    return [
      {
        z: telemetryData.stft_zxx_db,
        x: telemetryData.stft_times,
        y: telemetryData.stft_freqs,
        type: 'heatmap',
        colorscale: 'Viridis',
        zsmooth: 'best',
        colorbar: {
          title: {
            text: 'PSD [dB]',
            font: { family: 'JetBrains Mono, monospace', size: 9, color: '#9CA3AF' },
          },
          tickfont: { family: 'JetBrains Mono, monospace', size: 8, color: '#9CA3AF' },
          len: 0.88,
          thickness: 10,
        },
      },
    ];
  }, [telemetryData]);

  const spectrogramLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      xaxis: {
        title: {
          text: 'Window Time [s]',
          font: { family: 'JetBrains Mono, monospace', size: 10, color: '#9CA3AF' },
        },
        showgrid: true,
        gridcolor: '#1E293B',
      },
      yaxis: {
        title: {
          text: 'Frequency [Hz]',
          font: { family: 'JetBrains Mono, monospace', size: 10, color: '#9CA3AF' },
        },
        range: [0, 800],
        showgrid: true,
        gridcolor: '#1E293B',
      },
      margin: { l: 48, r: 15, t: 15, b: 35 },
    }),
    []
  );

  // 2. Subplot 1: Instantaneous Energy per 1s Cycle (Log10 Y-Axis [mJ/cycle])
  const instantPlotData: Plotly.Data[] = useMemo(() => {
    if (history.length === 0) return [];

    const xLabels = history.map((h) => h.timestamp);
    const kumarInstant = history.map((h) => h.baselineEnergy);
    const tinyInstant = history.map((h) => h.tinyDeferEnergy);

    return [
      {
        x: xLabels,
        y: kumarInstant,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Kumar 2026 (92.4% Offload: ~1500 / 2.2 mJ)',
        line: { color: '#EF4444', width: 1.5, dash: 'dash' },
        marker: { size: 4, color: '#EF4444' },
      },
      {
        x: xLabels,
        y: tinyInstant,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'TinyDefer (0.50 mJ Local / 1500 mJ Burst)',
        line: { color: '#10B981', width: 1.5 },
        marker: { size: 5, color: '#10B981' },
      },
    ];
  }, [history]);

  const instantPlotLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      xaxis: {
        title: {
          text: 'Streaming Timeline [s]',
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#9CA3AF' },
        },
        showgrid: true,
        gridcolor: '#1E293B',
      },
      yaxis: {
        title: {
          text: 'Cycle Energy [mJ] (Log10)',
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#9CA3AF' },
        },
        type: 'log',
        range: [-0.5, 3.8], // 0.3 mJ to 6000 mJ
        showgrid: true,
        gridcolor: '#1E293B',
        dtick: 1,
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.25,
        font: { size: 8, color: '#E2E8F0', family: 'monospace' },
        bgcolor: 'rgba(11, 15, 25, 0.7)',
      },
      margin: { l: 52, r: 15, t: 25, b: 32 },
    }),
    []
  );

  // 3. Subplot 2: Cumulative Energy & Step Comparison (Log10 [mJ])
  const cumulativePlotData: Plotly.Data[] = useMemo(() => {
    if (history.length === 0) return [];

    const xLabels = history.map((h) => h.timestamp);
    const kumarCumulative = history.map((h) => h.cumulativeBaseline);
    const tinyCumulative = history.map((h) => h.cumulativeTinyDefer);

    return [
      {
        x: xLabels,
        y: kumarCumulative,
        type: 'scatter',
        mode: 'lines',
        name: 'Kumar 2026 Cumulative [mJ]',
        line: { color: '#EF4444', width: 1.5, dash: 'dash' },
      },
      {
        x: xLabels,
        y: tinyCumulative,
        type: 'scatter',
        mode: 'lines',
        name: 'TinyDefer Cumulative [mJ]',
        line: { color: '#10B981', width: 2 },
      },
    ];
  }, [history]);

  const cumulativePlotLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      xaxis: {
        title: {
          text: 'Streaming Timeline [s]',
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#9CA3AF' },
        },
        showgrid: true,
        gridcolor: '#1E293B',
      },
      yaxis: {
        title: {
          text: 'Cumulative [mJ] (Log10)',
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#9CA3AF' },
        },
        type: 'log',
        range: [-0.3, 5.0], // 0.5 mJ to 100,000 mJ
        showgrid: true,
        gridcolor: '#1E293B',
        dtick: 1,
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.25,
        font: { size: 8, color: '#E2E8F0', family: 'monospace' },
        bgcolor: 'rgba(11, 15, 25, 0.7)',
      },
      margin: { l: 52, r: 15, t: 25, b: 32 },
    }),
    []
  );

  // Dynamic KPI Calculations matching Slide 6 ("Expected Result")
  const offloadCycles = history.filter((h) => h.decision === 'OFFLOAD_CLOUD').length;
  const offloadRate = cycleCount > 0 ? (offloadCycles / cycleCount) * 100 : 0.0;
  const saved_mJ = Math.max(0, baselineCumulative_mJ - tinyDeferCumulative_mJ);
  const savingsPct =
    baselineCumulative_mJ > 0 ? (saved_mJ / baselineCumulative_mJ) * 100 : 0;
  const TOTAL_BATTERY_mJ = 26640000; // 2000 mAh @ 3.7V
  const CYCLES_PER_DAY = 8640;
  const avgTinyDefer = cycleCount > 0 ? tinyDeferCumulative_mJ / cycleCount : 0.5;
  const avgBaseline = cycleCount > 0 ? baselineCumulative_mJ / cycleCount : 1380.0;
  const tinyDeferDays = Math.min(1825, TOTAL_BATTERY_mJ / (Math.max(0.1, avgTinyDefer) * CYCLES_PER_DAY));
  const baselineDays = Math.max(0.5, TOTAL_BATTERY_mJ / (avgBaseline * CYCLES_PER_DAY));

  if (!telemetryData) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 font-mono text-xs">
      {/* LEFT COLUMN: 2D STFT CLOUD SPECTROGRAM (Cols 1-5) */}
      <div className="xl:col-span-5 rounded-xl border border-[#1E293B] bg-[#0B0F19] p-3.5 space-y-2 relative flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 text-[11px]">
            <span className="flex items-center gap-2 text-white font-bold uppercase">
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              Stage 4 — Cloud 2D STFT Spectrogram
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                isOffloadActive
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                  : isSevereMode && isOutageFailSafe
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isOffloadActive
                ? 'MQTT UPLINK ACTIVE'
                : isSevereMode && isOutageFailSafe
                ? 'FAIL-SAFE (LOCAL STANDBY)'
                : 'WI-FI STANDBY (LOCAL)'}
            </span>
          </div>

          <div className="h-64 w-full rounded-lg overflow-hidden border border-[#1E293B] bg-[#101622] relative mt-2">
            <PlotlyChart data={spectrogramData} layout={spectrogramLayout} />

            {/* Standby Banner when local */}
            {!isOffloadActive && (
              <div className="absolute top-2 right-14 px-2 py-0.5 rounded bg-[#0B0F19]/90 border border-[#1E293B] text-[9px] text-gray-400 font-mono">
                {isSevereMode && isOutageFailSafe
                  ? 'Wi-Fi Cut • Local Fail-Safe Operating'
                  : 'Wi-Fi Inactive (0.05 mW Deep Sleep)'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-gray-400 pt-1 border-t border-[#1E293B]/60">
          <span>ResNet-50 Cloud CNN Target</span>
          <span className={isOffloadActive ? 'text-red-400 font-bold' : 'text-emerald-400'}>
            {isOffloadActive ? 'BPFO/BPFI Resonance Harmonics Flagged' : 'Normal Low-Entropy PSD'}
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: 2-SUBPLOT HARDWARE-IN-THE-LOOP INA219 ENERGY ANALYZER (Cols 6-12) */}
      <div className="xl:col-span-7 rounded-xl border border-[#1E293B] bg-[#0B0F19] p-3.5 space-y-2.5">
        {/* Monospace KPI Readout Bar (Slide 6 Expected Result) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div className="p-2 rounded bg-[#101622] border border-[#1E293B]">
            <div className="text-gray-400">Cloud Offload Rate:</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {offloadRate.toFixed(1)}%{' '}
              <span className="text-[9px] font-normal text-gray-400">(vs 92.4% Kumar)</span>
            </div>
          </div>

          <div className="p-2 rounded bg-[#101622] border border-[#1E293B]">
            <div className="text-gray-400">Energy per Cycle:</div>
            <div className="text-sm font-bold text-white mt-0.5">
              ~0.50 <span className="text-[9px] font-normal text-gray-400">/ 1,500 mJ</span>
            </div>
          </div>

          <div className="p-2 rounded bg-[#101622] border border-[#1E293B]">
            <div className="text-gray-400">Avg Hybrid Latency:</div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">
              &lt; 1.5 s{' '}
              <span className="text-[9px] font-normal text-gray-400">(vs 8.867 s)</span>
            </div>
          </div>

          <div className="p-2 rounded bg-[#101622] border border-[#1E293B]">
            <div className="text-gray-400">Battery Lifespan:</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5">
              {(tinyDeferDays / 365).toFixed(1)} Yrs{' '}
              <span className="text-[9px] font-normal text-emerald-400">
                ({(tinyDeferDays / Math.max(1, baselineDays)).toFixed(0)}× Ext)
              </span>
            </div>
          </div>
        </div>

        {/* 2-SUBPLOT ENERGY PROFILER (Subplot 1 Instantaneous + Subplot 2 Cumulative) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Subplot 1: Instantaneous Energy (Log10 Y-Axis) */}
          <div className="rounded-lg border border-[#1E293B] bg-[#101622] p-2 space-y-1">
            <div className="text-[10px] text-gray-300 font-bold flex items-center justify-between">
              <span>Subplot 1: Instantaneous Energy (Log10 mJ)</span>
              <span className="text-emerald-400 text-[9px]">0.5 mJ vs 1500 mJ</span>
            </div>
            <div className="h-44 w-full">
              {history.length > 0 ? (
                <PlotlyChart data={instantPlotData} layout={instantPlotLayout} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-[10px]">
                  Sampling instantaneous INA219 shunt...
                </div>
              )}
            </div>
          </div>

          {/* Subplot 2: Cumulative Energy (Log10 Y-Axis) */}
          <div className="rounded-lg border border-[#1E293B] bg-[#101622] p-2 space-y-1">
            <div className="text-[10px] text-gray-300 font-bold flex items-center justify-between">
              <span>Subplot 2: Cumulative Energy (Log10 mJ)</span>
              <span className="text-emerald-400 text-[9px]">{savingsPct.toFixed(1)}% Saved</span>
            </div>
            <div className="h-44 w-full">
              {history.length > 0 ? (
                <PlotlyChart data={cumulativePlotData} layout={cumulativePlotLayout} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-[10px]">
                  Accumulating energy profile...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
