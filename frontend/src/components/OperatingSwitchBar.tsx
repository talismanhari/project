import React, { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setOperatingMode,
  toggleStreaming,
  resetClock,
  setTemperatureT,
  setRiskThreshold,
  toggleOutageFailSafe,
  OperatingMode,
} from '../store/telemetrySlice';
import { resetEnergyLogger } from '../store/energySlice';
import {
  computeCalibratedProbabilities,
  computeExpectedRiskVector,
  evaluateDeferralDecision,
  ASYMMETRIC_COST_MATRIX,
} from '../utils/mathPipeline';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Sliders,
  Flame,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  Radio,
  WifiOff,
  Wifi,
  ShieldCheck,
} from 'lucide-react';

interface OperatingSwitchBarProps {
  onStepOneSecond?: () => void;
}

export const OperatingSwitchBar: React.FC<OperatingSwitchBarProps> = ({ onStepOneSecond }) => {
  const dispatch = useAppDispatch();
  const {
    operatingMode,
    isStreaming,
    streamTick,
    temperatureT,
    riskThreshold,
    isOutageFailSafe,
    telemetryData,
  } = useAppSelector((state) => state.telemetry);

  // Compute live mathematical gatekeeper state from current 1-second telemetry
  const mathState = useMemo(() => {
    if (!telemetryData || !telemetryData.raw_logits) return null;
    const cal = computeCalibratedProbabilities(telemetryData.raw_logits, temperatureT);
    const risk = computeExpectedRiskVector(cal.calibratedProbabilities, ASYMMETRIC_COST_MATRIX);
    const gate = evaluateDeferralDecision(risk.minRisk, riskThreshold);
    return { cal, risk, gate };
  }, [telemetryData, temperatureT, riskThreshold]);

  const isLocal = mathState?.gate.decision === 'KEEP_LOCAL';
  const isOffload = !isLocal && !isOutageFailSafe;
  const isFailSafeActive = !isLocal && isOutageFailSafe;

  const handleReset = () => {
    dispatch(resetClock());
    dispatch(resetEnergyLogger());
  };

  return (
    <div className="space-y-3 font-mono text-xs select-none">
      {/* 1. TOP 2-MODE SWITCH + WI-FI OUTAGE FAIL-SAFE TOGGLE + PLAYBACK CONTROLS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* The 2-Mode Operating Switch (Cols 1-7) */}
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* MODE 1: NORMAL / MILD STREAM (~80% TARGET) */}
          <button
            onClick={() => dispatch(setOperatingMode('MODE_1_NORMAL'))}
            className={`p-3 rounded-lg border text-left font-mono transition-all ${
              operatingMode === 'MODE_1_NORMAL'
                ? 'bg-[#0E1713] border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40'
                : 'bg-[#101622] border-[#1E293B] text-gray-400 hover:border-emerald-500/40 hover:bg-[#131B29]'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    operatingMode === 'MODE_1_NORMAL' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
                  }`}
                />
                MODE 1: NOMINAL / MILD (~80% Target)
              </span>
              <span className="text-gray-400 font-mono text-[9px]">0.50 mJ • Wi-Fi Sleep</span>
            </div>
            <div className="text-sm font-bold text-white font-sans tracking-tight">
              [ NORMAL / MILD STREAM (KEEP LOCAL) ]
            </div>
            <div className="text-[10px] text-gray-400 mt-1 leading-snug">
              Streams nominal 1s CWRU windows. Core 1 INT8 keeps{' '}
              <strong className="text-emerald-400">R(x) &lt; θ</strong>. Local diagnosis in &lt;1 ms.
            </div>
          </button>

          {/* MODE 2: SEVERE / COMPOUND FAULT STREAM (~20% TARGET) */}
          <button
            onClick={() => dispatch(setOperatingMode('MODE_2_SEVERE'))}
            className={`p-3 rounded-lg border text-left font-mono transition-all ${
              operatingMode === 'MODE_2_SEVERE'
                ? 'bg-[#1C0F12] border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-red-500/40'
                : 'bg-[#101622] border-[#1E293B] text-gray-400 hover:border-red-500/40 hover:bg-[#1C141E]'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    operatingMode === 'MODE_2_SEVERE' ? 'bg-red-500 animate-ping' : 'bg-gray-600'
                  }`}
                />
                MODE 2: SEVERE FAULT (~20% Target)
              </span>
              <span className="text-red-400 font-bold text-[9px]">+1,500 mJ • Wi-Fi Burst</span>
            </div>
            <div className="text-sm font-bold text-white font-sans tracking-tight">
              [ SEVERE FAULT (AUTO-OFFLOAD) ]
            </div>
            <div className="text-[10px] text-gray-400 mt-1 leading-snug">
              Compound outer/inner race harmonics trigger{' '}
              <strong className="text-red-400">R(x) ≥ θ</strong>. Auto-wakes Wi-Fi radio.
            </div>
          </button>
        </div>

        {/* WI-FI OUTAGE FAIL-SAFE TOGGLE & STREAM CADENCE CONTROLS (Cols 8-12) */}
        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Outage Fail-Safe Toggle */}
          <button
            onClick={() => dispatch(toggleOutageFailSafe())}
            className={`p-3 rounded-lg border text-left font-mono transition-all flex flex-col justify-between ${
              isOutageFailSafe
                ? 'bg-[#1A1608] border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/50'
                : 'bg-[#101622] border-[#1E293B] text-gray-400 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                {isOutageFailSafe ? (
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                )}
                LINK STATUS
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  isOutageFailSafe
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {isOutageFailSafe ? 'OUTAGE ACTIVE' : 'WI-FI CONNECTED'}
              </span>
            </div>

            <div className="text-xs font-bold font-sans mt-1 text-white">
              [ {isOutageFailSafe ? 'FAIL-SAFE MODE ENGAGED' : 'SIMULATE LINK OUTAGE'} ]
            </div>

            <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">
              {isOutageFailSafe
                ? 'Wi-Fi cut. Fallback to Conservative Local Bayes (>98% Recall, 0.50 mJ).'
                : 'Toggle to test offline fallback when Wi-Fi is lost during Severe Faults.'}
            </div>
          </button>

          {/* 1 Hz Cadence & Jury Step Controls */}
          <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                1 Hz Real-Time Clock
              </span>
              <span className="text-emerald-400 font-bold font-mono">
                {isStreaming ? '● STREAMING' : '❚❚ PAUSED'}
              </span>
            </div>

            <div className="text-base font-bold text-white font-mono my-1">
              t = {streamTick}s{' '}
              <span className="text-[10px] font-normal text-gray-500">
                (w = {telemetryData?.window_idx ?? streamTick})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => dispatch(toggleStreaming())}
                className={`flex-1 py-1 rounded border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  isStreaming
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                }`}
              >
                {isStreaming ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>RESUME</span>
                  </>
                )}
              </button>

              <button
                onClick={onStepOneSecond}
                title="Step 1 Second Forward (Jury Inspection Mode)"
                className="px-2 py-1 rounded border border-[#1E293B] bg-[#101622] hover:bg-[#151D2A] text-cyan-300 text-[11px] font-bold flex items-center gap-1 transition-colors"
              >
                <StepForward className="w-3 h-3" />
                <span>Step 1s</span>
              </button>

              <button
                onClick={handleReset}
                title="Reset Clock & Energy History"
                className="p-1 rounded border border-[#1E293B] bg-[#101622] text-gray-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. LIVE PARAMETER SLIDERS DOCK */}
      <div className="px-4 py-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-400 text-[11px]">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white font-bold uppercase text-[10px] tracking-wider">
            Stage 3: Decision Gate Parameters
          </span>
          <span className="text-[10px] text-gray-500 hidden sm:inline">(Live Recalculation)</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          {/* Temperature Slider */}
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-400 text-[11px]">Temperature (T):</span>
            <input
              aria-label="Temperature parameter"
              type="range"
              min="0.50"
              max="3.00"
              step="0.05"
              value={temperatureT}
              onChange={(e) => dispatch(setTemperatureT(parseFloat(e.target.value)))}
              className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-cyan-400 font-bold w-9 text-right">{temperatureT.toFixed(2)}</span>
          </div>

          {/* Deferral Threshold Slider */}
          <div className="flex items-center gap-2 border-l border-[#1E293B] pl-4 sm:pl-6">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-400 text-[11px]">Threshold (θ):</span>
            <input
              aria-label="Risk Threshold parameter"
              type="range"
              min="0.20"
              max="3.00"
              step="0.05"
              value={riskThreshold}
              onChange={(e) => dispatch(setRiskThreshold(parseFloat(e.target.value)))}
              className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <span className="text-amber-400 font-bold w-9 text-right">{riskThreshold.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 3. HARDWARE GATEKEEPER REAL-TIME VERDICT BANNER */}
      {mathState && (
        <div
          className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
            isFailSafeActive
              ? 'bg-[#1A1608] border-amber-500 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : isLocal
              ? 'bg-[#0E1713] border-emerald-500/50 text-emerald-300'
              : 'bg-[#1C0F12] border-red-500/60 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                isFailSafeActive
                  ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] animate-pulse'
                  : isLocal
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
                  : 'bg-red-500 shadow-[0_0_12px_#EF4444] animate-ping'
              }`}
            />
            <div>
              <span className="font-bold">
                {isFailSafeActive
                  ? 'STAGE 4: WI-FI OUTAGE FAIL-SAFE ACTIVE • Conservative Local Bayes Rule • 0.50 mJ'
                  : isLocal
                  ? 'STAGE 4: LOCAL EXECUTION ACCEPTED (<1 ms) • Wi-Fi Deep Sleep (0.05 mW) • ~0.50 mJ'
                  : 'STAGE 4: AUTONOMOUS CLOUD OFFLOAD TRIGGERED • Wi-Fi TX Wake -> MQTT Uplink • ~1,500 mJ'}
              </span>
              <span className="text-gray-400 font-sans ml-2 text-[10px]">
                ({telemetryData?.state_name})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div>
              <span className="text-gray-400">Bayes Risk R(x):</span>{' '}
              <span
                className={`font-bold ${
                  isFailSafeActive ? 'text-amber-300' : isLocal ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {mathState.risk.minRisk.toFixed(3)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Threshold θ:</span>{' '}
              <span className="font-bold text-amber-400">{riskThreshold.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">Decision Margin:</span>{' '}
              <span className="font-bold text-cyan-300">
                {(mathState.risk.minRisk - riskThreshold).toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
