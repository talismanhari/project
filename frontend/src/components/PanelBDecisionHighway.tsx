import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { CheckCircle2, AlertTriangle, Radio } from 'lucide-react';

export const PanelBDecisionHighway: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  const risk = useMemo(() => {
    const val = Number(
      telemetryData?.decision?.risk_score ??
      telemetryData?.cost_table?.total_risk ??
      telemetryData?.cost_breakdown?.calculated_risk ??
      (telemetryData as any)?.risk?.score ??
      telemetryData?.min_risk ??
      0.355
    );
    return isNaN(val) ? 0.355 : val;
  }, [telemetryData]);

  const isDeferred = useMemo(() => {
    return (
      risk > 1.65 ||
      telemetryData?.decision?.action === 'DEFER_TO_CLOUD' ||
      telemetryData?.decision?.action === 'CLOUD' ||
      telemetryData?.cost_table?.verdict === 'DEFERRED_TO_RTX3050'
    );
  }, [risk, telemetryData]);

  const isFailsafe = telemetryData?.decision?.action === 'EDGE_FAILSAFE';

  const needleAngle = useMemo(() => {
    return Math.min(Math.max((risk / 3.0) * 180 - 90, -90), 90);
  }, [risk]);

  return (
    <div
      id="panel-b-stage-3"
      className="rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-3 shadow-2xl font-mono text-xs"
      style={{
        minHeight: '230px',
        overflow: 'hidden',
        contain: 'paint layout size',
      }}
    >
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-1 shrink-0 h-6">
        <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          PANEL B: DECISION HIGHWAY (BAYES ASYMMETRIC RISK GATE)
        </span>
        <span className="text-[10px] text-gray-400">
          Boundary: <strong className="text-amber-400">θ = 1.65</strong> • Temp: <strong className="text-cyan-400">T = 1.45</strong>
        </span>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch mt-2"
        style={{ contain: 'paint layout size' }}
      >
        <div className="lg:col-span-8">
          <div
            id="decision-banner-panel-b"
            className="p-4 rounded-xl border flex flex-col justify-between transition-colors duration-200"
            style={{
              height: '180px',
              minHeight: '180px',
              maxHeight: '180px',
              borderColor: isDeferred ? '#ef4444' : isFailsafe ? '#f59e0b' : '#10b981',
              background: isDeferred
                ? 'rgba(239, 68, 68, 0.15)'
                : isFailsafe
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(16, 185, 129, 0.1)',
              transform: 'translateZ(0)',
              willChange: 'background-color, border-color',
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isDeferred ? 'bg-red-400' : isFailsafe ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className="text-[11px] font-bold tracking-widest uppercase truncate"
                  style={{
                    color: isDeferred ? '#f87171' : isFailsafe ? '#fbbf24' : '#10b981',
                  }}
                >
                  {isDeferred ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      HIGH ASYMMETRIC RISK ANOMALY DETECTED
                    </span>
                  ) : isFailsafe ? (
                    <span className="flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5" />
                      WI-FI LINK OUTAGE — DETERMINISTIC FAIL-SAFE ACTIVE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% CONFIDENT LOCAL EDGE INFERENCE
                    </span>
                  )}
                </span>
              </div>

              <div className="text-lg sm:text-xl font-extrabold tracking-tight font-sans text-white mt-1.5 truncate">
                {isDeferred
                  ? '[ HIGH UNCERTAINTY: DEFERRING TO RTX 3050 CLOUD ]'
                  : isFailsafe
                  ? '[ OFFLINE FAIL-SAFE: LOCAL EDGE INFERENCE ENFORCED ]'
                  : '[ PROCESSED ON EDGE: 100% LOCAL INFERENCE ]'}
              </div>
            </div>

            <div>
              <div
                className="text-xs font-sans text-emerald-200 mt-1 truncate"
                style={{
                  color: isDeferred ? '#fca5a5' : isFailsafe ? '#fde68a' : '#a7f3d0',
                }}
              >
                {isDeferred
                  ? `Risk: ${risk.toFixed(3)} exceeds θ = 1.65 boundary • Payload deferred to CUDA for STFT validation`
                  : isFailsafe
                  ? `Risk: ${risk.toFixed(3)} | Wi-Fi dropped | Fallback prevents flatline • 0.50 mJ energy enforced`
                  : `Risk: ${risk.toFixed(3)} below θ = 1.65 threshold • Local model confident • Zero cloud latency`}
              </div>

              <div className="flex items-center gap-4 text-[10px] text-gray-400 font-mono mt-3 pt-2 border-t border-[#1E293B]/60">
                <span>
                  Gate: <strong className="text-white font-sans">θ = 1.65</strong>
                </span>
                <span>
                  Latency:{' '}
                  <strong className={isDeferred ? 'text-red-400' : 'text-emerald-400'}>
                    {isDeferred ? '~15-20 ms (Wi-Fi + GPU)' : '< 0.5 ms'}
                  </strong>
                </span>
                <span>
                  Energy:{' '}
                  <strong className={isDeferred ? 'text-amber-400' : 'text-emerald-400'}>
                    {isDeferred ? '0.50 mJ + 1,500 mJ TX' : '0.50 mJ'}
                  </strong>
                </span>
                <span>
                  Compute:{' '}
                  <strong className="text-cyan-400">
                    {isDeferred ? 'RTX 3050 CUDA' : 'ESP32-S3 INT8'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div
            className="rounded-xl border border-[#1E293B] bg-[#101622] p-3 flex flex-col justify-between items-center"
            style={{
              height: '180px',
              minHeight: '180px',
              maxHeight: '180px',
              overflow: 'hidden',
              contain: 'paint layout size',
              transform: 'translateZ(0)',
            }}
          >
            <div className="w-full flex items-center justify-between text-[10px] text-gray-400 shrink-0">
              <span className="font-bold uppercase tracking-wider text-white">Bayes Risk Dial R(x)</span>
              <span className="text-[9px] text-amber-400 font-mono font-bold">θ = 1.65</span>
            </div>

            <div className="flex-1 w-full flex items-center justify-center relative">
              <svg viewBox="0 0 200 115" className="w-full max-h-[110px] overflow-visible">
                <path
                  d="M 30 100 A 70 70 0 0 1 111.0 30.9"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <path
                  d="M 111.0 30.9 A 70 70 0 0 1 170 100"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="12"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <line x1="111.9" y1="24.9" x2="109.4" y2="40.7" stroke="#f59e0b" strokeWidth="3" />
                <text x="102" y="20" fill="#f59e0b" fontSize="8" fontFamily="JetBrains Mono" fontWeight="bold">
                  θ=1.65
                </text>
                <text x="22" y="112" fill="#64748B" fontSize="8" fontFamily="JetBrains Mono">
                  0.0
                </text>
                <text x="165" y="112" fill="#64748B" fontSize="8" fontFamily="JetBrains Mono">
                  3.0
                </text>
                <polygon
                  points="98,100 102,100 100.8,32 99.2,32"
                  fill="#F8FAFC"
                  stroke="#0F172A"
                  strokeWidth="0.5"
                  transform={`rotate(${needleAngle} 100 100)`}
                  style={{
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformOrigin: '100px 100px',
                  }}
                />
                <circle cx="100" cy="100" r="5" fill="#475569" stroke="#0F172A" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="w-full flex items-center justify-between text-[11px] font-mono shrink-0 pt-1 border-t border-[#1E293B]">
              <span className="text-gray-400">Score:</span>
              <span
                className="font-bold text-sm font-mono"
                style={{ color: isDeferred ? '#ef4444' : '#10b981' }}
              >
                {risk.toFixed(3)}
              </span>
              <span className="text-[9px] text-gray-500">Safe: [0 - 1.65]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelBDecisionHighway;
