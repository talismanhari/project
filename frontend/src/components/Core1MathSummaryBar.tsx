import React, { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { toggleMathDrawer } from '../store/telemetrySlice';
import {
  computeCalibratedProbabilities,
  computeExpectedRiskVector,
  evaluateDeferralDecision,
  MOTOR_STATES,
  ASYMMETRIC_COST_MATRIX,
} from '../utils/mathPipeline';
import {
  Binary,
  Flame,
  Grid,
  ChevronDown,
  ChevronUp,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const Core1MathSummaryBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    telemetryData,
    temperatureT,
    riskThreshold,
    isMathDrawerOpen,
    isOutageFailSafe,
  } = useAppSelector((state) => state.telemetry);

  // 1. Live Quantization stats
  const qStats = useMemo(() => {
    if (!telemetryData || !telemetryData.quantization_records) return { maxErr: 0, avgErr: 0 };
    const errs = telemetryData.quantization_records.map((r) => r.error);
    const maxErr = Math.max(...errs);
    const avgErr = errs.reduce((a, b) => a + b, 0) / errs.length;
    return { maxErr, avgErr };
  }, [telemetryData]);

  // 2. Live Calibration & Bayes Risk
  const calResults = useMemo(() => {
    if (!telemetryData || !telemetryData.raw_logits) return null;
    return computeCalibratedProbabilities(telemetryData.raw_logits, temperatureT);
  }, [telemetryData, temperatureT]);

  const riskResults = useMemo(() => {
    if (!calResults) return null;
    return computeExpectedRiskVector(calResults.calibratedProbabilities, ASYMMETRIC_COST_MATRIX);
  }, [calResults]);

  const gate = useMemo(() => {
    if (!riskResults) return null;
    return evaluateDeferralDecision(riskResults.minRisk, riskThreshold);
  }, [riskResults, riskThreshold]);

  if (!telemetryData || !calResults || !riskResults || !gate) return null;

  const maxProb = Math.max(...calResults.calibratedProbabilities);
  const maxProbIdx = calResults.calibratedProbabilities.indexOf(maxProb);
  const topState = MOTOR_STATES[maxProbIdx] || 'Normal';
  const isLocal = gate.decision === 'KEEP_LOCAL';

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] font-mono text-xs overflow-hidden transition-all">
      {/* COMPACT SUMMARY STRIP (MATCHING SLIDE 5: STAGE 3) */}
      <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Summary Metrics */}
        <div className="flex flex-wrap items-center gap-4 text-gray-300">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white uppercase text-[11px] tracking-wider">
              Stage 3 — ESP32-S3 Core 1 TinyML & Risk Gatekeeper
            </span>
          </div>

          <div className="h-4 w-px bg-[#1E293B] hidden sm:block" />

          {/* Metric 1: QAT INT8 Conversion */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Binary className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-400">QAT INT8 Error (|ε|):</span>
            <strong className="text-cyan-300">{qStats.maxErr.toExponential(2)}</strong>
            <span className="text-[9px] text-emerald-400 font-bold ml-0.5">
              (4× SRAM: 80B → 20B)
            </span>
          </div>

          <div className="h-4 w-px bg-[#1E293B] hidden md:block" />

          {/* Metric 2: Single-Pass Probability Calibration */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-400">Calibrated P_T(c|x):</span>
            <strong className="text-white">{(maxProb * 100).toFixed(1)}%</strong>
            <span className="text-[10px] text-gray-400">
              ({topState} • &lt;0.05 ms, T={temperatureT.toFixed(2)})
            </span>
          </div>

          <div className="h-4 w-px bg-[#1E293B] hidden md:block" />

          {/* Metric 3: Asymmetric Risk Calculator vs Theta */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Grid className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-gray-400">Bayes Risk R(x):</span>
            <strong className={isLocal ? 'text-emerald-400' : 'text-red-400'}>
              {riskResults.minRisk.toFixed(3)}
            </strong>
            <span className="text-gray-500">vs</span>
            <span className="text-amber-400 font-bold">θ = {riskThreshold.toFixed(2)}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ml-1 ${
                isLocal
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : isOutageFailSafe
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}
            >
              {isLocal
                ? 'ACCEPT LOCAL'
                : isOutageFailSafe
                ? 'FAIL-SAFE LOCAL'
                : 'OFFLOAD CLOUD'}
            </span>
          </div>
        </div>

        {/* Right: Expand / Collapse Toggle Button */}
        <button
          onClick={() => dispatch(toggleMathDrawer())}
          className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#101622] hover:bg-[#151D2A] text-gray-300 hover:text-white flex items-center gap-2 transition-colors text-[11px]"
        >
          <span>{isMathDrawerOpen ? 'Hide Math Details' : 'Inspect Raw INT8 Registers & 8×8 Matrix'}</span>
          {isMathDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* EXPANDABLE MATHEMATICAL DRAWER */}
      {isMathDrawerOpen && (
        <div className="border-t border-[#1E293B] bg-[#07090C] p-4 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* 1. Full 20-Feature INT8 Register Table (Cols 1-7) */}
            <div className="xl:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Binary className="w-3.5 h-3.5 text-emerald-400" />
                  QAT INT8 Quantization Registers [20 DSP Features from Core 0]
                </span>
                <span className="text-[10px] text-gray-400">
                  Formula: q = clamp(round(x / S) + Z, -128, 127)
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#1E293B] bg-[#101622] max-h-60 overflow-y-auto">
                <table className="w-full text-left text-[10px] font-mono border-collapse">
                  <thead className="sticky top-0 bg-[#0B0F19] text-gray-400 uppercase text-[9px] border-b border-[#1E293B] z-10">
                    <tr>
                      <th className="py-1.5 px-2">Idx</th>
                      <th className="py-1.5 px-2">Feature</th>
                      <th className="py-1.5 px-2 text-right">FP32</th>
                      <th className="py-1.5 px-2 text-right">Scale (S)</th>
                      <th className="py-1.5 px-2 text-right">Z-Pt</th>
                      <th className="py-1.5 px-2 text-center text-emerald-400">INT8 (q)</th>
                      <th className="py-1.5 px-2 text-center text-cyan-400">Hex</th>
                      <th className="py-1.5 px-2 text-right">Dequant (x̂)</th>
                      <th className="py-1.5 px-2 text-right text-emerald-400">|ε|</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]/60 text-gray-300">
                    {telemetryData.quantization_records.map((r, idx) => (
                      <tr key={r.name} className="hover:bg-[#151D2A]">
                        <td className="py-1 px-2 text-gray-500">[{idx.toString().padStart(2, '0')}]</td>
                        <td className="py-1 px-2 font-bold text-gray-200 truncate max-w-[120px]">
                          {r.label}
                        </td>
                        <td className="py-1 px-2 text-right text-cyan-300">{r.fp32.toFixed(3)}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{r.scale.toFixed(4)}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{r.zero_point}</td>
                        <td className="py-1 px-2 text-center font-bold text-emerald-400">{r.int8}</td>
                        <td className="py-1 px-2 text-center text-cyan-400">{r.hex}</td>
                        <td className="py-1 px-2 text-right text-gray-300">{r.dequant.toFixed(3)}</td>
                        <td className="py-1 px-2 text-right text-emerald-400 font-bold">
                          {r.error.toExponential(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. 8x8 Asymmetric Cost Matrix & Live Risk Dot Product (Cols 8-12) */}
            <div className="xl:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-amber-400" />
                  Asymmetric Penalty Matrix [8×8] & Dot Product: R(d) = ∑ p(c) · C(c, d)
                </span>
                <span className="text-red-400 text-[10px]">Missed Critical Fault = 10.0</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#1E293B] bg-[#101622] p-2 max-h-60 overflow-y-auto">
                <table className="w-full text-center text-[9px] font-mono border-collapse">
                  <thead>
                    <tr className="text-gray-400 border-b border-[#1E293B]">
                      <th className="p-1 text-left">True\Act</th>
                      {MOTOR_STATES.map((st, j) => (
                        <th
                          key={j}
                          className={`p-1 truncate max-w-[45px] ${
                            j === riskResults.optimalActionIndex ? 'text-emerald-400 font-bold bg-emerald-500/10' : ''
                          }`}
                        >
                          {st.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ASYMMETRIC_COST_MATRIX.map((row, i) => (
                      <tr key={i} className="border-b border-[#1E293B]/40">
                        <td className="p-1 text-left text-gray-300 whitespace-nowrap">
                          {MOTOR_STATES[i].split(' ')[0]}
                        </td>
                        {row.map((cost, j) => {
                          let colorClass = 'text-gray-400';
                          if (cost === 0) colorClass = 'text-emerald-400 font-bold';
                          else if (cost >= 10) colorClass = 'text-red-400 font-bold bg-red-500/10';
                          else if (cost >= 4) colorClass = 'text-amber-400';
                          return (
                            <td key={j} className={`p-1 ${colorClass}`}>
                              {cost.toFixed(0)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vector Dot Product Output */}
              <div className="p-2 rounded bg-[#101622] border border-[#1E293B] text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Live Risk Vector R(d):</span>
                  <span className="text-white font-mono">
                    [{riskResults.expectedRiskVector.map((v) => v.toFixed(2)).join(', ')}]
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Selected Hypothesis: {riskResults.optimalActionName}</span>
                  <span>R_min(x) = {riskResults.minRisk.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
