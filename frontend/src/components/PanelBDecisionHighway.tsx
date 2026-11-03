import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { PlotlyChart } from './PlotlyChart';
import Plotly from 'plotly.js-dist-min';
import { CheckCircle2, AlertTriangle, Radio } from 'lucide-react';

export const PanelBDecisionHighway: React.FC = () => {
  const { telemetryData, riskThreshold } = useAppSelector((state) => state.telemetry);

  const riskScore = telemetryData?.decision?.risk_score ?? telemetryData?.min_risk ?? 0.142;
  const isCloud = (telemetryData?.decision?.action === 'CLOUD') || (riskScore > riskThreshold);
  const isFailsafe = (telemetryData?.decision?.action === 'EDGE_FAILSAFE');

  // Semi-Circular / Gauge Plotly Layout & Data
  const dialData: Plotly.Data[] = useMemo(
    () => [
      {
        type: 'indicator',
        mode: 'gauge+number',
        value: riskScore,
        number: {
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 22, color: isCloud ? '#EF4444' : '#10B981' },
          valueformat: '.3f',
        },
        gauge: {
          axis: { range: [0, 3.0], tickwidth: 1, tickcolor: '#64748B', tickfont: { size: 8 } },
          bar: { color: isCloud ? '#EF4444' : '#10B981', thickness: 0.3 },
          bgcolor: '#0B0F19',
          borderwidth: 1,
          bordercolor: '#1E293B',
          steps: [
            { range: [0, 1.20], color: 'rgba(16, 185, 129, 0.2)' },
            { range: [1.20, 3.0], color: 'rgba(239, 68, 68, 0.25)' },
          ],
          threshold: {
            line: { color: '#F59E0B', width: 3 },
            thickness: 0.8,
            value: 1.20,
          },
        },
      },
    ],
    [riskScore, isCloud]
  );

  const dialLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      paper_bgcolor: '#101622',
      plot_bgcolor: '#101622',
      font: { family: 'JetBrains Mono, monospace', color: '#9CA3AF' },
      margin: { l: 25, r: 25, t: 20, b: 15 },
    }),
    []
  );

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-5 space-y-4 shadow-2xl font-mono text-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          PANEL B: THE DECISION HIGHWAY (BAYES ASYMMETRIC RISK)
        </span>
        <span className="text-[11px] text-gray-400">
          Threshold: <strong className="text-amber-400">θ = 1.20</strong> • Calibration: <strong className="text-cyan-400">T = 1.45</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Giant Decision Banner (Cols 1-8) */}
        <div className="lg:col-span-8">
          {isCloud ? (
            <div className="p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-center bg-[#2B0E14] border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.35)]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-red-400 animate-ping shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  HIGH UNCERTAINTY — AUTONOMOUS DEFERRAL
                </span>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-sans text-white mt-2">
                [ HIGH UNCERTAINTY: DEFERRING TO RTX 3050 CLOUD ]
              </div>
              <div className="text-sm font-sans text-red-200 mt-2 font-medium">
                Risk: {riskScore.toFixed(3)} (Exceeds 1.20 Cost Boundary) • Offloading Payload for Heavy Spectrogram Validation
              </div>
            </div>
          ) : isFailsafe ? (
            <div className="p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-center bg-[#2B1E08] border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.35)]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
                  <Radio className="w-4 h-4" />
                  WI-FI LINK OUTAGE ACTIVE
                </span>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-sans text-white mt-2">
                [ OFFLINE FAIL-SAFE: LOCAL EDGE INFERENCE ENFORCED ]
              </div>
              <div className="text-sm font-sans text-amber-200 mt-2 font-medium">
                Risk: {riskScore.toFixed(3)} • Wi-Fi Outage Active • Safety Model Fallback Engaged
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-center bg-[#072418] border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.3)]">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  100% CONFIDENT LOCAL INFERENCE
                </span>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-sans text-white mt-2">
                [ PROCESSED ON EDGE: 100% LOCAL INFERENCE ]
              </div>
              <div className="text-sm font-sans text-emerald-200 mt-2 font-medium">
                Risk: {riskScore.toFixed(3)} (Below 1.20 Threshold) • Model Confident • Zero Cloud Latency
              </div>
            </div>
          )}
        </div>

        {/* Semi-Circular Risk Dial (Cols 9-12) */}
        <div className="lg:col-span-4 rounded-xl border border-[#1E293B] bg-[#101622] p-3 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span className="font-bold">Asymmetric Bayes Risk Dial</span>
            <span className={isCloud ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              R(x) = {riskScore.toFixed(3)}
            </span>
          </div>
          <div className="h-44 w-full">
            <PlotlyChart data={dialData} layout={dialLayout} />
          </div>
          <div className="text-[10px] text-gray-400 font-mono text-center">
            Green Zone [0.0 - 1.20] • Red Zone [1.20 - 3.00]
          </div>
        </div>
      </div>
    </div>
  );
};
