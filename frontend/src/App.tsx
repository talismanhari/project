import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchStreamingWindow, incrementTick } from './store/telemetrySlice';
import { recordStreamingTick } from './store/energySlice';
import { Header } from './components/Header';
import { OperatingSwitchBar } from './components/OperatingSwitchBar';
import { Plot1Oscilloscopes } from './components/Plot1Oscilloscopes';
import { Plot2CloudAndEnergy } from './components/Plot2CloudAndEnergy';
import { Core1MathSummaryBar } from './components/Core1MathSummaryBar';
import { BackendCrashOverlay } from './components/BackendCrashOverlay';
import {
  computeCalibratedProbabilities,
  computeExpectedRiskVector,
  evaluateDeferralDecision,
  ASYMMETRIC_COST_MATRIX,
} from './utils/mathPipeline';

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    operatingMode,
    isStreaming,
    streamTick,
    temperatureT,
    riskThreshold,
    isOutageFailSafe,
    isLoading,
    error,
  } = useAppSelector((state) => state.telemetry);

  // Keep refs for tick interval to avoid stale closures
  const stateRef = useRef({
    operatingMode,
    streamTick,
    temperatureT,
    riskThreshold,
    isOutageFailSafe,
    isStreaming,
  });

  useEffect(() => {
    stateRef.current = {
      operatingMode,
      streamTick,
      temperatureT,
      riskThreshold,
      isOutageFailSafe,
      isStreaming,
    };
  }, [operatingMode, streamTick, temperatureT, riskThreshold, isOutageFailSafe, isStreaming]);

  // Execute single 1-second streaming tick
  const executeTick = useCallback(async () => {
    const {
      operatingMode: mode,
      streamTick: currentTick,
      temperatureT: temp,
      riskThreshold: thresh,
      isOutageFailSafe: failSafe,
    } = stateRef.current;

    const action = await dispatch(
      fetchStreamingWindow({
        mode,
        windowIdx: currentTick,
      })
    );

    if (fetchStreamingWindow.fulfilled.match(action)) {
      const data = action.payload;
      const cal = computeCalibratedProbabilities(data.raw_logits, temp);
      const risk = computeExpectedRiskVector(cal.calibratedProbabilities, ASYMMETRIC_COST_MATRIX);
      const gate = evaluateDeferralDecision(risk.minRisk, thresh);

      let finalDecision: 'KEEP_LOCAL' | 'OFFLOAD_CLOUD' | 'FAILSAFE_LOCAL' = gate.decision;
      if (gate.isOffloadRecommended && failSafe) {
        finalDecision = 'FAILSAFE_LOCAL';
      }

      dispatch(
        recordStreamingTick({
          windowIdx: data.window_idx ?? currentTick,
          timestamp_s: currentTick,
          stateName: data.state_name,
          decision: finalDecision,
          minRisk: risk.minRisk,
          threshold: thresh,
          isFailSafeActive: failSafe && gate.isOffloadRecommended,
        })
      );

      dispatch(incrementTick());
    }
  }, [dispatch]);

  // Initial load tick
  useEffect(() => {
    executeTick();
  }, [executeTick]);

  // Continuous 1-Second (1000 ms) Live Streaming Loop
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      if (stateRef.current.isStreaming) {
        executeTick();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, executeTick]);

  return (
    <div className="min-h-screen bg-[#07090C] text-[#F3F4F6] flex flex-col font-mono selection:bg-emerald-500 selection:text-black antialiased">
      {/* Strict Backend Crash Check: Zero-Mock Enforced */}
      {error && (
        <BackendCrashOverlay
          error={error}
          onRetry={executeTick}
          isRetrying={isLoading}
        />
      )}

      {/* Academic MATLAB / Simulink Workbench Header */}
      <Header />

      {/* Main Streaming Workbench Layout matching Slide 5 & 6 */}
      <main className="flex-1 p-3.5 lg:p-5 space-y-3.5 max-w-[1920px] mx-auto w-full">
        {/* STAGE 4: 2-MODE SWITCH + WI-FI OUTAGE FAIL-SAFE TOGGLE + JURY STEP CONTROLS */}
        <OperatingSwitchBar onStepOneSecond={executeTick} />

        {/* STAGE 1 & 2: TIME-DOMAIN WAVEFORM (3,200 Hz) & RADIX-2 FFT SPECTRUM */}
        <Plot1Oscilloscopes />

        {/* STAGE 4: CLOUD 2D-STFT SPECTROGRAM & 2-SUBPLOT INA219 ENERGY PROFILER */}
        <Plot2CloudAndEnergy />

        {/* STAGE 3: CORE 1 TINYML (INT8 QAT, TEMPERATURE CALIBRATION, 8x8 BAYES RISK) */}
        <Core1MathSummaryBar />
      </main>
    </div>
  );
};

export default App;
