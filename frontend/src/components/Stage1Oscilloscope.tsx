import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import Plotly from 'plotly.js-dist-min';
import { Activity } from 'lucide-react';

export const Stage1Oscilloscope: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  const isPhysical = telemetryData?.hardware_status?.is_physical ?? false;
  const modeLabel =
    telemetryData?.acquisition?.mode ??
    telemetryData?.hardware_status?.mode_label ??
    (isPhysical ? 'PHYSICAL_ACTIVE' : 'SYNTHETIC_ACTIVE');

  const plotData: Plotly.Data[] = useMemo(() => {
    const acq = telemetryData?.acquisition;
    const pts = 100;
    const x = acq?.times_ms && acq.times_ms.length > 0
      ? acq.times_ms
      : Array.from({ length: pts }, (_, i) => i * 10);

    const ax = acq?.accel_x && acq.accel_x.length > 0
      ? acq.accel_x
      : (telemetryData?.raw_waveform || new Array(pts).fill(0));

    const ay = acq?.accel_y && acq.accel_y.length > 0
      ? acq.accel_y
      : ax.map((v, i) => Number((v * 0.75 + Math.cos(i * 0.1) * 0.5).toFixed(2)));

    const az = acq?.accel_z && acq.accel_z.length > 0
      ? acq.accel_z
      : ax.map((v) => Number((9.81 + v * 0.6).toFixed(2)));

    const acoustic = acq?.acoustic && acq.acoustic.length > 0
      ? acq.acoustic
      : ax.map((v, i) => Number((Math.sin(i * 0.25) * 0.08).toFixed(3)));

    return [
      {
        x,
        y: ax,
        type: 'scatter',
        mode: 'lines',
        name: 'a_x [m/s²]',
        line: { color: '#10B981', width: 1.5 },
      },
      {
        x,
        y: ay,
        type: 'scatter',
        mode: 'lines',
        name: 'a_y [m/s²]',
        line: { color: '#06B6D4', width: 1.2 },
      },
      {
        x,
        y: az,
        type: 'scatter',
        mode: 'lines',
        name: 'a_z [m/s²]',
        line: { color: '#F59E0B', width: 1.2 },
      },
      {
        x,
        y: acoustic,
        type: 'scatter',
        mode: 'lines',
        name: 'Mic [Audio]',
        yaxis: 'y2',
        line: { color: '#EC4899', width: 1.0, dash: 'dot' },
      },
    ];
  }, [telemetryData]);

  const plotLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      uirevision: 'constant',
      autosize: true,
      paper_bgcolor: '#101622',
      plot_bgcolor: '#101622',
      font: { family: 'JetBrains Mono, monospace', color: '#9CA3AF', size: 9 },
      margin: { l: 38, r: 38, t: 10, b: 24 },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.15,
        font: { size: 9, color: '#E2E8F0', family: 'JetBrains Mono' },
        bgcolor: 'rgba(16, 22, 34, 0.8)',
      },
      xaxis: {
        title: { text: 'Time [ms]', font: { size: 9 } },
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
      },
      yaxis: {
        title: { text: 'Accel [m/s²]', font: { size: 9 } },
        range: [-20.0, 20.0],
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
      },
      yaxis2: {
        title: { text: 'Audio [±1.0]', font: { size: 9, color: '#EC4899' } },
        range: [-1.0, 1.0],
        overlaying: 'y',
        side: 'right',
        showgrid: false,
        tickfont: { color: '#EC4899', size: 8 },
      },
    }),
    []
  );

  return (
    <div className="h-[260px] min-h-[260px] max-h-[260px] rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-3 flex flex-col justify-between overflow-hidden shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-bold text-white tracking-wider uppercase">
            STAGE 1: RAW MULTI-AXIS TRANSDUCER OSCILLOSCOPE
          </span>
          <span
            className={`px-2 py-0.2 rounded-full text-[9px] font-bold border ${
              isPhysical
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            [{modeLabel}]
          </span>
        </div>
        <div className="text-[10px] text-gray-400">
          <span>Tri-Axial [-20, 20] m/s² • Audio [-1.0, 1.0]</span>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden mt-1 rounded-lg border border-[#1E293B]">
        <PlotlyChart data={plotData} layout={plotLayout} />
      </div>
    </div>
  );
};

export default Stage1Oscilloscope;
