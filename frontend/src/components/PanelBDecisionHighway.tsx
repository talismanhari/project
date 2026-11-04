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
          font: { family: 'JetBrains Mono, Courier New, monospace', size: 16, color: isCloud ? '#EF4444' : '#10B981' },
          valueformat: '.3f',
        },
        gauge: {
          axis: {
            range: [0, 3.0],
            tickwidth: 1,
            tickcolor: '#64748B',
            tickfont: { size: 7, color: '#9CA3AF', family: 'JetBrains Mono' },
            tickvals: [0, 1.2, 3.0],
          },
          bar: { color: isCloud ? '#EF4444' : '#10B981', thickness: 0.35 },
          bgcolor: '#0B0F19',
          borderwidth: 1,
          bordercolor: '#1E293B',
          steps: [
            { range: [0, 1.20], color: 'rgba(16, 185, 129, 0.22)' },
            { range: [1.20, 3.0], color: 'rgba(239, 68, 68, 0.28)' },
          ],
          threshold: {
            line: { color: '#F59E0B', width: 3 },
            thickness: 0.85,
            value: 1.20,
          },
        },
      },
    ],
    [riskScore, isCloud]
  );

  return (
    <div
      className="rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-3 shadow-2xl font-mono text-xs"
      style={{
        height: '140px',
        minHeight: '140px',
        maxHeight: '140px',
        overflow: 'hidden',
        contain: 'paint layout size',
      }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-1 shrink-0 h-6">
        <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          PANEL B: THE DECISION HIGHWAY (BAYES ASYMMETRIC RISK GATE)
        </span>
        <span className="text-[10px] text-gray-400">
          Deferral Boundary: <strong className="text-amber-400">θ = 1.20</strong> • Temp: <strong className="text-cyan-400">T = 1.45</strong>
        </span>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center mt-1.5"
        style={{ contain: 'paint layout size' }}
      >
        {/* Zero-Reflow Decision Banner (Cols 1-8) */}
        <div className="lg:col-span-8">
          <div
            id="decisionBanner"
            className={`p-3 rounded-xl border flex flex-col justify-center transition-colors duration-200 ${
              isCloud
                ? 'bg-[#2B0E14] border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.25)] text-red-200'
                : isFailsafe
                ? 'bg-[#2B1E08] border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] text-amber-200'
                : 'bg-[#072418] border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] text-emerald-200'
            }`}
            style={{
              height: '84px',
              minHeight: '84px',
              maxHeight: '84px',
              overflow: 'hidden',
              transform: 'translateZ(0)',
              willChange: 'background-color, border-color',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isCloud ? 'bg-red-400' : isFailsafe ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`text-[10px] font-bold tracking-widest uppercase truncate ${
                  isCloud ? 'text-red-400' : isFailsafe ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {isCloud ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> HIGH UNCERTAINTY — AUTONOMOUS DEFERRAL
                  </span>
                ) : isFailsafe ? (
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3" /> WI-FI LINK OUTAGE ACTIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 100% CONFIDENT LOCAL INFERENCE
                  </span>
                )}
              </span>
            </div>
            <div className="text-base sm:text-lg font-extrabold tracking-tight font-sans text-white truncate mt-0.5">
              {isCloud
                ? '[ HIGH UNCERTAINTY: DEFERRING TO RTX 3050 CLOUD ]'
                : isFailsafe
                ? '[ OFFLINE FAIL-SAFE: LOCAL EDGE INFERENCE ENFORCED ]'
                : '[ PROCESSED ON EDGE: 100% LOCAL INFERENCE ]'}
            </div>
            <div className="text-[11px] font-sans truncate text-gray-300 mt-0.5">
              {isCloud
                ? `Risk: ${riskScore.toFixed(3)} (Exceeds 1.20 Cost Boundary) • Offloading Payload for Heavy Spectrogram Validation`
                : isFailsafe
                ? `Risk: ${riskScore.toFixed(3)} • Wi-Fi Outage Active • Safety Model Fallback Engaged`
                : `Risk: ${riskScore.toFixed(3)} (Below 1.20 Threshold) • Model Confident • Zero Cloud Latency`}
            </div>
          </div>
        </div>

        {/* Risk Dial (Cols 9-12) */}
        <div className="lg:col-span-4">
          <div
            className="rounded-xl border border-[#1E293B] bg-[#101622] p-2 flex flex-col justify-between"
            style={{
              height: '84px',
              minHeight: '84px',
              maxHeight: '84px',
              overflow: 'hidden',
              contain: 'paint layout size',
              transform: 'translateZ(0)',
            }}
          >
            <div className="flex items-center justify-between text-[10px] text-gray-400 shrink-0">
              <span className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-cyan-400" />
                Bayes Risk R(x)
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded font-mono ${
                  isCloud ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'
                }`}
              >
                R = {riskScore.toFixed(3)}
              </span>
            </div>

            <div className="flex-1 w-full overflow-hidden flex items-center justify-center">
              <PlotlyChart
                data={dialData}
                layout={{
                  uirevision: 'static-key',
                  autosize: false,
                  height: 52,
                  margin: { l: 15, r: 15, t: 5, b: 5 },
                }}
                config={{
                  responsive: false,
                  displayModeBar: false,
                }}
              />
            </div>

            <div className="text-[9px] text-gray-500 font-mono text-center shrink-0">
              Green [0.0 - 1.20] • Red [1.20 - 3.00]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelBDecisionHighway;
