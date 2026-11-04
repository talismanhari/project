import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Stage2CostMatrixTable: React.FC = () => {
  const { telemetryData } = useAppSelector((state) => state.telemetry);

  const costData = useMemo(() => {
    if (telemetryData?.cost_table) {
      return telemetryData.cost_table;
    }

    // Default nominal fallback
    const classes = [
      'Healthy', 'Outer Race (BPFO)', 'Inner Race (BPFI)', 'Ball Defect',
      'Unbalance', 'Misalignment', 'Looseness', 'Overload'
    ];
    const probs = [0.942, 0.015, 0.010, 0.008, 0.012, 0.005, 0.005, 0.003];
    const costs = [0.0, 10.0, 10.0, 10.0, 1.0, 1.0, 1.0, 1.0];
    const weighted_risks = probs.map((p, i) => Number((p * costs[i]).toFixed(4)));
    const total_risk = Number(weighted_risks.reduce((a, b) => a + b, 0).toFixed(3));

    return {
      classes,
      probabilities: probs,
      costs,
      weighted_risks,
      total_risk,
      threshold: 1.70,
      verdict: total_risk > 1.70 ? 'DEFERRED_TO_RTX3050' : 'PROCESSED_ON_EDGE',
    };
  }, [telemetryData]);

  const isDeferred = costData.total_risk > costData.threshold;

  return (
    <div className="h-[260px] min-h-[260px] max-h-[260px] rounded-2xl border border-[#1E293B] bg-[#0B0F19] p-3 flex flex-col justify-between overflow-hidden shadow-xl font-mono text-xs">
      {/* Stage Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold text-white tracking-wider uppercase">
            STAGE 2: ASYMMETRIC BAYES RISK CALCULATION
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">θ = {costData.threshold.toFixed(2)}</span>
          <span
            className={`px-2 py-0.2 rounded-full text-[9px] font-bold border ${
              isDeferred
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}
          >
            {isDeferred ? 'R > 1.70 (DEFER)' : 'R ≤ 1.70 (SAFE)'}
          </span>
        </div>
      </div>

      {/* 8-Class Diagnostic SCADA Table */}
      <div className="flex-1 overflow-y-auto my-1 border border-[#1E293B] rounded-lg bg-[#101622]">
        <table className="w-full text-left text-[10px] font-mono border-collapse">
          <thead className="bg-[#07090C] text-gray-400 sticky top-0 border-b border-[#1E293B]">
            <tr>
              <th className="py-1 px-2 font-semibold">Fault State (y)</th>
              <th className="py-1 px-1.5 text-right font-semibold">P(y|x) %</th>
              <th className="py-1 px-1.5 text-right font-semibold">Cost C(a,y)</th>
              <th className="py-1 px-2 text-right font-semibold">Risk Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A2333]">
            {costData.classes.map((clsName, idx) => {
              const prob = (costData.probabilities[idx] !== undefined ? costData.probabilities[idx] * 100 : 0);
              const cost = costData.costs[idx] !== undefined ? costData.costs[idx] : 0;
              const wRisk = costData.weighted_risks[idx] !== undefined ? costData.weighted_risks[idx] : 0;
              const isDominant = prob > 50;

              return (
                <tr
                  key={clsName}
                  className={`hover:bg-[#151D2A] transition-colors ${
                    isDominant ? 'bg-cyan-500/10 text-cyan-200' : 'text-gray-300'
                  }`}
                >
                  <td className="py-0.5 px-2 truncate max-w-[120px] font-medium" title={clsName}>
                    {clsName}
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-bold">
                    {prob.toFixed(1)}%
                  </td>
                  <td className="py-0.5 px-1.5 text-right text-amber-300 font-mono">
                    {cost.toFixed(1)}
                  </td>
                  <td className="py-0.5 px-2 text-right text-emerald-300 font-mono">
                    {wRisk.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summation Row */}
      <div
        className={`shrink-0 flex items-center justify-between p-1.5 rounded-lg border text-[11px] font-mono ${
          isDeferred
            ? 'bg-red-500/15 border-red-500/40 text-red-200'
            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-1.5 font-bold">
          {isDeferred ? <AlertCircle className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          <span>Total Bayes Risk: R = ∑ C(a, y) · P(y|x)</span>
        </div>
        <div className="font-extrabold text-xs">
          R = {costData.total_risk.toFixed(3)} {isDeferred ? '> 1.70 [CLOUD DEFERRAL]' : '≤ 1.70 [LOCAL SAFE]'}
        </div>
      </div>
    </div>
  );
};

export default Stage2CostMatrixTable;
