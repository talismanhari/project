import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import Plotly from 'plotly.js-dist-min';
import { CheckCircle2, AlertTriangle, Radio, ShieldAlert } from 'lucide-react';

export const PanelBDecisionHighway: React.FC = () => {
  const { telemetryData, riskThreshold } = useAppSelector((state) => state.telemetry);

  const riskScore = telemetryData?.decision?.risk_score ?? telemetryData?.min_risk ?? 0.142;
  const isCloud = (telemetryData?.decision?.action === 'CLOUD') || (riskScore > riskThreshold);
  const isFailsafe = (telemetryData?.decision?.action === 'EDGE_FAILSAFE');

  // Semi-Circular Gauge Plotly Layout & Data
  const dialData: Plotly.Data[] = useMemo(
    () => [
      {
        type: 'indicator',
        mode: 'gauge+number',
        value: riskScore,
        number: {
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 28, color: isCloud ? '#EF4444' : '#10B981' },
          valueformat: '.3f',
        },
        gauge: {
          axis: {
            range: [0, 3.0],
            tickwidth: 1,
            tickcolor: '#64748B',
            tickfont: { size: 9, color: '#9CA3AF', family: 'JetBrains Mono' },
            tickvals: [0, 0.5, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0],
          },
          bar: { color: isCloud ? '#EF4444' : '#10B981', thickness: 0.32 },
          bgcolor: '#0B0F19',
          borderwidth: 1,
          bordercolor: '#1E293B',
          steps: [
            { range: [0, 1.20], color: 'rgba(16, 185, 129, 0.22)' },
            { range: [1.20, 3.0], color: 'rgba(239, 68, 68, 0.28)' },
          ],
          threshold: {
            line: { color: '#F59E0B', width: 4 },
            thickness: 0.85,
            value: 1.20,
          },
        },
      },
    ],
    [riskScore, isCloud]
  );

  const dialLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      uirevision: 'SCADA_LOCKED',
      autosize: true,
      paper_bgcolor: '#101622',
      plot_bgcolor: '#101622',
      font: { family: 'JetBrains Mono, monospace', color: '#9CA3AF' },
      margin: { l: 20, r: 20, t: 25, b: 15 },
    }),
    []
  );

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-5 space-y-4 shadow-2xl font-mono text-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          PANEL B: THE DECISION HIGHWAY (BAYES ASYMMETRIC RISK GATE)
        </span>
        <span className="text-[11px] text-gray-400">
          Deferral Boundary: <strong className="text-amber-400">θ = 1.20</strong> • Calibration Temp: <strong className="text-cyan-400">T = 1.45</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Giant Decision Annunciator Banner (Cols 1-8) - Pinned Explicit Height */}
        <div className="lg:col-span-8 flex flex-col justify-center">
          {isCloud ? (
            <div className="h-[280px] min-h-[280px] max-h-[280px] p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-center bg-[#2B0E14] border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.35)]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-red-400 animate-ping shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  HIGH RISK DEFERRAL TRIGGERED — CLOUD OFFLOAD ENGAGED
                </span>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight font-sans text-white mt-3 leading-tight">
                [ HIGH UNCERTAINTY: DEFERRING TO RTX 3050 CLOUD ]
              </div>
              <div className="text-sm font-sans text-red-200 mt-3 font-medium">
                Risk: <strong className="text-white font-mono">{riskScore.toFixed(3)}</strong> (Exceeds θ = 1.20 Boundary) • Local Inference Uncertain • Payload Deferred to RTX 3050 for Heavy Spectrogram Validation
              </div>
            </div>
          ) : isFailsafe ? (
            <div className="h-[280px] min-h-[280px] max-h-[280px] p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-center bg-[#2B1E08] border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.35)]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
                  <Radio className="w-4 h-4" />
                  WI-FI LINK OUTAGE — DETERMINISTIC FAIL-SAFE ACTIVE
                </span>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight font-sans text-white mt-3 leading-tight">
                [ OFFLINE FAIL-SAFE: LOCAL EDGE INFERENCE ENFORCED ]
              </div>
              <div className="text-sm font-sans text-amber-200 mt-3 font-medium">
                Risk: <strong className="text-white font-mono">{riskScore.toFixed(3)}</strong> • Wi-Fi Channel Dropped • Autonomous Fallback Prevents Flatline • 0.50 mJ Energy Budget Enforced
              </div>
            </div>
          ) : (
            <div className="h-[280px] min-h-[280px] max-h-[280px] p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-center bg-[#072418] border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.3)]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  100% CONFIDENT LOCAL EDGE INFERENCE
                </span>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight font-sans text-white mt-3 leading-tight">
                [ PROCESSED ON EDGE: 100% LOCAL INFERENCE ]
              </div>
              <div className="text-sm font-sans text-emerald-200 mt-3 font-medium">
                Risk: <strong className="text-white font-mono">{riskScore.toFixed(3)}</strong> (Below θ = 1.20 Threshold) • Model Confident • Zero Cloud Latency • 0.50 mJ Energy Incurred
              </div>
            </div>
          )}
        </div>

        {/* Ultra-Crisp Semi-Circular Risk Dial (Cols 9-12) - Explicit Height */}
        <div className="lg:col-span-4 rounded-xl border border-[#1E293B] bg-[#101622] p-3 flex flex-col justify-between h-[280px] min-h-[280px] max-h-[280px]">
          <div className="w-full flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              Bayes Risk Dial R(x)
            </span>
            <span className={`font-bold px-2 py-0.5 rounded ${isCloud ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
              R(x) = {riskScore.toFixed(3)}
            </span>
          </div>

          <div className="h-[210px] w-full overflow-hidden">
            <PlotlyChart data={dialData} layout={dialLayout} />
          </div>

          <div className="text-[10px] text-gray-400 font-mono text-center border-t border-[#1E293B] pt-1">
            Safe Local: [0.0 - 1.20] • Cloud Deferral: [1.20 - 3.00]
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelBDecisionHighway;
